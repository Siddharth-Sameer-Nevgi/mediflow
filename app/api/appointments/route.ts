import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { bookAppointmentSchema } from "@/lib/validations";
import { aiService } from "@/features/ai/ai.service";
import { AppointmentType } from "@prisma/client";

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
      include: { _count: { select: { appointments: { where: { status: { in: ["BOOKED", "CHECKED_IN", "IN_CONSULTATION"] } } } } } },
    });
    if (!doctor) {
      return NextResponse.json({ error: "Doctor not found" }, { status: 404 });
    }

    // Get current queue size for wait prediction
    const currentQueueSize = doctor._count.appointments;

    // AI wait time prediction
    const waitPrediction = await aiService.predictWaitTime({
      doctorId,
      queueSize: currentQueueSize,
      avgConsultMins: doctor.avgConsultMins,
      appointmentType: appointmentType as AppointmentType,
      timeOfDay: new Date(scheduledAt).toISOString(),
      emergencyCount: 0,
    });

    // AI no-show risk
    const noShowRisk = await aiService.detectNoShowRisk({
      patientId: patient.id,
      appointmentType: appointmentType as AppointmentType,
      scheduledAt: new Date(scheduledAt),
      historicalNoShows: 0,
      totalAppointments: 0,
    });

    // Generate token number
    const tokenNumber = currentQueueSize + 1;

    // Create appointment + queue entry in a transaction
    const appointment = await prisma.$transaction(async (tx) => {
      const appt = await tx.appointment.create({
        data: {
          patientId: patient.id,
          doctorId,
          departmentId,
          tokenNumber,
          scheduledAt: new Date(scheduledAt),
          appointmentType: appointmentType as AppointmentType,
          notes,
          isEmergency: isEmergency ?? false,
          noShowRisk: noShowRisk.riskScore,
          status: "BOOKED",
        },
        include: {
          doctor: { include: { user: { select: { name: true } }, department: true } },
          department: true,
        },
      });

      // Create queue entry
      await tx.queueEntry.create({
        data: {
          appointmentId: appt.id,
          doctorId,
          position: currentQueueSize + 1,
          estimatedWaitMins: waitPrediction.estimatedWaitMins,
          predictionConfidence: waitPrediction.confidence,
          virtualWaitingRoom: waitPrediction.estimatedWaitMins > 30,
        },
      });

      // Notification for patient
      await tx.notification.create({
        data: {
          userId: session.user.id,
          type: "APPOINTMENT_REMINDER",
          title: "Appointment Booked!",
          message: `Token #${tokenNumber} — ${appt.doctor.user.name} (${appt.department.name}). Est. wait: ${waitPrediction.estimatedWaitMins} mins.`,
          metadata: { appointmentId: appt.id, tokenNumber },
        },
      });

      // Audit log
      await tx.auditLog.create({
        data: {
          userId: session.user.id,
          action: "BOOK_APPOINTMENT",
          entity: "Appointment",
          entityId: appt.id,
          metadata: { doctorId, departmentId, tokenNumber },
          ipAddress: req.headers.get("x-forwarded-for") ?? "unknown",
        },
      });

      return appt;
    });

    return NextResponse.json({
      appointment,
      waitPrediction,
      noShowRisk,
    }, { status: 201 });
  } catch (error) {
    console.error("[POST /appointments]", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
