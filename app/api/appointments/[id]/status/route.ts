import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { updateAppointmentStatusSchema } from "@/lib/validations";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSessionUser();
  if (!session || session.role !== "DOCTOR") {
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

    const appointment = await prisma.appointment.update({
      where: { id },
      data: {
        status,
        ...(status === "COMPLETED" && { completedAt: new Date() }),
        ...(status === "CHECKED_IN" && { checkedInAt: new Date() }),
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: session.id,
        action: `STATUS_CHANGE_${status}`,
        entity: "Appointment",
        entityId: id,
        metadata: { status },
      },
    });

    return NextResponse.json({ appointment });
  } catch (error) {
    console.error("[PATCH /appointments/:id/status]", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSessionUser();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;

    // Soft delete
    await prisma.appointment.update({
      where: { id },
      data: { deletedAt: new Date(), status: "CANCELLED" },
    });

    return NextResponse.json({ message: "Appointment cancelled" });
  } catch (error) {
    console.error("[DELETE /appointments/:id]", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
