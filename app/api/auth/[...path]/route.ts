import { auth } from "@/lib/auth/server";

/**
 * Proxies every /api/auth/* request to the Neon Auth server, handling session
 * cookie signing and refresh. Replaces the old Auth.js [...nextauth] handler.
 */
export const { GET, POST } = auth.handler();
