import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { env } from "@/lib/env";
import { callNextPatient } from "@/features/queue/queue.service";
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

    // Emit real-time events to all patients in this doctor's queue
    const socketUrl = env.SOCKET_SERVER_URL;
    const secret = env.SOCKET_SERVER_SECRET;

    // Notify the called patient their turn has arrived
    if (result.calledAppointmentId) {
      await fetch(`${socketUrl}/emit`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${secret}`,
        },
        body: JSON.stringify({
          event: "your_turn_approaching",
          room: `appointment:${result.calledAppointmentId}`,
          data: { appointmentId: result.calledAppointmentId },
        }),
      }).catch(() => {}); // non-fatal
    }

    // Notify all patients in queue that positions shifted
    await fetch(`${socketUrl}/emit`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${secret}`,
      },
      body: JSON.stringify({
        event: "queue:updated",
        room: `doctor:${doctorId}`,
        data: { doctorId, action: "call_next" },
      }),
    }).catch(() => {}); // non-fatal

    return NextResponse.json(result);
  } catch (error) {
    console.error("[POST /queue/call-next]", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
