import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getQueueByDoctor } from "@/features/queue/queue.repository";
import { findOwnedDoctor } from "@/lib/ownership";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ doctorId: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { doctorId } = await params;

    // Prevents: any signed-in account reading a named doctor's live queue. The
    // payload is every waiting patient's name, email, token, appointment type
    // and notes (getQueueByDoctor) — a roster of who is in a waiting room and
    // what for. The socket server refuses `doctor:join` to everyone but that
    // doctor for exactly this reason (server/socket-server.ts); until now the
    // HTTP route handed the same data to anyone with a session.
    const doctor = await findOwnedDoctor(doctorId, {
      id: session.user.id,
      role: session.user.role,
    });

    if (!doctor) {
      // 404, not 403 — a 403 would confirm the doctor id is real.
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const queue = await getQueueByDoctor(doctorId);
    return NextResponse.json({ queue });
  } catch (error) {
    console.error("[GET /queue/:doctorId]", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
