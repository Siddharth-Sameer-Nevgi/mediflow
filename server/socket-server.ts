import "dotenv/config";
import express from "express";
import { createServer } from "http";
import { Server, type DefaultEventsMap } from "socket.io";
import { env } from "../lib/env";
import { prisma } from "../lib/prisma";

// Relative imports, not `@/…`: this process is run by ts-node, which does not
// apply tsconfig `paths` at runtime. An `@/lib/env` import type-checks and then
// fails to resolve when the server actually starts.

type UserRole = "PATIENT" | "DOCTOR" | "ADMIN";

/** Established by the handshake middleware; never sent by the client. */
interface QueueSocketData {
  userId: string;
  role: UserRole;
}

interface ClientToServerEvents {
  /**
   * `appointmentId` is a resource selector, not an identity claim — it is
   * checked against the authenticated patient before the room is joined.
   */
  "patient:join": (payload?: { appointmentId?: string }) => void;
  "doctor:join": () => void;
  "admin:join": () => void;
}

const app = express();
const httpServer = createServer(app);

const io = new Server<
  ClientToServerEvents,
  DefaultEventsMap,
  DefaultEventsMap,
  QueueSocketData
>(httpServer, {
  cors: {
    origin: env.NEXT_PUBLIC_APP_URL,
    methods: ["GET", "POST"],
    // Required for the browser to send the Auth.js session cookie on the
    // handshake request; without it the cookie is stripped and every
    // connection is rejected as unauthenticated.
    credentials: true,
  },
});

const queueNamespace = io.of("/queue");

// ---------------------------------------------------------------------------
// Handshake authentication
//
// Identity comes from the Auth.js session cookie sent with the handshake HTTP
// request. Chosen over an `auth: { token }` handshake payload because the
// session cookie is `httpOnly` — browser JavaScript cannot read it, so passing
// a token in the payload would require a second Next.js endpoint that hands the
// session out to client code. The cookie is already scoped, already expires
// with the session, and requires no new surface.
//
// This means the socket server must be reachable at an origin the browser will
// send the session cookie to: same site as the Next.js app (any port is fine),
// and `withCredentials` set on the client.
// ---------------------------------------------------------------------------

/**
 * Auth.js v5 cookie names. The `__Secure-` prefix is used when the app is
 * served over HTTPS. The cookie name is also the KDF salt, so the two have to
 * be tried as a pair rather than guessed independently.
 */
const SESSION_COOKIE_NAMES = [
  "__Secure-authjs.session-token",
  "authjs.session-token",
] as const;

type DecodeFn = (params: {
  token?: string;
  secret: string;
  salt: string;
}) => Promise<Record<string, unknown> | null>;

let cachedDecode: DecodeFn | null = null;

/**
 * `@auth/core` ships ESM only and this server is compiled to CommonJS, so the
 * decoder is pulled in with a dynamic import. A static import would emit a
 * `require()` of an ES module, which only works on very recent Node versions
 * and prints an experimental warning when it does.
 */
async function getDecode(): Promise<DecodeFn> {
  if (!cachedDecode) {
    const mod = await import("@auth/core/jwt");
    cachedDecode = mod.decode as unknown as DecodeFn;
  }
  return cachedDecode;
}

function readCookie(
  header: string | undefined,
  name: string
): string | undefined {
  if (!header) return undefined;

  for (const part of header.split(";")) {
    const separator = part.indexOf("=");
    if (separator === -1) continue;
    if (part.slice(0, separator).trim() !== name) continue;
    return decodeURIComponent(part.slice(separator + 1).trim());
  }

  return undefined;
}

function isUserRole(value: unknown): value is UserRole {
  return value === "PATIENT" || value === "DOCTOR" || value === "ADMIN";
}

queueNamespace.use(async (socket, next) => {
  // Prevents: any browser (or curl) opening a /queue connection with no
  // credentials at all and then joining rooms carrying other patients'
  // queue positions and appointment events.
  try {
    const cookieHeader = socket.handshake.headers.cookie;
    const decode = await getDecode();

    for (const cookieName of SESSION_COOKIE_NAMES) {
      const rawToken = readCookie(cookieHeader, cookieName);
      if (!rawToken) continue;

      // Verified with AUTH_SECRET, the same secret Auth.js used to issue the
      // token. A forged or tampered token fails to decrypt and returns null,
      // so the server never trusts a client-supplied identity.
      const claims = await decode({
        token: rawToken,
        secret: env.AUTH_SECRET,
        salt: cookieName,
      });

      const userId = claims?.userId;
      const role = claims?.role;

      if (typeof userId !== "string" || !isUserRole(role)) continue;

      socket.data.userId = userId;
      socket.data.role = role;
      next();
      return;
    }

    next(new Error("unauthenticated"));
  } catch {
    // Decode failures are expected for expired or forged tokens. They are not
    // reported back in detail, so a caller cannot use the error text to tell a
    // malformed token from a valid one issued under a different secret.
    next(new Error("unauthenticated"));
  }
});

queueNamespace.on("connection", (socket) => {
  const { userId, role } = socket.data;
  console.log(`[Socket] ${role} ${userId} connected: ${socket.id}`);

  /**
   * Patient rooms.
   *
   * The patient id is looked up from the authenticated user rather than read
   * from the payload. Prevents: a signed-in patient passing somebody else's
   * `patientId` and receiving that person's queue events.
   */
  socket.on("patient:join", async (payload) => {
    if (role !== "PATIENT") {
      // Prevents: a doctor or admin account subscribing to a patient room.
      // Role comes from the verified token, not from the socket payload.
      socket.emit("join:error", {
        event: "patient:join",
        reason: "forbidden",
      });
      return;
    }

    try {
      const patient = await prisma.patient.findUnique({
        where: { userId },
        select: { id: true },
      });

      if (!patient) {
        socket.emit("join:error", {
          event: "patient:join",
          reason: "no patient profile",
        });
        return;
      }

      await socket.join(`patient:${patient.id}`);

      const appointmentId = payload?.appointmentId;
      if (appointmentId) {
        // Prevents: enumerating appointment ids to subscribe to strangers'
        // `your_turn_approaching` and `position:changed` events. The room is
        // only joined if the row is actually this patient's.
        const owned = await prisma.appointment.findFirst({
          where: { id: appointmentId, patientId: patient.id, deletedAt: null },
          select: { id: true },
        });

        if (!owned) {
          socket.emit("join:error", {
            event: "patient:join",
            reason: "appointment not found for this patient",
          });
          return;
        }

        await socket.join(`appointment:${appointmentId}`);
      }

      console.log(
        `[Socket] patient ${patient.id} joined${
          appointmentId ? ` (appointment ${appointmentId})` : ""
        }`
      );
    } catch (error) {
      console.error("[Socket] patient:join failed", error);
      socket.emit("join:error", { event: "patient:join", reason: "error" });
    }
  });

  /**
   * Doctor room. `doctor:<id>` carries the whole queue for that doctor —
   * every waiting patient's token and position — so the doctor id is resolved
   * from the authenticated user.
   */
  socket.on("doctor:join", async () => {
    if (role !== "DOCTOR") {
      // Prevents: a patient joining `doctor:<id>` and reading the full queue,
      // which includes other patients' names via the queue payloads.
      socket.emit("join:error", { event: "doctor:join", reason: "forbidden" });
      return;
    }

    try {
      const doctor = await prisma.doctor.findUnique({
        where: { userId },
        select: { id: true },
      });

      if (!doctor) {
        socket.emit("join:error", {
          event: "doctor:join",
          reason: "no doctor profile",
        });
        return;
      }

      await socket.join(`doctor:${doctor.id}`);
      console.log(`[Socket] doctor ${doctor.id} joined`);
    } catch (error) {
      console.error("[Socket] doctor:join failed", error);
      socket.emit("join:error", { event: "doctor:join", reason: "error" });
    }
  });

  /**
   * Admin room, scoped to the hospital the admin actually administers. The
   * hospital id is read from the Admin row rather than from the JWT claim, so
   * a reassignment takes effect on the next connection instead of waiting for
   * the token to refresh.
   */
  socket.on("admin:join", async () => {
    if (role !== "ADMIN") {
      // Prevents: any signed-in account joining `admin:<hospitalId>` and
      // watching hospital-wide queue activity.
      socket.emit("join:error", { event: "admin:join", reason: "forbidden" });
      return;
    }

    try {
      const admin = await prisma.admin.findUnique({
        where: { userId },
        select: { hospitalId: true },
      });

      if (!admin) {
        socket.emit("join:error", {
          event: "admin:join",
          reason: "no admin profile",
        });
        return;
      }

      await socket.join(`admin:${admin.hospitalId}`);
      console.log(`[Socket] admin joined hospital ${admin.hospitalId}`);
    } catch (error) {
      console.error("[Socket] admin:join failed", error);
      socket.emit("join:error", { event: "admin:join", reason: "error" });
    }
  });

  socket.on("disconnect", () => {
    console.log(`[Socket] Client disconnected: ${socket.id}`);
  });
});

// ---------------------------------------------------------------------------
// Internal API for Next.js route handlers to emit events.
//
// Still guarded only by a shared bearer token, so it must not be exposed to the
// internet: any caller holding the token can emit into any room. The room name
// is chosen by the caller, which is safe only because the caller is our own
// route handlers.
// ---------------------------------------------------------------------------
app.use(express.json());

app.post("/emit", (req, res) => {
  const authHeader = req.headers.authorization;
  if (authHeader !== `Bearer ${env.SOCKET_SERVER_SECRET}`) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const { event, room, data } = req.body as {
    event: string;
    room: string;
    data: unknown;
  };

  queueNamespace.to(room).emit(event, data);
  res.json({ ok: true });
});

app.get("/health", (_req, res) => {
  res.json({ status: "ok", connections: queueNamespace.sockets.size });
});

httpServer.listen(env.SOCKET_PORT, () => {
  console.log(`\n🔌 MediFlow Socket.IO server running on port ${env.SOCKET_PORT}\n`);
});

export {};
