"use client";

import { createAuthClient } from "@neondatabase/auth/next";

/**
 * Browser-side Neon Auth client. Talks to `/api/auth/*` on this origin, which
 * is proxied to the Neon Auth server by app/api/auth/[...path]/route.ts.
 *
 * Use `authClient.useSession()` in client components.
 */
export const authClient = createAuthClient();
