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

/**
 * Fire a batch of events concurrently. Never rejects.
 *
 * ── Known cost: one HTTP POST per event ─────────────────────────────────────
 * "Batch" describes the caller's array, not the wire. This fans out to N
 * separate POSTs at `/emit`, one per event, because that endpoint accepts a
 * single `{ event, room, data }` object. Since every queue-removing change ends
 * in a resequence, the count tracks queue length: a cancellation in a 30-person
 * queue emits 30 `position:changed` events plus one `queue:updated` for the
 * doctor — 31 requests, 31 connections, 31 auth-header checks, all triggered by
 * one patient tapping cancel. `Promise.all` makes them concurrent, not fewer,
 * and they are 31 chances for the socket server's accept queue to be the
 * bottleneck rather than the work itself.
 *
 * The fix is obvious: a batched endpoint taking `{ events: QueueEvent[] }`, so
 * this function makes one request and the socket server loops over rooms
 * in-process. It has not been done because it is a change to a second service
 * — server/socket-server.ts has to grow the new route and keep the single-event
 * one for `emitQueueEvent`'s callers, and the two have to be deployed in the
 * right order or emits silently 404 into the `catch` below and vanish. That is
 * a coordinated deploy for a cost that, at current queue lengths, is a handful
 * of requests to a process on the same host.
 *
 * Recorded rather than fixed. It is not a bug at this scale; it is a shape that
 * stops working at a scale this project has not reached.
 */
export async function emitQueueEvents(events: QueueEvent[]): Promise<void> {
  await Promise.all(events.map(emitQueueEvent));
}
