import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { callNextPatient } from "@/features/queue/queue.service";
import { emitQueueEvents, type QueueEvent } from "@/lib/socket-emit";
import { callNextSchema } from "@/lib/validations";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.role !== "DOCTOR") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const parsed = callNextSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    const { doctorId } = parsed.data;
    const result = await callNextPatient(doctorId);

    // Emitted after callNextPatient's transaction has committed, never inside
    // it: a rolled-back transaction must not leave clients told about a change
    // that did not happen.
    const events: QueueEvent[] = [];

    // Notify the called patient their turn has arrived
    if (result.calledAppointmentId) {
      events.push({
        event: "your_turn_approaching",
        room: `appointment:${result.calledAppointmentId}`,
        data: { appointmentId: result.calledAppointmentId },
      });
    }

    // Tell each patient still waiting what their new position is
    for (const entry of result.resequenced) {
      events.push({
        event: "position:changed",
        room: `patient:${entry.patientId}`,
        data: {
          appointmentId: entry.appointmentId,
          newPosition: entry.position,
          estimatedWaitMins: entry.estimatedWaitMins,
        },
      });
    }

    // Notify all patients in queue that positions shifted
    events.push({
      event: "queue:updated",
      room: `doctor:${doctorId}`,
      data: { doctorId, action: "call_next" },
    });

    await emitQueueEvents(events);

    return NextResponse.json(result);
  } catch (error) {
    console.error("[POST /queue/call-next]", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
