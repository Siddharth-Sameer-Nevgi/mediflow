import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth/session";
import { auth } from "@/lib/auth/server";
import { setUserRole } from "@/lib/auth/admin";


export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const departmentId = searchParams.get("departmentId");

  try {
    const doctors = await prisma.doctor.findMany({
      where: {
        ...(departmentId && { departmentId }),
      },
      include: {
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
      orderBy: { name: "asc" },
    });
    return NextResponse.json({ doctors });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await getSessionUser();
  if (!session || session.role !== "ADMIN") {
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

    const existing = await prisma.doctor.findFirst({ where: { email } });
    if (existing) {
      return NextResponse.json({ error: "Email already registered" }, { status: 409 });
    }

    // Identity is created in Neon Auth first — it owns users and roles. The
    // password is never used: doctors sign in with an emailed OTP.
    const { data: created, error: authError } = await auth.admin.createUser({
      email,
      name,
      password: randomBytes(24).toString("base64url"),
    });

    if (authError || !created?.user) {
      console.error("[POST /api/doctors] Neon Auth createUser failed.", authError);
      return NextResponse.json(
        { error: authError?.message ?? "Could not create the doctor's account." },
        { status: 502 }
      );
    }

    await setUserRole(created.user.id, "DOCTOR");

    const doctor = await prisma.doctor.create({
      data: {
        userId: created.user.id,
        name,
        email,
        phone: phone ?? null,
        departmentId,
        specialization,
        licenseNumber,
        avgConsultMins: avgConsultMins ?? 15,
        isAvailable: true,
      },
      include: {
        department: true,
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: session.id,
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
