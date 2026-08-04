import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSessionUser();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const notification = await prisma.notification.findUnique({ where: { id } });

    if (!notification || notification.userId !== session.id) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    await prisma.notification.update({
      where: { id },
      data: { isRead: true },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[PATCH /api/notifications/:id/read]", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
