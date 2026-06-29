import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  // ── Auth & role guard ─────────────────────────────────────────────────────
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // ── Parse body ────────────────────────────────────────────────────────────
  let body: { appointmentId?: string; reason?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { appointmentId, reason } = body;

  if (!appointmentId || typeof appointmentId !== "string") {
    return NextResponse.json(
      { error: "appointmentId is required" },
      { status: 400 }
    );
  }

  if (!reason || typeof reason !== "string") {
    return NextResponse.json(
      { error: "reason is required" },
      { status: 400 }
    );
  }

  try {
    // ── Find the queue entry ───────────────────────────────────────────────
    const entry = await prisma.queueEntry.findFirst({
      where: { appointmentId },
    });

    if (!entry) {
      return NextResponse.json(
        { error: "Queue entry not found for this appointment" },
        { status: 404 }
      );
    }

    if (entry.position === 1) {
      return NextResponse.json(
        { ok: true, newPosition: 1, message: "Already at front of queue" },
        { status: 200 }
      );
    }

    const doctorId = entry.doctorId;

    // ── Bump everyone currently ahead of this entry by +1 ─────────────────
    await prisma.queueEntry.updateMany({
      where: {
        doctorId,
        position: { lt: entry.position },
      },
      data: { position: { increment: 1 } },
    });

    // ── Move this entry to position 1 ──────────────────────────────────────
    await prisma.queueEntry.update({
      where: { id: entry.id },
      data: { position: 1 },
    });

    // ── Audit log ─────────────────────────────────────────────────────────
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "EMERGENCY_QUEUE_OVERRIDE",
        entity: "QueueEntry",
        entityId: entry.id,
        metadata: {
          appointmentId,
          doctorId,
          reason,
          previousPosition: entry.position,
          newPosition: 1,
        },
      },
    });

    // ── Emit Socket.IO event (non-fatal) ──────────────────────────────────
    const socketUrl =
      process.env.SOCKET_SERVER_URL ?? "http://localhost:3001";
    const secret =
      process.env.SOCKET_SERVER_SECRET ?? "mediflow-socket-dev-secret";

    await fetch(`${socketUrl}/emit`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${secret}`,
      },
      body: JSON.stringify({
        event: "queue:emergency",
        room: `doctor:${doctorId}`,
        data: { appointmentId, newPosition: 1, reason },
      }),
    }).catch(() => {
      // Non-fatal — socket server may be offline
    });

    return NextResponse.json({ ok: true, newPosition: 1 });
  } catch (error) {
    console.error("[POST /api/queue/emergency]", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
