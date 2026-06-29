import { prisma } from "@/lib/prisma";
import { QueueEntryWithPatient } from "./queue.types";

export async function getQueueByDoctor(
  doctorId: string
): Promise<QueueEntryWithPatient[]> {
  return prisma.queueEntry.findMany({
    where: {
      doctorId,
      appointment: {
        status: {
          in: ["BOOKED", "CHECKED_IN", "IN_CONSULTATION"],
        },
      },
    },
    orderBy: { position: "asc" },
    include: {
      appointment: {
        include: {
          patient: {
            include: {
              user: {
                select: { name: true, email: true },
              },
            },
          },
        },
      },
    },
  }) as Promise<QueueEntryWithPatient[]>;
}

export async function getQueuePosition(
  appointmentId: string
): Promise<{ position: number; estimatedWaitMins: number; confidence: number } | null> {
  const entry = await prisma.queueEntry.findUnique({
    where: { appointmentId },
  });

  if (!entry) return null;

  return {
    position: entry.position,
    estimatedWaitMins: entry.estimatedWaitMins,
    confidence: entry.predictionConfidence,
  };
}

export async function getNextInQueue(doctorId: string) {
  return prisma.queueEntry.findFirst({
    where: {
      doctorId,
      appointment: {
        status: { in: ["BOOKED", "CHECKED_IN"] },
      },
    },
    orderBy: { position: "asc" },
    include: {
      appointment: {
        include: {
          patient: { include: { user: true } },
        },
      },
    },
  });
}

export async function updateQueuePositions(doctorId: string): Promise<void> {
  const entries = await prisma.queueEntry.findMany({
    where: {
      doctorId,
      appointment: {
        status: { in: ["BOOKED", "CHECKED_IN"] },
      },
    },
    orderBy: [
      { appointment: { isEmergency: "desc" } },
      { position: "asc" },
    ],
    include: {
      appointment: {
        include: { doctor: true },
      },
    },
  });

  const avgConsultMins = entries[0]?.appointment?.doctor?.avgConsultMins ?? 15;

  await prisma.$transaction(
    entries.map((entry, index) =>
      prisma.queueEntry.update({
        where: { id: entry.id },
        data: {
          position: index + 1,
          estimatedWaitMins: index * avgConsultMins,
          virtualWaitingRoom: index * avgConsultMins > 30,
        },
      })
    )
  );
}
