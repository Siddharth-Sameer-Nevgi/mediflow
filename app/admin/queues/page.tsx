"use client";

import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { connectSocket, disconnectSocket } from "@/lib/socket";
import {
  Users, Activity, Clock, CheckCircle2, AlertTriangle,
  Wifi, WifiOff, Stethoscope,
} from "lucide-react";

interface Doctor {
  id: string;
  specialization: string;
  isAvailable: boolean;
  user: { name: string };
  department: { name: string };
}

interface QueueEntry {
  id: string;
  appointmentId: string;
  position: number;
  estimatedWaitMins: number;
  appointment: {
    tokenNumber: number;
    status: string;
    isEmergency: boolean;
    patient: { user: { name: string } };
  };
}

function DoctorQueueCard({ doctor }: { doctor: Doctor }) {
  const { data, refetch } = useQuery<{ queue: QueueEntry[] }>({
    queryKey: ["admin-queue", doctor.id],
    queryFn: async () => {
      const res = await fetch(`/api/queue/${doctor.id}`);
      if (!res.ok) return { queue: [] };
      return res.json();
    },
    refetchInterval: 20000,
  });

  const queue = data?.queue ?? [];
  const active = queue.filter((q) =>
    ["CHECKED_IN", "IN_CONSULTATION"].includes(q.appointment.status)
  );
  const waiting = queue.filter((q) => q.appointment.status === "BOOKED");

  return (
    <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl overflow-hidden backdrop-blur">
      {/* Card header */}
      <div className="px-5 py-4 border-b border-slate-700/50 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center">
            <Stethoscope className="w-4 h-4 text-emerald-400" />
          </div>
          <div>
            <p className="text-white font-semibold text-sm">Dr. {doctor.user.name}</p>
            <p className="text-slate-400 text-xs">{doctor.specialization} · {doctor.department.name}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${doctor.isAvailable ? "bg-emerald-400 animate-pulse" : "bg-slate-600"}`} />
          <span className={`text-xs font-medium ${doctor.isAvailable ? "text-emerald-400" : "text-slate-500"}`}>
            {doctor.isAvailable ? "Available" : "Unavailable"}
          </span>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 divide-x divide-slate-700/50 border-b border-slate-700/50">
        {[
          { label: "In Queue", value: waiting.length, color: "sky" },
          { label: "Active", value: active.length, color: "emerald" },
          { label: "Avg Wait", value: queue.length > 0 ? `${Math.round(queue[0]?.estimatedWaitMins ?? 0)}m` : "—", color: "amber" },
        ].map((stat) => (
          <div key={stat.label} className="py-3 text-center">
            <div className={`text-lg font-bold text-${stat.color}-400`}>{stat.value}</div>
            <div className="text-slate-500 text-xs">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Queue list */}
      <div className="max-h-48 overflow-y-auto divide-y divide-slate-800/50">
        {queue.length === 0 ? (
          <div className="py-6 text-center text-slate-600 text-xs">Queue is empty</div>
        ) : (
          queue.slice(0, 8).map((entry) => (
            <div key={entry.id} className="px-4 py-2.5 flex items-center justify-between hover:bg-slate-700/20 transition-colors">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-lg bg-slate-700 text-slate-300 text-xs font-bold flex items-center justify-center">
                  {entry.position}
                </span>
                {entry.appointment.isEmergency && (
                  <AlertTriangle className="w-3 h-3 text-red-400 shrink-0" />
                )}
                <span className="text-slate-300 text-xs truncate max-w-[120px]">
                  {entry.appointment.patient.user.name}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-slate-500 text-xs">~{Math.round(entry.estimatedWaitMins)}m</span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full border font-medium ${
                  entry.appointment.status === "IN_CONSULTATION"
                    ? "text-emerald-300 bg-emerald-500/10 border-emerald-500/30"
                    : entry.appointment.status === "CHECKED_IN"
                    ? "text-amber-300 bg-amber-500/10 border-amber-500/30"
                    : "text-slate-400 bg-slate-700/50 border-slate-600"
                }`}>
                  {entry.appointment.status === "IN_CONSULTATION"
                    ? "Consulting"
                    : entry.appointment.status === "CHECKED_IN"
                    ? "Checked In"
                    : "Waiting"}
                </span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default function AdminQueuesPage() {
  const [connected, setConnected] = useState(false);

  const { data: doctorsData } = useQuery<{ doctors: Doctor[] }>({
    queryKey: ["admin-all-doctors"],
    queryFn: async () => {
      const res = await fetch("/api/doctors");
      if (!res.ok) return { doctors: [] };
      return res.json();
    },
    refetchInterval: 60000,
  });

  const doctors = doctorsData?.doctors ?? [];
  const available = doctors.filter((d) => d.isAvailable);

  useEffect(() => {
    const socket = connectSocket();
    socket.on("connect", () => setConnected(true));
    socket.on("disconnect", () => setConnected(false));
    return () => {
      disconnectSocket();
    };
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">All Queues — Live</h1>
          <p className="text-slate-400 text-sm mt-1">
            {available.length} of {doctors.length} doctors available now
          </p>
        </div>
        <div className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border ${connected ? "text-emerald-400 border-emerald-500/30 bg-emerald-500/10" : "text-slate-500 border-slate-700 bg-slate-800"}`}>
          {connected ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
          {connected ? "Real-time" : "Polling"}
        </div>
      </div>

      {doctors.length === 0 ? (
        <div className="bg-slate-800/30 border border-slate-700/30 rounded-2xl p-12 text-center">
          <Users className="w-16 h-16 text-slate-600 mx-auto mb-4" />
          <p className="text-slate-300 font-semibold">No doctors registered yet</p>
          <p className="text-slate-500 text-sm mt-1">Run the database seed to add demo doctors</p>
          <code className="mt-3 block text-xs text-slate-400 bg-slate-900 px-3 py-2 rounded-lg">npm run db:seed</code>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
          {doctors.map((doctor) => (
            <DoctorQueueCard key={doctor.id} doctor={doctor} />
          ))}
        </div>
      )}
    </div>
  );
}
