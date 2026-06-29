import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getQueueByDoctor } from "@/features/queue/queue.repository";

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
    const queue = await getQueueByDoctor(doctorId);
    return NextResponse.json({ queue });
  } catch (error) {
    console.error("[GET /queue/:doctorId]", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
