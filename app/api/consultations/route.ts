import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/consultations
 * Body: { appointmentId, action: "start" | "end", notes?: string }
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.role !== "DOCTOR") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { appointmentId, action, notes } = body as {
      appointmentId: string;
      action: "start" | "end";
      notes?: string;
    };

    if (!appointmentId || !action) {
      return NextResponse.json({ error: "appointmentId and action required" }, { status: 400 });
    }

    const appointment = await prisma.appointment.findUnique({
      where: { id: appointmentId },
      include: { doctor: true },
    });

    if (!appointment) {
      return NextResponse.json({ error: "Appointment not found" }, { status: 404 });
    }

    // Verify doctor owns this appointment
    if (appointment.doctor.userId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (action === "start") {
      // Mark as IN_CONSULTATION and create/upsert ConsultationLog
      const [updated, log] = await prisma.$transaction([
        prisma.appointment.update({
          where: { id: appointmentId },
          data: { status: "IN_CONSULTATION", checkedInAt: new Date() },
        }),
        prisma.consultationLog.upsert({
          where: { appointmentId },
          create: {
            appointmentId,
            doctorId: appointment.doctorId,
            startedAt: new Date(),
          },
          update: { startedAt: new Date(), endedAt: null, durationMins: null },
        }),
      ]);
      return NextResponse.json({ appointment: updated, consultationLog: log });
    }

    if (action === "end") {
      const log = await prisma.consultationLog.findUnique({ where: { appointmentId } });
      const startedAt = log?.startedAt ?? new Date();
      const endedAt = new Date();
      const durationMins = (endedAt.getTime() - startedAt.getTime()) / 60000;

      const [updated, updatedLog] = await prisma.$transaction([
        prisma.appointment.update({
          where: { id: appointmentId },
          data: { status: "COMPLETED", completedAt: endedAt },
        }),
        prisma.consultationLog.upsert({
          where: { appointmentId },
          create: {
            appointmentId,
            doctorId: appointment.doctorId,
            startedAt,
            endedAt,
            durationMins,
            notes: notes ?? null,
          },
          update: { endedAt, durationMins, notes: notes ?? null },
        }),
      ]);

      // Update doctor avgConsultMins with exponential moving average
      const alpha = 0.2;
      const newAvg = alpha * durationMins + (1 - alpha) * (appointment.doctor.avgConsultMins ?? durationMins);
      await prisma.doctor.update({
        where: { id: appointment.doctorId },
        data: { avgConsultMins: Math.round(newAvg * 10) / 10 },
      });

      return NextResponse.json({ appointment: updated, consultationLog: updatedLog, durationMins });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error("[POST /api/consultations]", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
