import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";


export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const departmentId = searchParams.get("departmentId");

  try {
    const doctors = await prisma.doctor.findMany({
      where: {
        ...(departmentId && { departmentId }),
      },
      include: {
        user: { select: { name: true, email: true, phone: true } },
        department: true,
        _count: {
          select: {
            appointments: {
              where: {
                status: { in: ["BOOKED", "CHECKED_IN", "IN_CONSULTATION"] },
                deletedAt: null,
              },
            },
          },
        },
      },
      orderBy: { user: { name: "asc" } },
    });
    return NextResponse.json({ doctors });
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
    const {
      name, email, phone, specialization, departmentId,
      licenseNumber, avgConsultMins,
    } = body as {
      name: string; email: string; phone?: string;
      specialization: string; departmentId: string;
      licenseNumber: string; avgConsultMins?: number;
    };

    if (!name || !email || !specialization || !departmentId || !licenseNumber) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Check email not taken
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json({ error: "Email already registered" }, { status: 409 });
    }

    // Create user + doctor in transaction
    const doctor = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          name, email, phone: phone ?? null,
          role: "DOCTOR",
          emailVerified: true,
        },
      });
      return tx.doctor.create({
        data: {
          userId: user.id,
          departmentId,
          specialization,
          licenseNumber,
          avgConsultMins: avgConsultMins ?? 15,
          isAvailable: true,
        },
        include: {
          user: { select: { name: true, email: true } },
          department: true,
        },
      });
    });

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "CREATE_DOCTOR",
        entity: "Doctor",
        entityId: doctor.id,
        metadata: { name, email, departmentId },
      },
    });

    return NextResponse.json({ doctor }, { status: 201 });
  } catch (error) {
    console.error("[POST /api/doctors]", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
