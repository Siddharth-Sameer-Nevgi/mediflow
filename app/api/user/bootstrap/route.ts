import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser, type Role } from "@/lib/auth/session";
import { ensureProfile } from "@/lib/auth/profile";

const ROLE_REDIRECTS: Record<Role, string> = {
  PATIENT: "/patient/dashboard",
  DOCTOR: "/doctor/dashboard",
  ADMIN: "/admin/dashboard",
};

/**
 * Called by the client immediately after a successful sign-in. Reconciles the
 * Prisma profile with the Neon Auth user and reports where to send them.
 */
export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Optional extras collected during registration. Role is deliberately NOT
  // accepted from the client — a self-assigned DOCTOR or ADMIN would be
  // privilege escalation. Those roles are granted out of band.
  const phone = await req
    .json()
    .then((body) => (typeof body?.phone === "string" ? body.phone : null))
    .catch(() => null);

  try {
    await ensureProfile(user);

    if (phone && user.role === "PATIENT") {
      await prisma.patient.update({
        where: { userId: user.id },
        data: { phone },
      });
    }
  } catch (error) {
    console.error("[Bootstrap] Failed to sync profile.", error);
    return NextResponse.json(
      { error: "Could not load your profile." },
      { status: 500 }
    );
  }

  return NextResponse.json({
    role: user.role,
    redirectTo: ROLE_REDIRECTS[user.role],
  });
}
