"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Bell, X, CheckCircle2, Clock, AlertTriangle, Info,
  Zap, Check, Loader2,
} from "lucide-react";
import { useRealtimeNotifications, type RealtimeNotification } from "@/hooks/useRealtimeNotifications";
import { formatDistanceToNow } from "date-fns";

interface DBNotification {
  id: string;
  type: string;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
}

const typeConfig: Record<string, { icon: React.ElementType; color: string; bg: string }> = {
  APPOINTMENT_REMINDER: { icon: Clock,         color: "text-sky-400",     bg: "bg-sky-500/20" },
  QUEUE_UPDATE:         { icon: Zap,           color: "text-amber-400",   bg: "bg-amber-500/20" },
  TURN_APPROACHING:     { icon: AlertTriangle, color: "text-emerald-400", bg: "bg-emerald-500/20" },
  SYSTEM:               { icon: Info,          color: "text-slate-400",   bg: "bg-slate-700" },
  position_changed:     { icon: Zap,           color: "text-sky-400",     bg: "bg-sky-500/20" },
  your_turn:            { icon: AlertTriangle, color: "text-emerald-400", bg: "bg-emerald-500/20" },
  emergency:            { icon: AlertTriangle, color: "text-red-400",     bg: "bg-red-500/20" },
  queue_update:         { icon: Clock,         color: "text-amber-400",   bg: "bg-amber-500/20" },
  default:              { icon: CheckCircle2,  color: "text-slate-400",   bg: "bg-slate-700" },
};

function getConfig(type: string) {
  return typeConfig[type] ?? typeConfig.default;
}

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();
  const { notifications: realtimeNotifs, unreadCount: realtimeUnread, markAllRead } =
    useRealtimeNotifications();

  const { data, isLoading } = useQuery<{ notifications: DBNotification[]; unreadCount: number }>({
    queryKey: ["notifications"],
    queryFn: () => fetch("/api/notifications?limit=20").then((r) => r.json()),
    refetchInterval: open ? false : 30000, // refresh every 30s when closed
  });

  const markAllMutation = useMutation({
    mutationFn: () => fetch("/api/notifications", { method: "PATCH" }).then((r) => r.json()),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications"] }),
  });

  const dbNotifs = data?.notifications ?? [];
  const dbUnread = data?.unreadCount ?? 0;
  const totalUnread = dbUnread + realtimeUnread;

  const handleOpen = () => {
    setOpen(true);
    markAllRead();
    markAllMutation.mutate();
  };

  const handleToggle = () => (open ? setOpen(false) : handleOpen());

  return (
    <div className="relative">
      <button
        id="notification-bell-btn"
        onClick={handleToggle}
        className="relative w-9 h-9 rounded-xl bg-slate-800 hover:bg-slate-700 flex items-center justify-center transition-all border border-slate-700/50"
        aria-label="Notifications"
      >
        <Bell className={`w-4 h-4 ${totalUnread > 0 ? "text-sky-400" : "text-slate-400"}`} />
        {totalUnread > 0 && (
          <span className="absolute -top-1 -right-1 w-4 h-4 bg-sky-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center animate-pulse">
            {totalUnread > 9 ? "9+" : totalUnread}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-11 z-50 w-80 bg-slate-900 border border-slate-700/50 rounded-2xl shadow-2xl shadow-black/50 overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <h3 className="text-white font-semibold text-sm">Notifications</h3>
                {totalUnread > 0 && (
                  <span className="text-[10px] font-bold text-sky-300 bg-sky-500/20 px-1.5 py-0.5 rounded-full">
                    {totalUnread} new
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {dbNotifs.some((n) => !n.isRead) && (
                  <button
                    onClick={() => markAllMutation.mutate()}
                    className="flex items-center gap-1 text-[10px] text-slate-400 hover:text-sky-400 transition-colors"
                    title="Mark all read"
                  >
                    <Check className="w-3 h-3" /> All read
                  </button>
                )}
                <button onClick={() => setOpen(false)} className="text-slate-500 hover:text-white transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="max-h-[340px] overflow-y-auto">
              {/* Real-time notifications (live events) */}
              {realtimeNotifs.map((notif) => {
                const cfg = getConfig(notif.type);
                return (
                  <div key={notif.id} className="px-4 py-3 border-b border-slate-800/50 last:border-0 hover:bg-slate-800/30 transition-colors bg-sky-500/5">
                    <div className="flex items-start gap-3">
                      <div className={`w-8 h-8 rounded-lg ${cfg.bg} flex items-center justify-center shrink-0 mt-0.5`}>
                        <cfg.icon className={`w-3.5 h-3.5 ${cfg.color}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <p className="text-white text-xs font-medium">{notif.title}</p>
                          <span className="w-1.5 h-1.5 rounded-full bg-sky-400 shrink-0" />
                        </div>
                        <p className="text-slate-400 text-xs leading-relaxed">{notif.message}</p>
                        <p className="text-slate-600 text-[10px] mt-1">
                          {notif.timestamp.toLocaleTimeString()}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* DB notifications */}
              {isLoading ? (
                <div className="py-8 flex items-center justify-center">
                  <Loader2 className="w-5 h-5 text-slate-600 animate-spin" />
                </div>
              ) : dbNotifs.length === 0 && realtimeNotifs.length === 0 ? (
                <div className="py-10 text-center">
                  <Bell className="w-8 h-8 text-slate-700 mx-auto mb-2" />
                  <p className="text-slate-500 text-sm">No notifications yet</p>
                </div>
              ) : (
                dbNotifs.map((notif) => {
                  const cfg = getConfig(notif.type);
                  return (
                    <div
                      key={notif.id}
                      className={`px-4 py-3 border-b border-slate-800/50 last:border-0 hover:bg-slate-800/30 transition-colors ${!notif.isRead ? "bg-sky-500/5" : ""}`}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`w-8 h-8 rounded-lg ${cfg.bg} flex items-center justify-center shrink-0 mt-0.5`}>
                          <cfg.icon className={`w-3.5 h-3.5 ${cfg.color}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 mb-0.5">
                            <p className="text-white text-xs font-medium">{notif.title}</p>
                            {!notif.isRead && <span className="w-1.5 h-1.5 rounded-full bg-sky-400 shrink-0" />}
                          </div>
                          <p className="text-slate-400 text-xs leading-relaxed">{notif.message}</p>
                          <p className="text-slate-600 text-[10px] mt-1">
                            {formatDistanceToNow(new Date(notif.createdAt), { addSuffix: true })}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="px-4 py-2.5 border-t border-slate-800">
              <p className="text-slate-600 text-[10px] text-center">
                Notifications from last 30 days
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
