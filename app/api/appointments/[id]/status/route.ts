import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { updateAppointmentStatusSchema } from "@/lib/validations";
import {
  deactivateQueueEntry,
  resequenceQueue,
  type ResequencedEntry,
} from "@/features/queue/queue.service";
import { emitQueueEvents, type QueueEvent } from "@/lib/socket-emit";
import { findOwnedAppointment } from "@/lib/ownership";

/**
 * Statuses a cancellation may not act on. `COMPLETED` and `CANCELLED` are
 * terminal; `IN_CONSULTATION` means the patient is in the room, and cancelling
 * them from a phone would strand the doctor's open ConsultationLog.
 */
const UNCANCELLABLE = ["COMPLETED", "CANCELLED", "IN_CONSULTATION"] as const;

/** Status changes that remove a patient from the queue, leaving it stale. */
const QUEUE_REMOVING = ["NO_SHOW", "CANCELLED"] as const;

/**
 * Events for a queue that has just been renumbered.
 *
 * Each patient is told their own new position in their own room; the doctor
 * gets one queue-wide event. `position:changed` and the `patient:<id>` /
 * `doctor:<id>` room names are the ones the socket server and
 * hooks/useRealtimeNotifications.ts already speak.
 */
function queueEvents(
  doctorId: string,
  resequenced: ResequencedEntry[],
  action: string
): QueueEvent[] {
  const events: QueueEvent[] = resequenced.map((entry) => ({
    event: "position:changed",
    room: `patient:${entry.patientId}`,
    data: {
      appointmentId: entry.appointmentId,
      newPosition: entry.position,
      estimatedWaitMins: entry.estimatedWaitMins,
    },
  }));

  events.push({
    event: "queue:updated",
    room: `doctor:${doctorId}`,
    data: { doctorId, action },
  });

  return events;
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user || session.user.role !== "DOCTOR") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const body = await req.json();
    const parsed = updateAppointmentStatusSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }

    const { status } = parsed.data;

    // Role alone was never enough here: it authorises *a* doctor, not *this*
    // appointment's doctor. See findOwnedAppointment.
    const appointment = await findOwnedAppointment(id, {
      id: session.user.id,
      role: session.user.role,
    });

    if (!appointment) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const removesFromQueue = (QUEUE_REMOVING as readonly string[]).includes(
      status
    );

    const { updated, resequenced } = await prisma.$transaction(async (tx) => {
      const updated = await tx.appointment.update({
        where: { id },
        data: {
          status,
          ...(status === "COMPLETED" && { completedAt: new Date() }),
          ...(status === "CHECKED_IN" && { checkedInAt: new Date() }),
        },
      });

      // The audit row is written in the same transaction as the mutation it
      // describes. Trade-off: the audit trail now shares the mutation's fate —
      // if the log insert fails, the status change rolls back with it, so a
      // logging fault can refuse a legitimate clinical action. That is the right
      // way round. The alternative (the old code's) is a status change that
      // committed with no record of who made it, which is indistinguishable
      // afterwards from an unauthorised one. An unloggable mutation should not
      // happen; a logged rollback is merely an outage.
      await tx.auditLog.create({
        data: {
          userId: session.user.id,
          action: `STATUS_CHANGE_${status}`,
          entity: "Appointment",
          entityId: id,
          metadata: { status, role: session.user.role },
        },
      });

      if (!removesFromQueue) {
        return { updated, resequenced: [] as ResequencedEntry[] };
      }

      // A no-show or cancellation vacates a slot in the middle of the queue.
      // Without this every position behind it stays stale and is served to
      // clients as if it were current.
      await deactivateQueueEntry(tx, id);
      const resequenced = await resequenceQueue(
        tx,
        appointment.doctorId,
        appointment.scheduledDate
      );

      return { updated, resequenced };
    });

    // Emitted only after the transaction has committed, never inside it. An
    // emit from inside would fire on work that can still roll back, leaving
    // every client in the queue told about a renumbering the database never
    // kept — and unlike a database write, an event cannot be un-sent.
    if (removesFromQueue) {
      await emitQueueEvents(
        queueEvents(appointment.doctorId, resequenced, status.toLowerCase())
      );
    }

    return NextResponse.json({ appointment: updated });
  } catch (error) {
    console.error("[PATCH /appointments/:id/status]", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;

    // Being signed in was the *only* check this handler used to make. Any
    // patient could cancel any appointment in the hospital by id.
    const appointment = await findOwnedAppointment(id, {
      id: session.user.id,
      role: session.user.role,
    });

    if (!appointment) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    if (appointment.deletedAt) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    if ((UNCANCELLABLE as readonly string[]).includes(appointment.status)) {
      return NextResponse.json(
        {
          error: `Cannot cancel an appointment that is ${appointment.status.toLowerCase()}`,
        },
        { status: 409 }
      );
    }

    const resequenced = await prisma.$transaction(async (tx) => {
      // Soft delete
      await tx.appointment.update({
        where: { id },
        data: { deletedAt: new Date(), status: "CANCELLED" },
      });

      // Cancellation is the more sensitive of this file's two actions and was
      // the only one writing no audit row. Recorded inside the transaction for
      // the reason spelled out in PATCH above.
      await tx.auditLog.create({
        data: {
          userId: session.user.id,
          action: "CANCEL_APPOINTMENT",
          entity: "Appointment",
          entityId: id,
          metadata: {
            role: session.user.role,
            doctorId: appointment.doctorId,
            patientId: appointment.patientId,
            previousStatus: appointment.status,
          },
          ipAddress: req.headers.get("x-forwarded-for") ?? "unknown",
        },
      });

      await deactivateQueueEntry(tx, id);

      // Same transaction as the soft delete: the queue must never be observable
      // with the cancelled patient removed but the positions behind them
      // un-renumbered.
      return resequenceQueue(
        tx,
        appointment.doctorId,
        appointment.scheduledDate
      );
    });

    // After the commit — see the comment in PATCH.
    await emitQueueEvents(
      queueEvents(appointment.doctorId, resequenced, "cancelled")
    );

    return NextResponse.json({ message: "Appointment cancelled" });
  } catch (error) {
    console.error("[DELETE /appointments/:id]", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
