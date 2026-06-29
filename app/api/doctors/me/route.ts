import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * PATCH /api/doctors/me
 * Toggle availability or update avgConsultMins
 */
export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { isAvailable, avgConsultMins } = body as {
      isAvailable?: boolean;
      avgConsultMins?: number;
    };

    const doctor = await prisma.doctor.findUnique({
      where: { userId: session.user.id },
    });

    if (!doctor) {
      return NextResponse.json({ error: "Doctor record not found" }, { status: 404 });
    }

    const updated = await prisma.doctor.update({
      where: { id: doctor.id },
      data: {
        ...(isAvailable !== undefined && { isAvailable }),
        ...(avgConsultMins !== undefined && { avgConsultMins }),
      },
      include: {
        user: { select: { name: true, email: true } },
        department: { select: { name: true } },
      },
    });

    return NextResponse.json({ ok: true, doctor: updated });
  } catch (error) {
    console.error("[PATCH /api/doctors/me]", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const doctor = await prisma.doctor.findUnique({
      where: { userId: session.user.id },
      include: {
        user: { select: { name: true, email: true, phone: true } },
        department: { select: { name: true, code: true } },
      },
    });

    if (!doctor) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json({ doctor });
  } catch (error) {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
