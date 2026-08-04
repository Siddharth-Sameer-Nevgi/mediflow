import { auth } from "./server";
import { prisma } from "@/lib/prisma";
import { normalizeRole, type Role } from "./roles";

export { normalizeRole, ROLES, ROLE_REDIRECTS, type Role } from "./roles";

export interface SessionUser {
  /** neon_auth.user.id (uuid) */
  id: string;
  email: string;
  name: string;
  role: Role;
}

/** Current signed-in user, or null. */
export async function getSessionUser(): Promise<SessionUser | null> {
  const { data } = await auth.getSession();
  const user = data?.user;
  if (!user) return null;

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: normalizeRole((user as { role?: unknown }).role),
  };
}

/**
 * Session user if they hold `role`, otherwise null. Route handlers use this as
 * the authoritative check — proxy.ts redirects are only an optimistic layer.
 */
export async function getSessionUserWithRole(
  role: Role
): Promise<SessionUser | null> {
  const user = await getSessionUser();
  return user && user.role === role ? user : null;
}

/** The hospital an admin belongs to — previously carried on the Auth.js JWT. */
export async function getAdminHospitalId(
  userId: string
): Promise<string | null> {
  const admin = await prisma.admin.findUnique({
    where: { userId },
    select: { hospitalId: true },
  });
  return admin?.hospitalId ?? null;
}
