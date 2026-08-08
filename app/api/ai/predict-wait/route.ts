import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { aiService } from "@/features/ai/ai.service";
import { predictWaitSchema } from "@/lib/validations";
import { prisma } from "@/lib/prisma";
import { AppointmentType } from "@prisma/client";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const parsed = predictWaitSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { doctorId, appointmentType } = parsed.data;

    const doctor = await prisma.doctor.findUnique({
      where: { id: doctorId },
      include: {
        _count: {
          select: {
            appointments: {
              where: {
                status: { in: ["BOOKED", "CHECKED_IN", "IN_CONSULTATION"] },
              },
            },
          },
        },
      },
    });

    if (!doctor) {
      return NextResponse.json({ error: "Doctor not found" }, { status: 404 });
    }

    const emergencyCount = await prisma.appointment.count({
      where: {
        doctorId,
        isEmergency: true,
        status: { in: ["BOOKED", "CHECKED_IN"] },
      },
    });

    const result = await aiService.predictWaitTime({
      doctorId,
      queueSize: doctor._count.appointments,
      avgConsultMins: doctor.avgConsultMins,
      appointmentType: appointmentType as AppointmentType,
      timeOfDay: new Date().toISOString(),
      emergencyCount,
    });

    // ── Why `breakdown` is dropped ────────────────────────────────────────
    // This route takes an arbitrary `doctorId` from the body and, until now,
    // returned `breakdown` alongside the estimate. `breakdown.baseWait` is
    // `queueSize * avgConsultMins` and `breakdown.emergencyPremium` is
    // `emergencyCount * avgConsultMins * 1.5` — identical arithmetic in both
    // providers, so which one is live changes nothing
    // (features/ai/mock.provider.ts, features/ai/gemini.provider.ts; Gemini
    // only refines `confidence` and applies a ±10 min correction, passing
    // `breakdown` through untouched).
    // `avgConsultMins` is published per doctor by GET /api/doctors, so both
    // divide straight back out: the response handed the caller a named
    // doctor's live active-appointment count and live emergency count. That is
    // the same data GET /api/queue/[doctorId] now refuses to anyone but that
    // doctor and their hospital's admin — reachable by a second route, which
    // makes the ownership check there decorative.
    //
    // Of the two fixes offered, this is the estimate-without-the-count one
    // rather than requiring an existing appointment with the doctor. Requiring
    // one would break the only caller: app/patient/book/page.tsx calls this
    // while the patient is still *choosing* a doctor, before any appointment
    // exists, precisely so they can compare waits. An ownership rule that
    // fails on the endpoint's sole legitimate use is not a rule, it is a
    // removal.
    //
    // The estimate itself stays public-to-signed-in-users on purpose. A number
    // of minutes is what the patient is here for, and it is lossy: the same
    // ~45 min covers many combinations of queue size, appointment type and
    // emergencies. `breakdown` was the part that inverted cleanly, so that is
    // the part that goes. No frontend reads it — the book page's
    // `WaitPrediction` type is `{ estimatedWaitMins, confidence }`.
    //
    // Residual, accepted: the estimate is still a coarse channel. Someone
    // polling one doctor can watch it step by `avgConsultMins` and infer queue
    // movement. Closing that means not answering the question the endpoint
    // exists to answer.
    return NextResponse.json({
      estimatedWaitMins: result.estimatedWaitMins,
      confidence: result.confidence,
    });
  } catch (error) {
    console.error("[POST /ai/predict-wait]", error);
    return NextResponse.json({ error: "AI service error" }, { status: 500 });
  }
}
