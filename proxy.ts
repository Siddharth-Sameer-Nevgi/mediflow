import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { auth } from "@/lib/auth/server";
import { normalizeRole, type Role } from "@/lib/auth/session";

const ROLE_ROUTES: Record<string, Role> = {
  "/patient": "PATIENT",
  "/doctor": "DOCTOR",
  "/admin": "ADMIN",
};

const ROLE_REDIRECTS: Record<Role, string> = {
  PATIENT: "/patient/dashboard",
  DOCTOR: "/doctor/dashboard",
  ADMIN: "/admin/dashboard",
};

/**
 * Optimistic role-based routing. The authoritative check lives in each route
 * handler via getSessionUser() — this only avoids rendering a page the signed-in
 * user has no access to.
 */
export async function proxy(req: NextRequest) {
  const pathname = req.nextUrl.pathname;

  const requiredRole = Object.entries(ROLE_ROUTES).find(([path]) =>
    pathname.startsWith(path)
  )?.[1];

  if (!requiredRole) return NextResponse.next();

  const { data: session } = await auth.getSession();
  const user = session?.user;

  if (!user) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  const role = normalizeRole((user as { role?: unknown }).role);
  if (role !== requiredRole) {
    return NextResponse.redirect(new URL(ROLE_REDIRECTS[role], req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/patient/:path*", "/doctor/:path*", "/admin/:path*"],
};
