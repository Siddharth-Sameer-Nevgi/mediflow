import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { auth } from "@/lib/auth";

const ROLE_ROUTES: Record<string, string> = {
  "/patient": "PATIENT",
  "/doctor": "DOCTOR",
  "/admin": "ADMIN",
};

export async function proxy(req: NextRequest) {
  const session = await auth();
  const pathname = req.nextUrl.pathname;

  const requiredRole = Object.entries(ROLE_ROUTES).find(([path]) =>
    pathname.startsWith(path)
  )?.[1];

  if (requiredRole) {
    if (!session?.user) {
      return NextResponse.redirect(new URL("/login", req.url));
    }
    if (session.user.role !== requiredRole) {
      const roleRedirects: Record<string, string> = {
        PATIENT: "/patient/dashboard",
        DOCTOR: "/doctor/dashboard",
        ADMIN: "/admin/dashboard",
      };
      const redirect = roleRedirects[session.user.role] ?? "/login";
      return NextResponse.redirect(new URL(redirect, req.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/patient/:path*",
    "/doctor/:path*",
    "/admin/:path*",
  ],
};
