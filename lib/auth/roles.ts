/**
 * Role helpers with no server-only dependencies, so client components can
 * import them without pulling Prisma into the browser bundle.
 */

export type Role = "PATIENT" | "DOCTOR" | "ADMIN";

export const ROLES: readonly Role[] = ["PATIENT", "DOCTOR", "ADMIN"];

/**
 * Neon Auth stores `role` as free-text, so normalise it and fall back to the
 * least-privileged role rather than trusting an unexpected value.
 */
export function normalizeRole(role: unknown): Role {
  const upper = typeof role === "string" ? role.toUpperCase() : "";
  return (ROLES as readonly string[]).includes(upper)
    ? (upper as Role)
    : "PATIENT";
}

export const ROLE_REDIRECTS: Record<Role, string> = {
  PATIENT: "/patient/dashboard",
  DOCTOR: "/doctor/dashboard",
  ADMIN: "/admin/dashboard",
};
