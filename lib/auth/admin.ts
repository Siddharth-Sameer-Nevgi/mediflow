import { prisma } from "@/lib/prisma";
import type { Role } from "./roles";

/**
 * Assign an application role to a Neon Auth user.
 *
 * `auth.admin.setRole()` is typed to Better Auth's built-in `"user" | "admin"`
 * vocabulary, which cannot express PATIENT / DOCTOR / ADMIN. `neon_auth.user`
 * lives in this same database and `role` is a plain text column, so the role is
 * written directly. This is the one place that writes to the neon_auth schema —
 * keep it here rather than scattering raw SQL through the routes.
 */
export async function setUserRole(userId: string, role: Role): Promise<void> {
  await prisma.$executeRaw`
    UPDATE neon_auth."user" SET role = ${role} WHERE id = ${userId}::uuid
  `;
}
