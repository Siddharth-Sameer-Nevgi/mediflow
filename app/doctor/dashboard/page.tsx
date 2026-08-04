"use client";

import { useEffect, useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { authClient } from "@/lib/auth/client";
import { connectSocket, disconnectSocket } from "@/lib/socket";
import { toast } from "sonner";
import {
  Users,
  Clock,
  ChevronRight,
  PlayCircle,
  StopCircle,
  AlertTriangle,
  CheckCircle2,
  Activity,
  Timer,
  Loader2,
  Wifi,
  WifiOff,
} from "lucide-react";
import { format } from "date-fns";

interface QueueEntry {
  id: string;
  appointmentId: string;
  position: number;
  estimatedWaitMins: number;
  predictionConfidence: number;
  appointment: {
    tokenNumber: number;
    status: string;
    appointmentType: string;
    isEmergency: boolean;
    notes: string | null;
    patient: {
      name: string;
      email: string;
    };
  };
}

function ConsultationTimer({
  isRunning,
  onStop,
}: {
  isRunning: boolean;
  onStop: (secs: number) => void;
}) {
  const [seconds, setSeconds] = useState(0);
  const interval = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (isRunning) {
      interval.current = setInterval(() => setSeconds((s) => s + 1), 1000);
    } else {
      if (interval.current) clearInterval(interval.current);
    }
    return () => {
      if (interval.current) clearInterval(interval.current);
    };
  }, [isRunning]);

  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;

  return (
    <div className="text-center">
      <div className="text-4xl font-mono font-bold text-white tabular-nums">
        {mins.toString().padStart(2, "0")}:
        {secs.toString().padStart(2, "0")}
      </div>
      <div className="text-slate-400 text-xs mt-1">Consultation time</div>
      {isRunning && (
        <button
          onClick={() => onStop(seconds)}
          className="mt-3 flex items-center gap-2 mx-auto bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/30 px-4 py-2 rounded-xl text-sm font-medium transition-all"
        >
          <StopCircle className="w-4 h-4" />
          End Consultation
        </button>
      )}
    </div>
  );
}

export default function DoctorDashboard() {
  const { data: session } = authClient.useSession();
  const queryClient = useQueryClient();
  const [connected, setConnected] = useState(false);
  const [consultingAppointmentId, setConsultingAppointmentId] = useState<string | null>(null);
  const [timerRunning, setTimerRunning] = useState(false);
  const [confirmCall, setConfirmCall] = useState(false);

  // Get doctor profile
  const { data: doctorData } = useQuery({
    queryKey: ["doctor-profile", session?.user?.id],
    queryFn: async () => {
      const res = await fetch(`/api/doctors/me`);
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!session?.user?.id,
  });

  const doctorId = doctorData?.doctor?.id;

  // Get queue
  const { data: queueData, isLoading } = useQuery<{ queue: QueueEntry[] }>({
    queryKey: ["doctor-queue", doctorId],
    queryFn: async () => {
      const res = await fetch(`/api/queue/${doctorId}`);
      if (!res.ok) return { queue: [] };
      return res.json();
    },
    enabled: !!doctorId,
    refetchInterval: 30000,
  });

  const queue = queueData?.queue ?? [];
  const currentPatient = queue.find(
    (q) => q.appointment.status === "IN_CONSULTATION"
  );
  const waitingCount = queue.filter((q) =>
    ["BOOKED", "CHECKED_IN"].includes(q.appointment.status)
  ).length;

  // Socket.IO
  useEffect(() => {
    if (!doctorId) return;
    const socket = connectSocket();
    socket.on("connect", () => setConnected(true));
    socket.on("disconnect", () => setConnected(false));
    socket.emit("doctor:join", { doctorId });
    socket.on("queue:updated", () => {
      queryClient.invalidateQueries({ queryKey: ["doctor-queue", doctorId] });
    });
    return () => {
      socket.off("queue:updated");
      disconnectSocket();
    };
  }, [doctorId, queryClient]);

  const callNextMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/queue/call-next", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ doctorId }),
      });
      if (!res.ok) throw new Error("Failed to call next");
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["doctor-queue", doctorId] });
      if (data.calledAppointmentId) {
        setConsultingAppointmentId(data.calledAppointmentId);
        setTimerRunning(true);
        toast.success("Next patient called!");
      } else {
        toast.info("No more patients in queue");
      }
      setConfirmCall(false);
    },
    onError: () => {
      toast.error("Failed to call next patient");
    },
  });

  const handleEndConsultation = async (seconds: number) => {
    setTimerRunning(false);
    const durationMins = Math.round(seconds / 60);
    if (consultingAppointmentId) {
      try {
        await fetch("/api/consultations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ appointmentId: consultingAppointmentId, action: "end" }),
        });
      } catch {
        // non-fatal — timer still stops
      }
    }
    setConsultingAppointmentId(null);
    toast.success(`Consultation ended — ${durationMins} min session logged`);
    queryClient.invalidateQueries({ queryKey: ["doctor-queue", doctorId] });
  };

  const statusColors: Record<string, string> = {
    BOOKED: "text-blue-400 bg-blue-500/10 border-blue-500/30",
    CHECKED_IN: "text-amber-400 bg-amber-500/10 border-amber-500/30",
    IN_CONSULTATION: "text-emerald-400 bg-emerald-500/10 border-emerald-500/30",
    COMPLETED: "text-slate-400 bg-slate-700 border-slate-600",
  };

  if (!doctorId) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Loader2 className="w-8 h-8 text-sky-500 animate-spin mx-auto mb-3" />
          <p className="text-slate-400 text-sm">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">
            Queue Dashboard
          </h1>
          <p className="text-slate-400 text-sm mt-0.5">
            {format(new Date(), "EEEE, MMMM d · h:mm a")}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div
            className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border ${
              connected
                ? "text-emerald-400 border-emerald-500/30 bg-emerald-500/10"
                : "text-slate-500 border-slate-700"
            }`}
          >
            {connected ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
            {connected ? "Live" : "Offline"}
          </div>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-3 gap-4">
        {[
          {
            label: "Waiting",
            value: waitingCount,
            icon: Users,
            color: "sky",
          },
          {
            label: "In Consultation",
            value: currentPatient ? 1 : 0,
            icon: Activity,
            color: "emerald",
          },
          {
            label: "Avg Wait",
            value: `${queue.length > 0 ? Math.round(queue[0]?.estimatedWaitMins ?? 0) : 0}m`,
            icon: Clock,
            color: "amber",
          },
        ].map((stat) => (
          <div
            key={stat.label}
            className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-4 backdrop-blur"
          >
            <div
              className={`w-9 h-9 rounded-xl bg-${stat.color}-500/20 flex items-center justify-center mb-2`}
            >
              <stat.icon className={`w-4 h-4 text-${stat.color}-400`} />
            </div>
            <div className="text-2xl font-bold text-white">{stat.value}</div>
            <div className="text-slate-500 text-xs mt-0.5">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Active Consultation */}
      {currentPatient && (
        <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-emerald-300 font-semibold text-sm">
                In Consultation
              </span>
            </div>
            <span className="text-emerald-400 text-xs font-medium">
              Token #{currentPatient.appointment.tokenNumber}
            </span>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex-1">
              <p className="text-white font-bold text-lg">
                {currentPatient.appointment.patient.name}
              </p>
              <p className="text-slate-400 text-sm">
                {currentPatient.appointment.appointmentType.replace(/_/g, " ")}
              </p>
              {currentPatient.appointment.notes && (
                <p className="text-slate-500 text-xs mt-1 italic">
                  &ldquo;{currentPatient.appointment.notes}&rdquo;
                </p>
              )}
            </div>
            <div className="shrink-0">
              <ConsultationTimer
                isRunning={timerRunning}
                onStop={handleEndConsultation}
              />
            </div>
          </div>
        </div>
      )}

      {/* Call Next Button */}
      {!currentPatient && waitingCount > 0 && (
        <div>
          {!confirmCall ? (
            <button
              onClick={() => setConfirmCall(true)}
              id="call-next-btn"
              className="w-full flex items-center justify-center gap-3 bg-sky-500 hover:bg-sky-400 text-white py-4 rounded-2xl font-bold text-lg transition-all hover:shadow-2xl hover:shadow-sky-500/25 hover:-translate-y-0.5"
            >
              <PlayCircle className="w-6 h-6" />
              Call Next Patient
            </button>
          ) : (
            <div className="bg-slate-800/60 border border-slate-700/50 rounded-2xl p-5 text-center space-y-3">
              <p className="text-white font-semibold">
                Call the next patient in queue?
              </p>
              <p className="text-slate-400 text-sm">
                <strong className="text-white">
                  {queue.find((q) => q.appointment.status !== "IN_CONSULTATION")
                    ?.appointment.patient.name ?? "Next patient"}
                </strong>{" "}
                (Token #
                {queue.find((q) =>
                  ["BOOKED", "CHECKED_IN"].includes(q.appointment.status)
                )?.appointment.tokenNumber ?? "—"}
                )
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setConfirmCall(false)}
                  className="flex-1 bg-slate-700 hover:bg-slate-600 text-white py-2.5 rounded-xl text-sm font-medium transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={() => callNextMutation.mutate()}
                  disabled={callNextMutation.isPending}
                  id="confirm-call-next-btn"
                  className="flex-1 bg-sky-500 hover:bg-sky-400 text-white py-2.5 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2"
                >
                  {callNextMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : null}
                  Confirm
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Queue List */}
      <div>
        <h2 className="text-lg font-semibold text-white mb-4">
          Today&apos;s Queue
        </h2>

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-16 bg-slate-800/30 rounded-xl animate-pulse"
              />
            ))}
          </div>
        ) : queue.length === 0 ? (
          <div className="bg-slate-800/30 border border-slate-700/30 rounded-2xl p-8 text-center">
            <CheckCircle2 className="w-12 h-12 text-slate-600 mx-auto mb-3" />
            <p className="text-slate-300 font-medium">Queue is empty</p>
            <p className="text-slate-500 text-sm mt-1">
              No patients in queue right now
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {queue.map((entry, i) => (
              <div
                key={entry.id}
                className={`flex items-center gap-3 p-4 rounded-xl border transition-all ${
                  entry.appointment.status === "IN_CONSULTATION"
                    ? "bg-emerald-500/5 border-emerald-500/30"
                    : entry.appointment.isEmergency
                    ? "bg-red-500/5 border-red-500/30"
                    : "bg-slate-800/40 border-slate-700/40 hover:border-slate-600/60"
                }`}
              >
                <div className="w-8 h-8 rounded-lg bg-slate-700 flex items-center justify-center text-white font-bold text-sm shrink-0">
                  {entry.position}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-white font-medium text-sm truncate">
                      {entry.appointment.patient.name}
                    </p>
                    {entry.appointment.isEmergency && (
                      <span className="text-xs bg-red-500/20 text-red-300 border border-red-500/30 px-1.5 py-0.5 rounded-full font-medium shrink-0">
                        Emergency
                      </span>
                    )}
                  </div>
                  <p className="text-slate-500 text-xs">
                    Token #{entry.appointment.tokenNumber} ·{" "}
                    {entry.appointment.appointmentType.replace(/_/g, " ")} ·{" "}
                    ~{Math.round(entry.estimatedWaitMins)} min
                  </p>
                </div>
                <span
                  className={`text-xs px-2 py-1 rounded-full border font-medium shrink-0 ${
                    statusColors[entry.appointment.status] ?? "text-slate-400 bg-slate-700 border-slate-600"
                  }`}
                >
                  {entry.appointment.status.replace(/_/g, " ")}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
