import { prisma } from "@/lib/prisma";
import type { SessionUser } from "./session";

/**
 * Reconcile the Prisma profile row with the Neon Auth user.
 *
 * Name and email are denormalised onto the profile tables (Prisma cannot join
 * into the Neon-managed `neon_auth` schema), so they are refreshed here on each
 * sign-in to stop the copies drifting.
 *
 * A PATIENT profile is created on demand. DOCTOR and ADMIN profiles are not —
 * they need a department or hospital that self-registration cannot supply, so
 * they are provisioned by the seed or by an admin, and this only syncs them.
 */
export async function ensureProfile(user: SessionUser): Promise<void> {
  const identity = { name: user.name, email: user.email };

  if (user.role === "PATIENT") {
    await prisma.patient.upsert({
      where: { userId: user.id },
      update: identity,
      create: { userId: user.id, ...identity },
    });
    return;
  }

  if (user.role === "DOCTOR") {
    await prisma.doctor.updateMany({
      where: { userId: user.id },
      data: identity,
    });
    return;
  }

  await prisma.admin.updateMany({
    where: { userId: user.id },
    data: identity,
  });
}
