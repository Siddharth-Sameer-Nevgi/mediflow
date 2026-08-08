import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

export async function GET(req: NextRequest) {
  // Prevents: an unauthenticated caller enumerating the hospital's internal
  // structure — every active department, its code, and `_count.appointments`,
  // which is a live per-department patient volume. Omitting `hospitalId` walks
  // every hospital in the database at once. This handler made no `auth()` call
  // at all, so all of that was a single curl away.
  //
  // A session is the whole bar, as on /api/doctors: the department list is what
  // a patient browses before booking, so it is not ownership-scoped. The POST
  // below already required ADMIN; only the read was open.
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const hospitalId = searchParams.get("hospitalId");

  try {
    const departments = await prisma.department.findMany({
      where: {
        isActive: true,
        ...(hospitalId && { hospitalId }),
      },
      include: {
        _count: {
          select: {
            doctors: true,
            appointments: true,
          },
        },
      },
      orderBy: { name: "asc" },
    });
    return NextResponse.json({ departments });
  } catch (error) {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();

    if (!session || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { name, description, hospitalId } = body as {
      name: string;
      description?: string;
      hospitalId: string;
    };

    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return NextResponse.json(
        { error: "Department name is required" },
        { status: 400 }
      );
    }

    if (!hospitalId) {
      return NextResponse.json(
        { error: "hospitalId is required" },
        { status: 400 }
      );
    }

    // Auto-generate a code from name (e.g., "General Medicine" → "GEN-MED")
    const code = name
      .trim()
      .toUpperCase()
      .split(/\s+/)
      .map((w: string) => w.slice(0, 3))
      .join("-");

    const department = await prisma.department.create({
      data: {
        name: name.trim(),
        description: description?.trim() ?? null,
        code,
        hospitalId,
        isActive: true,
      },
      include: {
        _count: {
          select: {
            doctors: true,
            appointments: true,
          },
        },
      },
    });

    return NextResponse.json({ department }, { status: 201 });
  } catch (error) {
    console.error("POST /api/departments error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
