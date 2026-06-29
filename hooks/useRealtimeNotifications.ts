"use client";

import { useEffect, useState } from "react";
import { connectSocket } from "@/lib/socket";

export interface RealtimeNotification {
  id: string;
  type: "position_changed" | "your_turn" | "emergency" | "queue_update";
  title: string;
  message: string;
  timestamp: Date;
  read: boolean;
}

export function useRealtimeNotifications(appointmentId?: string) {
  const [notifications, setNotifications] = useState<RealtimeNotification[]>([]);

  const addNotification = (
    notif: Omit<RealtimeNotification, "id" | "timestamp" | "read">
  ) => {
    setNotifications((prev) =>
      [
        {
          ...notif,
          id: Math.random().toString(36).slice(2),
          timestamp: new Date(),
          read: false,
        },
        ...prev,
      ].slice(0, 20) // keep last 20
    );
  };

  useEffect(() => {
    const socket = connectSocket();

    socket.on(
      "position:changed",
      (data: { appointmentId: string; newPosition: number }) => {
        if (!appointmentId || data.appointmentId === appointmentId) {
          addNotification({
            type: "position_changed",
            title: "Queue Updated",
            message: `Your position is now #${data.newPosition}`,
          });
        }
      }
    );

    socket.on(
      "your_turn_approaching",
      (data: { appointmentId: string }) => {
        if (!appointmentId || data.appointmentId === appointmentId) {
          addNotification({
            type: "your_turn",
            title: "Your Turn Is Near!",
            message: "Please proceed to the consultation room",
          });
        }
      }
    );

    socket.on("queue:emergency", () => {
      addNotification({
        type: "emergency",
        title: "Emergency Override",
        message: "Queue order has been updated due to an emergency",
      });
    });

    return () => {
      socket.off("position:changed");
      socket.off("your_turn_approaching");
      socket.off("queue:emergency");
    };
  }, [appointmentId]);

  const markAllRead = () =>
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));

  const unreadCount = notifications.filter((n) => !n.read).length;

  return { notifications, unreadCount, markAllRead };
}
