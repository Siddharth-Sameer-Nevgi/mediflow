import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getQueuePosition } from "@/features/queue/queue.repository";
import { prisma } from "@/lib/prisma";
import { findOwnedAppointment } from "@/lib/ownership";

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

    // Prevents: enumerating appointment ids to read strangers' queue positions,
    // wait times and token numbers. The socket layer already blocks precisely
    // this — `patient:join` verifies the appointment belongs to the caller
    // before joining `appointment:<id>` (server/socket-server.ts) — so the two
    // paths to the same data now enforce the same rule instead of the HTTP one
    // being the way around the socket one.
    const appointment = await findOwnedAppointment(appointmentId, {
      id: session.user.id,
      role: session.user.role,
    });

    if (!appointment) {
      // 404 whether the row is missing or simply not the caller's, so the
      // endpoint cannot be used to test which ids exist.
      return NextResponse.json({ error: "Not found" }, { status: 404 });
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
