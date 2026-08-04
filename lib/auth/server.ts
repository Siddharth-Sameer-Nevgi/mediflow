import { createNeonAuth } from "@neondatabase/auth/next/server";

/**
 * Server-side Neon Auth instance. Use in server components, server actions,
 * route handlers, and proxy.ts.
 *
 * Identity, sessions, and roles live in the Neon-managed `neon_auth` schema —
 * see prisma/schema.prisma for why none of that is modelled in Prisma.
 */
export const auth = createNeonAuth({
  baseUrl: process.env.NEON_AUTH_BASE_URL!,
  cookies: {
    secret: process.env.NEON_AUTH_COOKIE_SECRET!,
  },
});
