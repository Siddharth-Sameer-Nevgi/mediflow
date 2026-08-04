import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { aiService } from "@/features/ai/ai.service";
import { predictWaitSchema } from "@/lib/validations";
import { prisma } from "@/lib/prisma";
import { AppointmentType } from "@prisma/client";

export async function POST(req: NextRequest) {
  const session = await getSessionUser();
  if (!session) {
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

    return NextResponse.json(result);
  } catch (error) {
    console.error("[POST /ai/predict-wait]", error);
    return NextResponse.json({ error: "AI service error" }, { status: 500 });
  }
}
