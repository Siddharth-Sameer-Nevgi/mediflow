import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const hospitals = await prisma.hospital.findMany({
      where: { isActive: true, deletedAt: null },
      include: {
        _count: { select: { departments: true, admins: true } },
      },
      orderBy: { name: "asc" },
    });
    return NextResponse.json({ hospitals });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { name, city, address, timezone } = body as {
      name: string;
      city: string;
      address: string;
      timezone?: string;
    };

    if (!name?.trim() || !city?.trim() || !address?.trim()) {
      return NextResponse.json(
        { error: "Name, city, and address are required" },
        { status: 400 }
      );
    }

    const hospital = await prisma.hospital.create({
      data: {
        name: name.trim(),
        city: city.trim(),
        address: address.trim(),
        timezone: timezone?.trim() ?? "UTC",
        isActive: true,
      },
      include: {
        _count: { select: { departments: true, admins: true } },
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "CREATE_HOSPITAL",
        entity: "Hospital",
        entityId: hospital.id,
        metadata: { name, city },
      },
    });

    return NextResponse.json({ hospital }, { status: 201 });
  } catch (error) {
    console.error("[POST /api/hospitals]", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
