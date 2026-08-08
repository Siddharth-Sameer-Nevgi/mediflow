import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getQueueByDoctor } from "./queue.repository";
import { QueueEntryWithPatient } from "./queue.types";

/**
 * Statuses that mean "still waiting to be called". Queue membership is defined
 * by the *appointment's* status, not by anything on QueueEntry — see
 * resequenceQueue below for why.
 */
const WAITING_STATUSES = ["BOOKED", "CHECKED_IN"] as const;

/** Fallback when a doctor row cannot be read (should not happen in practice). */
const DEFAULT_CONSULT_MINS = 15;

/** One row of the queue after renumbering, enough to notify its owner. */
export interface ResequencedEntry {
  appointmentId: string;
  /** `Patient.id` — the socket room key, not `User.id`. */
  patientId: string;
  position: number;
  estimatedWaitMins: number;
}

/**
 * Renumber a doctor's queue for one day so positions are contiguous and the
 * wait estimates that hang off them are consistent.
 *
 * The single implementation. `QueueEntry.position` is written once at booking
 * time (`activeAhead + 1`), so anything that removes a row from the middle of a
 * queue — call-next, cancellation, no-show — leaves every position behind it
 * stale, and the API then serves those stale numbers as if they were correct.
 * Every such path must end in a call to this function, inside the same
 * transaction as the change that made the queue stale.
 *
 * Exclusion is by joined `Appointment.status`, because **QueueEntry has no
 * status, `isActive` or `deletedAt` column** (prisma/schema.prisma). That is not
 * a workaround: it is how queue membership is already defined by every read in
 * this codebase (`getQueueByDoctor`, `getNextInQueue`). Setting the appointment
 * to `CANCELLED` / `NO_SHOW` is therefore exactly what "mark the QueueEntry
 * inactive" means here, and it keeps one source of truth rather than two that
 * can disagree. `deletedAt: null` is included too, so a soft-deleted row cannot
 * hold a position — the old queries filtered on status alone and would have
 * counted one.
 *
 * Scoped to `scheduledDate` because booking assigns positions per doctor *per
 * day* (see the `COUNT(*) FILTER` in app/api/appointments/route.ts). Renumbering
 * across all days would fold tomorrow's patients into today's sequence.
 *
 * @param tx Transaction client — this must not run outside a transaction, or a
 *   concurrent reader can observe duplicate or skipped positions mid-rewrite.
 * @returns The renumbered rows in their new order, so the caller can emit
 *   position updates *after* the transaction commits.
 */
export async function resequenceQueue(
  tx: Prisma.TransactionClient,
  doctorId: string,
  scheduledDate: string
): Promise<ResequencedEntry[]> {
  const waiting = await tx.queueEntry.findMany({
    where: {
      doctorId,
      appointment: {
        status: { in: [...WAITING_STATUSES] },
        deletedAt: null,
        scheduledDate,
      },
    },
    // Emergencies first, then existing order — the same ordering the emergency
    // override and call-next already used, so renumbering never reshuffles a
    // queue that was already correct.
    orderBy: [{ appointment: { isEmergency: "desc" } }, { position: "asc" }],
    include: { appointment: { select: { patientId: true } } },
  });

  // Position 1 belongs to whoever is in the consulting room, so the waiting
  // list starts at 2 while a consultation is in progress. Derived rather than
  // passed in, so callers cannot disagree about it: call-next flips the next
  // patient to IN_CONSULTATION before calling here and gets 2..n, while a
  // cancellation with nobody in the room gets 1..n.
  const inConsultation = await tx.appointment.count({
    where: { doctorId, scheduledDate, status: "IN_CONSULTATION", deletedAt: null },
  });
  const startPosition = inConsultation > 0 ? 2 : 1;

  const doctor = await tx.doctor.findUnique({
    where: { id: doctorId },
    select: { avgConsultMins: true },
  });
  const avgConsultMins = doctor?.avgConsultMins ?? DEFAULT_CONSULT_MINS;

  const resequenced: ResequencedEntry[] = [];

  for (let i = 0; i < waiting.length; i++) {
    const position = startPosition + i;
    // Everyone ahead of you has to be seen first; position 1 waits for nobody.
    const estimatedWaitMins = (position - 1) * avgConsultMins;

    await tx.queueEntry.update({
      where: { id: waiting[i].id },
      data: {
        position,
        estimatedWaitMins,
        virtualWaitingRoom: estimatedWaitMins > 30,
      },
    });

    resequenced.push({
      appointmentId: waiting[i].appointmentId,
      patientId: waiting[i].appointment.patientId,
      position,
      estimatedWaitMins,
    });
  }

  return resequenced;
}

/**
 * Retire a queue entry whose appointment is leaving the queue.
 *
 * The row itself stays — it is the historical record of where the patient stood
 * — but its derived fields are zeroed so nothing can serve a stale wait
 * estimate for a cancelled appointment. Exclusion from the live queue comes
 * from the appointment's status, which the caller must already have set; see
 * resequenceQueue for why the schema leaves no other option.
 */
export async function deactivateQueueEntry(
  tx: Prisma.TransactionClient,
  appointmentId: string
): Promise<void> {
  await tx.queueEntry.updateMany({
    where: { appointmentId },
    data: { estimatedWaitMins: 0, virtualWaitingRoom: false },
  });
}

/**
 * Call next patient in queue. Marks current IN_CONSULTATION as COMPLETED,
 * moves next BOOKED/CHECKED_IN to IN_CONSULTATION, recalculates positions.
 */
export async function callNextPatient(doctorId: string): Promise<{
  calledAppointmentId: string | null;
  updatedQueue: QueueEntryWithPatient[];
  resequenced: ResequencedEntry[];
}> {
  return prisma.$transaction(async (tx) => {
    // Complete any currently active consultation
    await tx.appointment.updateMany({
      where: { doctorId, status: "IN_CONSULTATION" },
      data: { status: "COMPLETED", completedAt: new Date() },
    });

    // Get next patient
    const nextEntry = await tx.queueEntry.findFirst({
      where: {
        doctorId,
        appointment: { status: { in: ["BOOKED", "CHECKED_IN"] } },
      },
      orderBy: [
        { appointment: { isEmergency: "desc" } },
        { position: "asc" },
      ],
      include: { appointment: true },
    });

    if (!nextEntry) {
      return { calledAppointmentId: null, updatedQueue: [], resequenced: [] };
    }

    // Mark as IN_CONSULTATION
    await tx.appointment.update({
      where: { id: nextEntry.appointmentId },
      data: { status: "IN_CONSULTATION", checkedInAt: new Date() },
    });

    // Create consultation log
    await tx.consultationLog.create({
      data: {
        appointmentId: nextEntry.appointmentId,
        doctorId,
        startedAt: new Date(),
      },
    });

    // Audit log
    await tx.auditLog.create({
      data: {
        userId: nextEntry.appointment.doctorId,
        action: "CALL_NEXT",
        entity: "Appointment",
        entityId: nextEntry.appointmentId,
        metadata: { doctorId },
      },
    });

    // Recalculate positions for the remaining queue. The called patient is
    // already IN_CONSULTATION at this point, so the status filter inside
    // resequenceQueue drops them and the rest renumber from 2.
    const resequenced = await resequenceQueue(
      tx,
      doctorId,
      nextEntry.appointment.scheduledDate
    );

    const updatedQueue = await getQueueByDoctor(doctorId);
    return {
      calledAppointmentId: nextEntry.appointmentId,
      updatedQueue,
      resequenced,
    };
  });
}

/**
 * Insert emergency patient at front of queue (position 1),
 * shifting all others down by 1.
 */
export async function insertEmergency(
  appointmentId: string,
  adminUserId: string
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const appointment = await tx.appointment.findUnique({
      where: { id: appointmentId },
      include: { queueEntry: true, doctor: true },
    });

    if (!appointment) throw new Error("Appointment not found");

    // Shift all current queue entries down
    await tx.queueEntry.updateMany({
      where: {
        doctorId: appointment.doctorId,
        appointment: { status: { in: ["BOOKED", "CHECKED_IN"] } },
      },
      data: { position: { increment: 1 } },
    });

    // Mark as emergency and set position 1
    await tx.appointment.update({
      where: { id: appointmentId },
      data: { isEmergency: true, status: "CHECKED_IN" },
    });

    if (appointment.queueEntry) {
      await tx.queueEntry.update({
        where: { appointmentId },
        data: {
          position: 1,
          estimatedWaitMins: 0,
          predictionConfidence: 0.95,
        },
      });
    }

    // Audit log
    await tx.auditLog.create({
      data: {
        userId: adminUserId,
        action: "EMERGENCY_OVERRIDE",
        entity: "Appointment",
        entityId: appointmentId,
        metadata: { doctorId: appointment.doctorId },
      },
    });
  });
}
