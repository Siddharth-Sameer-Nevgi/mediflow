import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { bookAppointmentSchema } from "@/lib/validations";
import { aiService } from "@/features/ai/ai.service";
import { calendarDateInTimeZone } from "@/lib/date";
import { AppointmentType, Prisma } from "@prisma/client";

/** Statuses that mean a patient is still waiting to be seen. */
const ACTIVE_STATUSES = ["BOOKED", "CHECKED_IN", "IN_CONSULTATION"] as const;

/**
 * How many times to re-run the booking transaction when the token-number
 * unique constraint rejects our candidate. Each retry re-reads the current
 * maximum, so a retry only loses to a *newly* committed booking — under real
 * OPD concurrency, exhausting five is a signal something else is wrong.
 */
const MAX_BOOKING_ATTEMPTS = 5;

/**
 * True when the failure is specifically our per-doctor-per-day token collision,
 * which is safe to retry. Any other unique violation is a real error and must
 * not be retried.
 */
function isTokenCollision(error: unknown): boolean {
  if (
    !(error instanceof Prisma.PrismaClientKnownRequestError) ||
    error.code !== "P2002"
  ) {
    return false;
  }

  const meta = error.meta as
    | { target?: unknown; modelName?: string }
    | undefined;

  // `meta.target` names the offending columns under the default engine. The pg
  // driver adapter this project uses omits `target` altogether (it reports only
  // `modelName` plus a wrapped DriverAdapterError) and names the columns in the
  // message text instead — so check target, then the message, then fall back to
  // the model. Appointment's only unique constraint is the token index, so a
  // P2002 on that model is a token collision.
  if (meta?.target !== undefined) {
    return JSON.stringify(meta.target).includes("tokenNumber");
  }
  if (error.message.includes("tokenNumber")) {
    return true;
  }
  return meta?.modelName === "Appointment";
}

/** Raised when the transaction is found to have expired mid-flight. */
class QueueContentionError extends Error {}

/**
 * True when the failure means "this booking ran out of time queueing behind
 * other bookings for the same doctor". That is contention, not a fault, so it
 * deserves a 409 the client can retry rather than a 500 that reads as a crash.
 * Not retried server-side — it has already waited the full timeout.
 *
 * Covers P2028 (Prisma's own expiry error) and our explicit guard, because once
 * an interactive transaction has expired Prisma resolves some calls to `null`
 * instead of throwing.
 */
function isQueueContention(error: unknown): boolean {
  return (
    error instanceof QueueContentionError ||
    (error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2028")
  );
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const page = parseInt(searchParams.get("page") ?? "1");
  const limit = parseInt(searchParams.get("limit") ?? "10");
  const status = searchParams.get("status");

  try {
    let patientId: string | undefined;

    if (session.user.role === "PATIENT") {
      const patient = await prisma.patient.findUnique({
        where: { userId: session.user.id },
      });
      if (!patient) return NextResponse.json({ appointments: [], total: 0 });
      patientId = patient.id;
    }

    const where = {
      ...(patientId && { patientId }),
      ...(status && { status: status as never }),
      deletedAt: null,
    };

    const [appointments, total] = await Promise.all([
      prisma.appointment.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { scheduledAt: "desc" },
        include: {
          doctor: { include: { user: { select: { name: true } }, department: true } },
          department: true,
          queueEntry: true,
        },
      }),
      prisma.appointment.count({ where }),
    ]);

    return NextResponse.json({ appointments, total, page, limit });
  } catch (error) {
    console.error("[GET /appointments]", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.role !== "PATIENT") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const parsed = bookAppointmentSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { doctorId, departmentId, scheduledAt, appointmentType, notes, isEmergency } =
      parsed.data;

    const patient = await prisma.patient.findUnique({
      where: { userId: session.user.id },
    });
    if (!patient) {
      return NextResponse.json({ error: "Patient profile not found" }, { status: 404 });
    }

    const doctor = await prisma.doctor.findUnique({
      where: { id: doctorId },
      include: {
        department: { include: { hospital: { select: { timezone: true } } } },
      },
    });
    if (!doctor) {
      return NextResponse.json({ error: "Doctor not found" }, { status: 404 });
    }

    const scheduledAtInstant = new Date(scheduledAt);

    // Token numbers restart each calendar day in the *hospital's* zone, so the
    // day key is resolved there rather than in UTC or the server's zone.
    const scheduledDate = calendarDateInTimeZone(
      scheduledAtInstant,
      doctor.department.hospital.timezone
    );

    // ---------------------------------------------------------------------
    // AI calls: network I/O with multi-second timeouts. They run BEFORE the
    // transaction opens and are never retried, so no transaction is ever held
    // open across a network round-trip.
    //
    // `advisoryQueueSize` feeds a wait-time *estimate* only. It is read outside
    // the transaction and may be stale by the time we commit; that is
    // acceptable for a prediction. The queue position, which must be exact, is
    // re-read inside the transaction below.
    // ---------------------------------------------------------------------
    const advisoryQueueSize = await prisma.appointment.count({
      where: {
        doctorId,
        scheduledDate,
        status: { in: [...ACTIVE_STATUSES] },
        deletedAt: null,
      },
    });

    const [waitPrediction, noShowRisk] = await Promise.all([
      aiService.predictWaitTime({
        doctorId,
        queueSize: advisoryQueueSize,
        avgConsultMins: doctor.avgConsultMins,
        appointmentType: appointmentType as AppointmentType,
        timeOfDay: scheduledAtInstant.toISOString(),
        emergencyCount: 0,
      }),
      aiService.detectNoShowRisk({
        patientId: patient.id,
        appointmentType: appointmentType as AppointmentType,
        scheduledAt: scheduledAtInstant,
        historicalNoShows: 0,
        totalAppointments: 0,
      }),
    ]);

    // ---------------------------------------------------------------------
    // Booking transaction.
    //
    // Token allocation is a read-modify-write, and two mechanisms guard it —
    // doing different jobs, so both are needed:
    //
    //   1. An advisory lock keyed on doctor+day serialises allocation, so each
    //      caller reads a value that already includes its predecessors. This is
    //      what makes allocation *succeed*. Without it, N concurrent bookings
    //      all read the same MAX and N-1 abort on the unique index; retrying
    //      under that contention is a thundering herd (measured on this route:
    //      5 of 10 bookings exhausted their retries and 409'd).
    //   2. The unique index is the correctness backstop. It holds even if this
    //      code is bypassed, rewritten, or run from a second service, and the
    //      P2002 retry below covers the residual window.
    //
    // Only one lock is taken, so this path cannot deadlock.
    // ---------------------------------------------------------------------
    for (let attempt = 1; attempt <= MAX_BOOKING_ATTEMPTS; attempt++) {
      try {
        const appointment = await prisma.$transaction(
          async (tx) => {
            // Advisory lock rather than `SELECT ... FOR UPDATE` on Doctor: it is
            // keyed on exactly the scope that needs protecting, so a different
            // day or a different doctor never blocks, and it takes no row lock
            // on a business table other writers also update. Transaction-scoped,
            // so it releases on commit or rollback with no unlock bookkeeping —
            // which matters behind a connection pool, where a leaked
            // session-level lock would wedge the connection for later requests.
            //
            // `hashtext` narrows to 32 bits, so distinct doctor+day pairs can
            // collide and serialise against each other. That costs a little
            // throughput and changes no result.
            await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${
              doctorId + ":" + scheduledDate
            }))`;

            // Both reads in one round-trip. The lock is held for the rest of the
            // transaction, so every statement inside it adds to the time other
            // bookings for this doctor spend waiting.
            //
            // MAX, not COUNT, for the token: a count would re-issue a token that
            // a cancelled or deleted appointment already holds, and collide.
            // COUNT of active rows for the position, matching prior behaviour.
            const [tally] = await tx.$queryRaw<
              { max_token: number; active: number }[]
            >`
              SELECT COALESCE(MAX("tokenNumber"), 0)::int AS max_token,
                     COUNT(*) FILTER (
                       WHERE "status" IN ('BOOKED', 'CHECKED_IN', 'IN_CONSULTATION')
                         AND "deletedAt" IS NULL
                     )::int AS active
              FROM "Appointment"
              WHERE "doctorId" = ${doctorId}
                AND "scheduledDate" = ${scheduledDate}
            `;

            const tokenNumber = tally.max_token + 1;
            const activeAhead = tally.active;

            const appt = await tx.appointment.create({
              data: {
                patientId: patient.id,
                doctorId,
                departmentId,
                tokenNumber,
                scheduledAt: scheduledAtInstant,
                scheduledDate,
                appointmentType: appointmentType as AppointmentType,
                notes,
                isEmergency: isEmergency ?? false,
                noShowRisk: noShowRisk.riskScore,
                status: "BOOKED",
              },
              include: {
                doctor: {
                  include: {
                    user: { select: { name: true } },
                    department: true,
                  },
                },
                department: true,
              },
            });

            // Prisma resolves this to `null` rather than throwing when the
            // interactive transaction has already expired while queueing on the
            // lock. Guard it so the caller sees the contention 409 instead of a
            // `Cannot read properties of null` 500.
            if (!appt) {
              throw new QueueContentionError(
                "booking transaction expired before the appointment was created"
              );
            }

            await tx.queueEntry.create({
              data: {
                appointmentId: appt.id,
                doctorId,
                position: activeAhead + 1,
                estimatedWaitMins: waitPrediction.estimatedWaitMins,
                predictionConfidence: waitPrediction.confidence,
                virtualWaitingRoom: waitPrediction.estimatedWaitMins > 30,
              },
            });

            await tx.notification.create({
              data: {
                userId: session.user.id,
                type: "APPOINTMENT_REMINDER",
                title: "Appointment Booked!",
                message: `Token #${tokenNumber} — ${appt.doctor.user.name} (${appt.department.name}). Est. wait: ${waitPrediction.estimatedWaitMins} mins.`,
                metadata: { appointmentId: appt.id, tokenNumber },
              },
            });

            await tx.auditLog.create({
              data: {
                userId: session.user.id,
                action: "BOOK_APPOINTMENT",
                entity: "Appointment",
                entityId: appt.id,
                metadata: { doctorId, departmentId, tokenNumber, scheduledDate },
                ipAddress: req.headers.get("x-forwarded-for") ?? "unknown",
              },
            });

            return appt;
          },
          {
            // Callers queue on the advisory lock, so the transaction has to be
            // allowed to spend time waiting; Prisma's 5s default aborts with
            // P2028 as soon as a few bookings for one doctor overlap.
            //
            // Sizing: the critical section is 6 statements, so its duration is
            // ~6x the database round-trip. Measured at 251ms RTT from a dev
            // machine to Neon us-east-1 that is ~1.5s per booking, and the Nth
            // concurrent booking for the same doctor waits ~1.5s*(N-1). 30s
            // therefore absorbs ~20 simultaneous bookings for one doctor before
            // anyone sees a 409. Co-located with the database (RTT ~1-2ms) the
            // same section is ~12ms and this ceiling is thousands of bookings.
            timeout: 30_000,
            maxWait: 10_000,
          }
        );

        return NextResponse.json(
          { appointment, waitPrediction, noShowRisk },
          { status: 201 }
        );
      } catch (error) {
        if (isQueueContention(error)) {
          console.error(
            `[POST /appointments] transaction timed out waiting on the queue for doctor ${doctorId} on ${scheduledDate}`
          );
          return NextResponse.json(
            {
              error:
                "This doctor's queue is busy right now. Please try again in a moment.",
            },
            { status: 409 }
          );
        }

        if (!isTokenCollision(error)) throw error;

        if (attempt === MAX_BOOKING_ATTEMPTS) {
          console.error(
            `[POST /appointments] token collision persisted for doctor ${doctorId} on ${scheduledDate} after ${MAX_BOOKING_ATTEMPTS} attempts`
          );
          return NextResponse.json(
            {
              error:
                "This doctor's queue is being updated by other bookings. Please try again.",
            },
            { status: 409 }
          );
        }

        // Short jittered pause so simultaneous retries do not re-collide in
        // lockstep.
        await new Promise((resolve) =>
          setTimeout(resolve, 10 * attempt + Math.random() * 15)
        );
      }
    }

    // Unreachable: the loop either returns or throws.
    return NextResponse.json({ error: "Booking failed" }, { status: 500 });
  } catch (error) {
    console.error("[POST /appointments]", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
