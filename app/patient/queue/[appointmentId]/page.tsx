"use client";

import { useEffect, useState, use } from "react";
import { useQuery } from "@tanstack/react-query";
import { connectSocket, disconnectSocket } from "@/lib/socket";
import { useSession } from "next-auth/react";
import { Wifi, WifiOff, Coffee, Bell, Activity, CheckCircle2, Clock, Users } from "lucide-react";
import { formatWaitTime, formatConfidence } from "@/lib/utils";

interface QueuePosition {
  position: number;
  patientsAhead: number;
  estimatedWaitMins: number;
  confidence: number;
  showVirtualWaiting: boolean;
  totalInQueue: number;
  tokenNumber: number;
}

function WaitRing({ position, total }: { position: number; total: number }) {
  const progress = total > 0 ? ((total - position) / total) * 100 : 0;
  const r = 54;
  const circ = 2 * Math.PI * r;
  const dash = (progress / 100) * circ;

  return (
    <div className="relative w-36 h-36">
      <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
        <circle cx="60" cy="60" r={r} fill="none" stroke="#1e293b" strokeWidth="8" />
        <circle cx="60" cy="60" r={r} fill="none" stroke="#0ea5e9" strokeWidth="8"
          strokeLinecap="round" strokeDasharray={`${dash} ${circ}`}
          className="transition-all duration-1000" />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-bold text-white">#{position}</span>
        <span className="text-slate-400 text-xs">in queue</span>
      </div>
    </div>
  );
}

export default function QueuePage({ params }: { params: Promise<{ appointmentId: string }> }) {
  const { appointmentId } = use(params);
  const { data: session } = useSession();
  const [connected, setConnected] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  const { data: queueData, refetch } = useQuery<QueuePosition>({
    queryKey: ["queue-position", appointmentId],
    queryFn: async () => {
      const res = await fetch(`/api/queue/position/${appointmentId}`);
      if (!res.ok) throw new Error("Failed to fetch position");
      return res.json();
    },
    refetchInterval: 30000,
  });

  useEffect(() => {
    if (!session?.user?.id) return;
    const socket = connectSocket();
    socket.on("connect", () => setConnected(true));
    socket.on("disconnect", () => setConnected(false));
    // No patientId: the server derives it from the session cookie. The
    // appointment id is still sent, but the server checks it belongs to this
    // patient before joining the room.
    socket.emit("patient:join", { appointmentId });
    socket.on("position:changed", (data: { appointmentId: string }) => {
      if (data.appointmentId === appointmentId) { refetch(); setLastUpdate(new Date()); }
    });
    return () => {
      socket.off("position:changed");
      disconnectSocket();
    };
  }, [session?.user?.id, appointmentId, refetch]);

  const pos = queueData;
  const status = pos?.position === 0 ? "completed" : pos?.position === 1 ? "next" : "waiting";

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Live Queue Tracker</h1>
          <p className="text-slate-400 text-sm mt-0.5">Token #{pos?.tokenNumber ?? "—"}</p>
        </div>
        <div className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border ${connected ? "text-emerald-400 border-emerald-500/30 bg-emerald-500/10" : "text-slate-500 border-slate-700 bg-slate-800"}`}>
          {connected ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
          {connected ? "Live" : "Reconnecting..."}
        </div>
      </div>

      {!pos ? (
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-8 space-y-4 animate-pulse">
          <div className="w-36 h-36 rounded-full bg-slate-700 mx-auto" />
          <div className="h-4 bg-slate-700 rounded w-2/3 mx-auto" />
          <div className="h-3 bg-slate-700 rounded w-1/2 mx-auto" />
        </div>
      ) : (
        <>
          <div className="bg-slate-800/60 border border-slate-700/50 rounded-2xl p-6 backdrop-blur">
            {status === "next" && (
              <div className="mb-4 p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <p className="text-emerald-300 text-sm font-medium">🎉 You&apos;re next! Please proceed to the consultation room.</p>
              </div>
            )}
            {status === "completed" && (
              <div className="mb-4 p-3 bg-sky-500/10 border border-sky-500/30 rounded-xl flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-sky-400" />
                <p className="text-sky-300 text-sm font-medium">Your consultation is complete.</p>
              </div>
            )}

            <div className="flex flex-col items-center gap-6">
              <WaitRing position={pos.position} total={pos.totalInQueue} />

              <div className="w-full grid grid-cols-3 gap-3">
                <div className="text-center p-3 bg-slate-900/50 rounded-xl">
                  <div className="text-2xl font-bold text-white">{pos.patientsAhead}</div>
                  <div className="text-slate-500 text-xs mt-0.5">Ahead of you</div>
                </div>
                <div className="text-center p-3 bg-sky-500/10 border border-sky-500/30 rounded-xl">
                  <div className="text-2xl font-bold text-sky-400">{formatWaitTime(pos.estimatedWaitMins)}</div>
                  <div className="text-slate-500 text-xs mt-0.5">Est. wait</div>
                </div>
                <div className="text-center p-3 bg-slate-900/50 rounded-xl">
                  <div className="text-2xl font-bold text-white">{formatConfidence(pos.confidence)}</div>
                  <div className="text-slate-500 text-xs mt-0.5">Confidence</div>
                </div>
              </div>

              <div className="w-full">
                <div className="flex justify-between text-xs text-slate-500 mb-1">
                  <span>Prediction accuracy</span>
                  <span>{formatConfidence(pos.confidence)}</span>
                </div>
                <div className="bg-slate-700 rounded-full h-1.5">
                  <div className="bg-gradient-to-r from-sky-500 to-blue-400 h-1.5 rounded-full transition-all duration-500"
                    style={{ width: `${pos.confidence * 100}%` }} />
                </div>
              </div>

              <p className="text-slate-500 text-xs">Last updated: {lastUpdate.toLocaleTimeString()}</p>
            </div>
          </div>

          {pos.showVirtualWaiting && status === "waiting" && (
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center">
                  <Coffee className="w-5 h-5 text-amber-400" />
                </div>
                <div>
                  <p className="text-amber-300 font-semibold text-sm">Virtual Waiting Room</p>
                  <p className="text-amber-400/70 text-xs">Your wait is over 30 mins — feel free to leave</p>
                </div>
              </div>
              <ul className="space-y-1.5 text-amber-400/80 text-xs">
                <li className="flex items-center gap-2"><Bell className="w-3 h-3" />We&apos;ll notify you 10 minutes before your turn</li>
                <li className="flex items-center gap-2"><Activity className="w-3 h-3" />This page auto-updates in real time</li>
              </ul>
            </div>
          )}

          {status === "waiting" && !pos.showVirtualWaiting && (
            <div className="bg-slate-800/30 border border-slate-700/30 rounded-2xl p-4">
              <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2">While you wait</p>
              <ul className="space-y-1.5 text-slate-500 text-xs">
                <li>• Keep this page open for real-time updates</li>
                <li>• Have your ID and insurance card ready</li>
                <li>• List any current medications</li>
                <li>• Note the main symptoms to discuss</li>
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  );
}
