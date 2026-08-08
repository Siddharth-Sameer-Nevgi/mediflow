import { z } from "zod";

/**
 * Browser-visible environment variables.
 *
 * Separate from lib/env.ts because that module reads secrets: importing it from
 * a Client Component would evaluate secret lookups in the browser, where they
 * are `undefined`.
 *
 * `NEXT_PUBLIC_*` variables are substituted by the bundler only at *literal*
 * property accesses, so each one must be read as `process.env.NEXT_PUBLIC_FOO`
 * spelled out in full. Handing `process.env` wholesale to Zod would see an
 * empty object in the browser.
 */
const publicEnvSchema = z.object({
  NEXT_PUBLIC_SOCKET_URL: z
    .string()
    .url(
      "NEXT_PUBLIC_SOCKET_URL must be an absolute URL (e.g. http://localhost:3001). " +
        "It is the socket server the browser connects to."
    ),
});

export type PublicEnv = z.infer<typeof publicEnvSchema>;

function loadPublicEnv(): PublicEnv {
  const parsed = publicEnvSchema.safeParse({
    NEXT_PUBLIC_SOCKET_URL: process.env.NEXT_PUBLIC_SOCKET_URL,
  });

  if (!parsed.success) {
    const details = Object.entries(parsed.error.flatten().fieldErrors)
      .map(([key, messages]) => `  - ${key}: ${messages?.join(" ")}`)
      .join("\n");

    throw new Error(
      `Invalid or missing public environment variables:\n${details}\n\n` +
        `These are baked in at build time, so rebuild after changing them.`
    );
  }

  return parsed.data;
}

export const publicEnv: PublicEnv = loadPublicEnv();
