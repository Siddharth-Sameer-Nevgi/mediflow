import { NextRequest, NextResponse } from "next/server";
import { getAdminHospitalId, getSessionUser, type Role } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

/**
 * Profile reads/writes now span two stores: identity (name) lives in Neon Auth,
 * while phone and the role-specific fields live on the Prisma profile row.
 */

type ProfileFields = {
  name: string;
  email: string;
  phone: string | null;
  createdAt: Date;
};

/**
 * Prisma's delegates are structurally different types, so a union of them is
 * not callable — each role gets its own branch.
 */
async function readProfile(
  role: Role,
  userId: string
): Promise<ProfileFields | null> {
  const select = { name: true, email: true, phone: true, createdAt: true };
  if (role === "DOCTOR")
    return prisma.doctor.findUnique({ where: { userId }, select });
  if (role === "ADMIN")
    return prisma.admin.findUnique({ where: { userId }, select });
  return prisma.patient.findUnique({ where: { userId }, select });
}

async function writeProfile(
  role: Role,
  userId: string,
  data: { name?: string; phone?: string | null }
): Promise<ProfileFields> {
  const select = { name: true, email: true, phone: true, createdAt: true };
  if (role === "DOCTOR")
    return prisma.doctor.update({ where: { userId }, data, select });
  if (role === "ADMIN")
    return prisma.admin.update({ where: { userId }, data, select });
  return prisma.patient.update({ where: { userId }, data, select });
}

export async function GET() {
  const session = await getSessionUser();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const profile = await readProfile(session.role, session.id);

    // Admins previously carried hospitalId on the Auth.js JWT; Neon Auth
    // sessions do not, so it is resolved from the profile here.
    const hospitalId =
      session.role === "ADMIN" ? await getAdminHospitalId(session.id) : null;

    return NextResponse.json({
      user: {
        name: session.name,
        email: session.email,
        role: session.role,
        phone: profile?.phone ?? null,
        createdAt: profile?.createdAt ?? null,
        hospitalId,
      },
    });
  } catch (error) {
    console.error("[GET /api/user/profile]", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const session = await getSessionUser();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { name, phone } = body as { name?: string; phone?: string };

    if (name !== undefined && (typeof name !== "string" || name.trim().length < 2)) {
      return NextResponse.json({ error: "Name must be at least 2 characters" }, { status: 400 });
    }

    // Name is owned by Neon Auth; the profile keeps a denormalised copy so
    // queue lists can render without a cross-schema join.
    const updated = await writeProfile(session.role, session.id, {
      ...(name !== undefined && { name: name.trim() }),
      ...(phone !== undefined && { phone: phone.trim() || null }),
    });

    return NextResponse.json({
      ok: true,
      user: { ...updated, role: session.role },
      // The client must also call authClient.updateUser({ name }) so Neon Auth
      // stays the source of truth for the display name.
      syncAuthName: name !== undefined ? name.trim() : null,
    });
  } catch (error) {
    console.error("[PATCH /api/user/profile]", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
