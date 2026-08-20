import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { callNextPatient } from "@/features/queue/queue.service";
import { emitQueueEvents, type QueueEvent } from "@/lib/socket-emit";
import { resolveActorDoctorId } from "@/lib/ownership";

export async function POST() {
  const session = await auth();
  if (!session?.user || session.user.role !== "DOCTOR") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // The request body is not read at all, and `doctorId` is no longer part of
    // `callNextSchema` — the schema had no other field, so it is gone with it.
    //
    // Prevents: any signed-in doctor driving any *other* doctor's queue. The id
    // used to arrive in the body and go straight into callNextPatient(), so one
    // request completed a stranger's active consultation, promoted their next
    // patient into the room, and renumbered their whole queue. Validating that
    // body field would not have helped; a well-formed cuid was exactly the
    // attack. An id the server can derive from the session must not be
    // accepted from the client at all.
    const doctorId = await resolveActorDoctorId(session.user.id);

    if (!doctorId) {
      // A DOCTOR-role account with no Doctor row. 404 like every other
      // "nothing here for you" — see lib/ownership.ts.
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // `session.user.id` is the User id the audit row needs; `doctorId` above is
    // the Doctor id the queue is keyed on. Both are required — see
    // callNextPatient.
    const result = await callNextPatient(doctorId, session.user.id);

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
