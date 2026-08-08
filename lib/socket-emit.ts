import { env } from "@/lib/env";

/**
 * The one place a route handler pushes an event to the socket server.
 *
 * Why it exists: `/api/queue/call-next` and `/api/queue/emergency` each had
 * their own inline `fetch(`${SOCKET_SERVER_URL}/emit`)` with its own headers,
 * its own bearer-token spelling and its own `.catch(() => {})`. Adding a third
 * copy for the appointment-status handlers would have made four places that all
 * have to agree on the wire format of the internal emit endpoint. They now all
 * call through here.
 *
 * Server-only: it reads `SOCKET_SERVER_SECRET` via lib/env.ts. Never import it
 * from a Client Component.
 */

export interface QueueEvent {
  /** Event name the browser listens for, e.g. `position:changed`. */
  event: string;
  /** Socket.IO room, e.g. `patient:<patientId>` or `doctor:<doctorId>`. */
  room: string;
  data: unknown;
}

/**
 * Emitting is best-effort by design. The socket server is a separate process
 * that may be down, restarting, or unreachable; a client that misses an event
 * still converges on the next poll or page load. A failed emit must therefore
 * never turn a committed database change into a 500 the caller reads as "the
 * cancellation did not happen".
 */
export async function emitQueueEvent(event: QueueEvent): Promise<void> {
  try {
    await fetch(`${env.SOCKET_SERVER_URL}/emit`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${env.SOCKET_SERVER_SECRET}`,
      },
      body: JSON.stringify(event),
    });
  } catch {
    // Non-fatal — see above.
  }
}

/** Fire a batch of events concurrently. Never rejects. */
export async function emitQueueEvents(events: QueueEvent[]): Promise<void> {
  await Promise.all(events.map(emitQueueEvent));
}
