import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { bookAppointmentSchema } from "@/lib/validations";
import { aiService } from "@/features/ai/ai.service";
import { calendarDateInTimeZone } from "@/lib/date";
import { AppointmentStatus, AppointmentType, Prisma } from "@prisma/client";
import { resolveActorDoctorId, resolveActorHospitalId } from "@/lib/ownership";

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
 * Returned for both the pre-check and the index rejection, so a patient sees
 * the same message whichever one caught them.
 */
const DUPLICATE_BOOKING_MESSAGE =
  "You already have an appointment with this doctor today";

/** Index names, so a P2002 can be attributed to the right constraint. */
const TOKEN_INDEX = "Appointment_doctorId_scheduledDate_tokenNumber_key";
const DUPLICATE_BOOKING_INDEX = "Appointment_patient_doctor_day_active_key";

/**
 * Which of Appointment's two unique constraints a P2002 came from, or `null`
 * when the error is not a unique violation we recognise.
 *
 *   "token"     — two bookings raced for the same token number. Retryable:
 *                 re-reading MAX(tokenNumber) yields a fresh candidate.
 *   "duplicate" — this patient already has a live appointment with this doctor
 *                 today. Not retryable; retrying can only fail the same way.
 *
 * Attribution has to be by *name*. Appointment used to have one unique
 * constraint, so an unattributable P2002 on the model could safely be assumed
 * to be the token index; the partial unique index added in
 * 20260808120000_prevent_duplicate_active_bookings ended that. Keeping the old
 * `modelName === "Appointment"` fallback would classify a duplicate-booking
 * rejection as a token collision, retry it five times, and return a 409 blaming
 * queue contention for a mistake the user can actually fix.
 */
function classifyBookingConflict(
  error: unknown
): "token" | "duplicate" | null {
  if (
    !(error instanceof Prisma.PrismaClientKnownRequestError) ||
    error.code !== "P2002"
  ) {
    return null;
  }

  // Deliberately searches `error.meta` only, never `error.message`. Prisma
  // inlines a snippet of the *calling source file* into the message, and the
  // `create()` call below mentions both `tokenNumber` and `patientId` — so
  // matching column names against the message would classify by what this file
  // happens to look like rather than by which constraint actually fired.
  const meta = JSON.stringify(error.meta ?? null);

  // With the pg driver adapter this project uses, `meta` carries the raw
  // Postgres error at `driverAdapterError.cause.originalMessage`:
  //   duplicate key value violates unique constraint "<index name>"
  // The index name is unambiguous, so it is tried first.
  if (meta.includes(DUPLICATE_BOOKING_INDEX)) return "duplicate";
  if (meta.includes(TOKEN_INDEX)) return "token";

  // Fallback for the default query engine, which reports `meta.target` as a
  // bare column list with no index name. The two constraints differ in whether
  // tokenNumber is part of the key, so that is enough to tell them apart.
  if (meta.includes("tokenNumber")) return "token";
  if (meta.includes("patientId")) return "duplicate";

  // A unique violation on Appointment matching neither. Retrying blind is what
  // the old `modelName === "Appointment"` fallback did, and it is exactly how a
  // duplicate booking would get misreported. Surface it instead.
  return null;
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
    // ── Scope ────────────────────────────────────────────────────────────
    // Only the PATIENT branch existed. `patientId` stayed `undefined` for
    // every other role, so the spread below contributed nothing and the whole
    // filter collapsed to `{ deletedAt: null }` — any doctor or admin session
    // paged through every appointment in the database, across all hospitals,
    // with patient ids, notes and no-show risk scores attached. A role check
    // was never performed here at all; being signed in was the only test.
    //
    // Each role now resolves its own scope from the session, through the same
    // helpers the ownership-checked handlers use. An empty result is returned
    // rather than a 404 because this is a list endpoint: "you have no
    // appointments" and "you have no profile" are the same answer to the
    // caller, and neither confirms anything about ids that exist.
    const empty = NextResponse.json({ appointments: [], total: 0, page, limit });

    let scope: Prisma.AppointmentWhereInput;

    switch (session.user.role) {
      case "PATIENT": {
        const patient = await prisma.patient.findUnique({
          where: { userId: session.user.id },
          select: { id: true },
        });
        if (!patient) return empty;
        scope = { patientId: patient.id };
        break;
      }

      case "DOCTOR": {
        const doctorId = await resolveActorDoctorId(session.user.id);
        if (!doctorId) return empty;
        scope = { doctorId };
        break;
      }

      case "ADMIN": {
        const hospitalId = await resolveActorHospitalId(session.user.id);
        if (!hospitalId) return empty;
        // Appointment has no hospitalId; it hangs off the department. Same
        // relation filter as GET /api/admin/analytics.
        scope = { department: { hospitalId } };
        break;
      }

      default:
        return empty;
    }

    const where: Prisma.AppointmentWhereInput = {
      ...scope,
      ...(status && { status: status as AppointmentStatus }),
      deletedAt: null,
    };

    const [appointments, total] = await Promise.all([
      prisma.appointment.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { scheduledAt: "desc" },
        include: {
          // `patient` was missing entirely. app/doctor/appointments/page.tsx
          // renders `appt.patient.user.name` for every row, so `patient` came
          // back undefined and the page threw on first render — the reported
          // "doctor appointments not loading". Patient-facing callers never hit
          // it because they only read the doctor side of the same payload.
          patient: { include: { user: { select: { name: true, email: true } } } },
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
    // Duplicate-booking pre-check.
    //
    // Purely an optimisation. The authoritative guard is the partial unique
    // index `Appointment_patient_doctor_day_active_key`, which holds even if
    // this query is racing a concurrent booking that has not committed yet.
    // Checking here first means the overwhelmingly common case — a patient
    // re-submitting a form they already submitted — costs one indexed SELECT
    // instead of two AI round-trips followed by a transaction that queues on
    // the doctor's advisory lock only to be rejected on insert.
    // ---------------------------------------------------------------------
    const existingBooking = await prisma.appointment.findFirst({
      where: {
        patientId: patient.id,
        doctorId,
        scheduledDate,
        status: { in: [...ACTIVE_STATUSES] },
        deletedAt: null,
      },
      select: { id: true },
    });

    if (existingBooking) {
      return NextResponse.json(
        { error: DUPLICATE_BOOKING_MESSAGE },
        { status: 409 }
      );
    }

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
    //      what makes allocation *succeed*. Without it, concurrent bookings all
    //      read the same MAX, all but one abort on the unique index, and the
    //      retries go on to fight over the same value.
    //
    //      Re-runnable, rather than asserted: scripts/measure-booking-
    //      contention.ts performs the same read-MAX/insert against a scratch
    //      table, with the lock off and then on.
    //
    //        Dev machine (India) -> Neon us-east-1, 20 RTT samples.
    //          RTT: median 306ms, min 225ms, max 2567ms.
    //          10 concurrent token allocations, advisory lock OFF:
    //            1 committed, 9 unique conflicts, 1518ms wall clock.
    //          10 concurrent token allocations, advisory lock ON:
    //            10 committed, 0 conflicts, 9214ms wall clock.
    //
    //      Read those two wall-clock numbers carefully, because the obvious
    //      reading of both is wrong.
    //
    //      The lock-off run finished in a sixth of the time because it failed.
    //      Nine of the ten allocations aborted on the unique index, and an
    //      abort returns as soon as the index rejects the insert — there is no
    //      commit to wait for and no work after it. 1518ms is the cost of one
    //      booking plus nine fast rejections. Fast failure is not throughput,
    //      and the correct comparison between the runs is 1 committed versus
    //      10, not 1518ms versus 9214ms.
    //
    //      The lock-on run's 9214ms is dominated by the link, not by the lock.
    //      ~921ms per booking against a ~306ms median RTT is about three round
    //      trips inside the probe's critical section, which is what serialising
    //      ten of them costs from a laptop in India talking to us-east-1. It is
    //      not a statement that this system books ten patients in nine seconds:
    //      co-located with the database the same serialised path is single-digit
    //      milliseconds per booking. The figure measures the distance to the
    //      database, and the lock's job is only to make the ten of them queue
    //      instead of collide.
    //
    //      Those figures move with latency and concurrency — re-run the script
    //      for your own environment rather than trusting these.
    //   2. The unique index is the correctness backstop. It holds even if this
    //      code is bypassed, rewritten, or run from a second service, and the
    //      P2002 retry below covers the residual window.
    //
    // The duplicate-booking index guards a different thing and needs no lock of
    // its own: (patientId, doctorId, scheduledDate) are all known before the
    // transaction opens, so there is no read-modify-write to serialise. The
    // index alone decides that race, and the loser is rejected outright rather
    // than retried.
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
            // roughly 6x the database round-trip.
            // scripts/measure-booking-contention.ts prints the round-trip it
            // measures; last run from a dev machine to Neon us-east-1 it
            // reported a 306ms median, i.e. ~1.8s per booking, so the Nth
            // concurrent booking for the same doctor waits ~1.8s*(N-1) and 30s
            // absorbs roughly 16 of them before anyone sees a 409. Co-located
            // with the database the round-trip is a couple of milliseconds and
            // that ceiling is far higher; on a slower link it is lower. Re-run
            // the script rather than assuming this number holds for you.
            //
            // KNOWN FLAW IN THE SIZING ABOVE. That "~16 concurrent bookings"
            // is derived from the *median* round-trip, and a median is the
            // wrong statistic for a capacity ceiling. The same 20-sample run
            // recorded a max round-trip of 2567ms — 8.4x the median. Six
            // statements at the tail rate is a ~15s critical section, so 30s
            // absorbs about **two** concurrent bookings for one doctor, not
            // sixteen. The real ceiling is therefore an order of magnitude
            // below the number this comment used to state, and a single doctor
            // with three patients booking at once is enough to reach it. Nobody
            // sized this against the tail; the median was used because it was
            // the figure the script printed.
            //
            // Hypothesis, not a finding, for where a 2567ms round-trip comes
            // from: Neon autosuspends an idle branch, and the first query after
            // a suspension pays the cold start. That would explain a single
            // extreme sample in an otherwise 225-306ms distribution better than
            // ordinary jitter does. It has not been confirmed — no correlation
            // was checked between the slow sample and the branch's idle time,
            // and until it is, a link that is simply occasionally that bad is
            // equally consistent with the data.
            //
            // The fix, deliberately NOT applied here: either shorten the
            // critical section so fewer round-trips sit inside the transaction
            // (the two reads are already merged; the create/create/create tail
            // is what remains), or size the timeout against a measured p99
            // rather than a median. Both are real changes with their own
            // trade-offs, and raising the timeout to cover the tail would just
            // convert a 409 into a longer hang. Documenting the limitation is
            // the point; a change here would hide it.
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

        const conflict = classifyBookingConflict(error);

        // The pre-check above already returned 409 for the common case, so
        // reaching here means a concurrent booking committed between that
        // SELECT and this INSERT. The index caught it. Return immediately —
        // retrying re-inserts the same three values and fails identically.
        if (conflict === "duplicate") {
          return NextResponse.json(
            { error: DUPLICATE_BOOKING_MESSAGE },
            { status: 409 }
          );
        }

        if (conflict !== "token") throw error;

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
