import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";

const app = express();
const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
    methods: ["GET", "POST"],
  },
});

const queueNamespace = io.of("/queue");

queueNamespace.on("connection", (socket) => {
  console.log(`[Socket] Client connected: ${socket.id}`);

  // Patient joins their room
  socket.on("patient:join", ({ appointmentId, patientId }: { appointmentId: string; patientId: string }) => {
    socket.join(`patient:${patientId}`);
    socket.join(`appointment:${appointmentId}`);
    console.log(`[Socket] Patient ${patientId} joined for appointment ${appointmentId}`);
  });

  // Doctor joins their room
  socket.on("doctor:join", ({ doctorId }: { doctorId: string }) => {
    socket.join(`doctor:${doctorId}`);
    console.log(`[Socket] Doctor ${doctorId} joined`);
  });

  // Admin joins hospital room
  socket.on("admin:join", ({ hospitalId }: { hospitalId: string }) => {
    socket.join(`admin:${hospitalId}`);
    console.log(`[Socket] Admin joined hospital ${hospitalId}`);
  });

  socket.on("disconnect", () => {
    console.log(`[Socket] Client disconnected: ${socket.id}`);
  });
});

// Internal API for Next.js to emit events
app.use(express.json());

const SOCKET_SECRET = process.env.SOCKET_SERVER_SECRET ?? "mediflow-socket-dev-secret";

app.post("/emit", (req, res) => {
  const authHeader = req.headers.authorization;
  if (authHeader !== `Bearer ${SOCKET_SECRET}`) {
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
  res.json({ status: "ok", connections: io.of("/queue").sockets.size });
});

const PORT = parseInt(process.env.SOCKET_PORT ?? "3001");

httpServer.listen(PORT, () => {
  console.log(`\n🔌 MediFlow Socket.IO server running on port ${PORT}\n`);
});

export {};
