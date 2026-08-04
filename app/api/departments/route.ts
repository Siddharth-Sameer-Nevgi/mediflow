import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth/session";

export async function GET(req: NextRequest) {
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
    const session = await getSessionUser();

    if (!session || session.role !== "ADMIN") {
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
