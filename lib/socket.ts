import { io, Socket } from "socket.io-client";
import { publicEnv } from "@/lib/env.public";

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    socket = io(publicEnv.NEXT_PUBLIC_SOCKET_URL + "/queue", {
      autoConnect: false,
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
      // The server authenticates the handshake from the Auth.js session cookie,
      // which the browser only attaches to a cross-origin request when
      // credentials are enabled. Without this every connection is rejected.
      withCredentials: true,
    });
  }
  return socket;
}

export function connectSocket(): Socket {
  const s = getSocket();
  if (!s.connected) {
    s.connect();
  }
  return s;
}

export function disconnectSocket(): void {
  if (socket?.connected) {
    socket.disconnect();
  }
}
