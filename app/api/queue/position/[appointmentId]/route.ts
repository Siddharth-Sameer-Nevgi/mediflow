import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getQueuePosition } from "@/features/queue/queue.repository";
import { prisma } from "@/lib/prisma";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ appointmentId: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { appointmentId } = await params;
    
    const appointment = await prisma.appointment.findUnique({
      where: { id: appointmentId },
      include: { doctor: true },
    });

    if (!appointment) {
      return NextResponse.json({ error: "Appointment not found" }, { status: 404 });
    }

    const position = await getQueuePosition(appointmentId);
    
    // Get total in queue
    const totalInQueue = await prisma.queueEntry.count({
      where: {
        doctorId: appointment.doctorId,
        appointment: { status: { in: ["BOOKED", "CHECKED_IN", "IN_CONSULTATION"] } },
      },
    });

    const patientsAhead = position ? position.position - 1 : 0;

    return NextResponse.json({
      position: position?.position ?? 0,
      patientsAhead,
      estimatedWaitMins: position?.estimatedWaitMins ?? 0,
      confidence: position?.confidence ?? 0.7,
      showVirtualWaiting: (position?.estimatedWaitMins ?? 0) > 30,
      totalInQueue,
      tokenNumber: appointment.tokenNumber,
    });
  } catch (error) {
    console.error("[GET /queue/position/:appointmentId]", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
