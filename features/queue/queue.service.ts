import { prisma } from "@/lib/prisma";
import { getQueueByDoctor, updateQueuePositions } from "./queue.repository";
import { QueueEntryWithPatient } from "./queue.types";

/**
 * Call next patient in queue. Marks current IN_CONSULTATION as COMPLETED,
 * moves next BOOKED/CHECKED_IN to IN_CONSULTATION, recalculates positions.
 */
export async function callNextPatient(doctorId: string): Promise<{
  calledAppointmentId: string | null;
  updatedQueue: QueueEntryWithPatient[];
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
      return { calledAppointmentId: null, updatedQueue: [] };
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

    // Recalculate positions for remaining queue
    const remaining = await tx.queueEntry.findMany({
      where: {
        doctorId,
        appointment: { status: { in: ["BOOKED", "CHECKED_IN"] } },
        id: { not: nextEntry.id },
      },
      orderBy: [
        { appointment: { isEmergency: "desc" } },
        { position: "asc" },
      ],
      include: { appointment: { include: { doctor: true } } },
    });

    const avgConsultMins =
      remaining[0]?.appointment?.doctor?.avgConsultMins ?? 15;

    for (let i = 0; i < remaining.length; i++) {
      await tx.queueEntry.update({
        where: { id: remaining[i].id },
        data: {
          position: i + 2, // +2 because position 1 is IN_CONSULTATION
          estimatedWaitMins: (i + 1) * avgConsultMins,
          virtualWaitingRoom: (i + 1) * avgConsultMins > 30,
        },
      });
    }

    const updatedQueue = await getQueueByDoctor(doctorId);
    return { calledAppointmentId: nextEntry.appointmentId, updatedQueue };
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
