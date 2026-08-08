import { z } from "zod";

/**
 * Server-side environment variables, validated once at module load.
 *
 * Why this file exists: `SOCKET_SERVER_SECRET` used to be read inline in three
 * places, each with `?? "mediflow-socket-dev-secret"`. That literal is
 * committed to a public repository, so with the variable unset the socket
 * server and the route handlers still *agreed* on a secret — and any reader of
 * the repo could `POST /emit` to push arbitrary events into any room. A shared
 * secret has no safe default, so a missing one has to be a startup failure
 * rather than a silent downgrade.
 *
 * Do not import this from a Client Component: it reads secrets, and reading
 * them in the browser both fails (they are not inlined) and is not something
 * that should ever be attempted. Browser-visible variables live in
 * lib/env.public.ts.
 */
const serverEnvSchema = z.object({
  AUTH_SECRET: z
    .string()
    .min(
      1,
      "AUTH_SECRET is required. Generate one with `openssl rand -base64 32`. " +
        "Auth.js signs session tokens with it, and the socket server verifies " +
        "the handshake against the same value."
    ),

  SOCKET_SERVER_URL: z
    .string()
    .url(
      "SOCKET_SERVER_URL must be an absolute URL (e.g. http://localhost:3001). " +
        "This is where route handlers POST queue events."
    ),

  SOCKET_SERVER_SECRET: z
    .string()
    .min(
      1,
      "SOCKET_SERVER_SECRET is required. Generate one with " +
        "`openssl rand -base64 32`. It is the bearer token for the socket " +
        "server's internal /emit endpoint."
    )
    .refine((value) => value !== "mediflow-socket-dev-secret", {
      message:
        "SOCKET_SERVER_SECRET is set to the old hardcoded fallback, which is " +
        "published in this repository's git history. Generate a new one.",
    }),

  NEXT_PUBLIC_APP_URL: z
    .string()
    .url(
      "NEXT_PUBLIC_APP_URL must be an absolute URL (e.g. http://localhost:3000). " +
        "The socket server uses it as its CORS origin, so a wrong value shows " +
        "up as browsers silently failing to connect."
    ),

  /**
   * Port the standalone socket server listens on. Unlike the values above this
   * one has a defensible default, but it lives here rather than as an inline
   * `??` so every environment lookup is in one place.
   */
  SOCKET_PORT: z.coerce.number().int().positive().default(3001),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

function loadServerEnv(): ServerEnv {
  const parsed = serverEnvSchema.safeParse(process.env);

  if (!parsed.success) {
    const details = Object.entries(parsed.error.flatten().fieldErrors)
      .map(([key, messages]) => `  - ${key}: ${messages?.join(" ")}`)
      .join("\n");

    throw new Error(
      `Invalid or missing environment variables:\n${details}\n\n` +
        `See .env.example for the full list.`
    );
  }

  return parsed.data;
}

export const env: ServerEnv = loadServerEnv();
