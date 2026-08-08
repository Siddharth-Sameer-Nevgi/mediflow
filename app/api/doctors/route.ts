import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";


export async function GET(req: NextRequest) {
  // Until this call existed, the handler was fully unauthenticated. What that
  // exposed, to anyone who could reach the URL with no session and no cookie:
  // every doctor's name, email address and phone number (the `user` select
  // below), which department and hospital they work in, their licence number,
  // whether they are on shift right now, and a live count of each one's active
  // appointments. That is the hospital's entire medical staff directory plus a
  // real-time read on how busy each clinician is — scrapeable in one request,
  // repeatable on a timer, and a ready-made list for phishing or for turning up
  // when a named doctor's queue is empty.
  //
  // Any authenticated role passes: this is the browse endpoint a patient uses
  // to pick who to book with, so it is not scoped to an owner the way
  // /api/queue/[doctorId] is. The bar is "signed in", not "yours".
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const departmentId = searchParams.get("departmentId");

  try {
    const doctors = await prisma.doctor.findMany({
      where: {
        ...(departmentId && { departmentId }),
      },
      include: {
        // STILL OPEN: auth above stops anonymous scraping, it does not stop a
        // signed-in patient reading the whole medical staff's personal contact
        // details. Choosing a doctor to book with needs name, department,
        // specialisation and availability — `email` and `phone` are not part of
        // that, and narrowing this select is the second half of the fix.
        //
        // Not narrowed yet because there is a live consumer:
        // app/admin/doctors/page.tsx renders `doctor.user.email` under each
        // doctor's name in the admin roster (line ~289). Dropping the field
        // here blanks that line. Whether the UI changes or the field stays is
        // the maintainer's call, deliberately left undecided in code.
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
