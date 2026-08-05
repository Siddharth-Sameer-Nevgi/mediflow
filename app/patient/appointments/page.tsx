"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { format, isFuture } from "date-fns";
import {
  Calendar, Plus, ChevronRight, Loader2, AlertTriangle,
  CheckCircle2, Clock, X, MapPin, Stethoscope,
} from "lucide-react";
import { toast } from "sonner";

interface Appointment {
  id: string;
  status: string;
  tokenNumber: number;
  scheduledAt: string;
  appointmentType: string;
  notes?: string;
  doctor: {
    user: { name: string };
    department: { name: string } | null;
  };
  department: { name: string } | null;
  queueEntry?: { position: number; estimatedWaitMins: number } | null;
}

const statusConfig: Record<string, { label: string; cls: string; icon: React.ElementType }> = {
  BOOKED:           { label: "Booked",          cls: "bg-blue-500/20 text-blue-300 border-blue-500/30",     icon: Calendar },
  CHECKED_IN:       { label: "Checked In",      cls: "bg-amber-500/20 text-amber-300 border-amber-500/30",  icon: Clock },
  IN_CONSULTATION:  { label: "In Consultation", cls: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30", icon: CheckCircle2 },
  COMPLETED:        { label: "Completed",       cls: "bg-slate-700 text-slate-400 border-slate-600",         icon: CheckCircle2 },
  NO_SHOW:          { label: "No Show",         cls: "bg-red-500/20 text-red-300 border-red-500/30",         icon: AlertTriangle },
  CANCELLED:        { label: "Cancelled",       cls: "bg-gray-700/50 text-gray-500 border-gray-600/30",      icon: X },
};

const typeLabel: Record<string, string> = {
  FIRST_CONSULTATION: "First Visit",
  FOLLOW_UP: "Follow Up",
  PRESCRIPTION_REFILL: "Prescription",
  DIAGNOSTIC_REVIEW: "Diagnostic",
};

function CancelDialog({ apptId, onConfirm, onClose }: { apptId: string; onConfirm: () => void; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-sm bg-slate-900 border border-slate-700/50 rounded-2xl shadow-2xl p-6 text-center">
        <div className="w-14 h-14 rounded-full bg-red-500/20 flex items-center justify-center mx-auto mb-4">
          <AlertTriangle className="w-7 h-7 text-red-400" />
        </div>
        <h3 className="text-white font-bold text-lg mb-2">Cancel Appointment?</h3>
        <p className="text-slate-400 text-sm mb-6">
          This action cannot be undone. Your queue position will be released.
        </p>
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 py-3 rounded-xl text-sm font-medium transition-all border border-slate-700">
            Keep it
          </button>
          <button onClick={onConfirm} className="flex-1 bg-red-500 hover:bg-red-400 text-white py-3 rounded-xl text-sm font-semibold transition-all">
            Yes, Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AppointmentsPage() {
  const queryClient = useQueryClient();
  const [cancelTarget, setCancelTarget] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "upcoming" | "past">("all");

  const { data, isLoading } = useQuery<{ appointments: Appointment[] }>({
    queryKey: ["patient-appointments-all"],
    queryFn: () => fetch("/api/appointments?limit=50").then((r) => r.json()),
  });

  const cancelMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/appointments/${id}/status`, { method: "DELETE" });
      if (!res.ok) throw new Error("Cancel failed");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["patient-appointments-all"] });
      queryClient.invalidateQueries({ queryKey: ["patient-appointments-summary"] });
      toast.success("Appointment cancelled");
      setCancelTarget(null);
    },
    onError: () => toast.error("Failed to cancel — please try again"),
  });

  const appointments = data?.appointments ?? [];

  const filtered = appointments.filter((a) => {
    if (filter === "upcoming") return isFuture(new Date(a.scheduledAt)) && a.status !== "CANCELLED";
    if (filter === "past") return !isFuture(new Date(a.scheduledAt)) || a.status === "CANCELLED";
    return true;
  });

  const canCancel = (a: Appointment) =>
    ["BOOKED", "CHECKED_IN"].includes(a.status) && isFuture(new Date(a.scheduledAt));

  return (
    <>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">My Appointments</h1>
            <p className="text-slate-400 text-sm mt-1">{appointments.length} total</p>
          </div>
          <Link
            href="/patient/book"
            className="inline-flex items-center gap-2 bg-sky-500 hover:bg-sky-400 text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-all shadow-lg shadow-sky-500/20"
          >
            <Plus className="w-4 h-4" /> Book New
          </Link>
        </div>

        {/* Filter tabs */}
        <div className="flex gap-2">
          {(["all", "upcoming", "past"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-all capitalize ${
                filter === f
                  ? "bg-sky-500 text-white shadow-lg shadow-sky-500/25"
                  : "bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 border border-slate-700"
              }`}
            >
              {f}
            </button>
          ))}
        </div>

        {/* List */}
        {isLoading ? (
          <div className="space-y-3 animate-pulse">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-24 bg-slate-800/40 rounded-2xl border border-slate-700/30" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-slate-800/30 border border-slate-700/30 rounded-2xl p-12 text-center">
            <Calendar className="w-12 h-12 text-slate-600 mx-auto mb-3" />
            <p className="text-slate-300 font-semibold mb-1">No appointments found</p>
            <p className="text-slate-500 text-sm">
              {filter !== "all" ? "Try changing the filter above." : "Book your first appointment to get started."}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((appt) => {
              const cfg = statusConfig[appt.status] ?? statusConfig.BOOKED;
              const StatusIcon = cfg.icon;
              return (
                <div
                  key={appt.id}
                  className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-5 hover:border-slate-600 transition-all backdrop-blur"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-4 flex-1 min-w-0">
                      {/* Token badge */}
                      <div className="w-11 h-11 rounded-xl bg-slate-700/60 flex items-center justify-center shrink-0 font-bold text-white text-sm">
                        #{appt.tokenNumber}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <p className="text-white font-semibold text-sm">
                            Dr. {appt.doctor.user.name}
                          </p>
                          <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border font-medium ${cfg.cls}`}>
                            <StatusIcon className="w-3 h-3" />
                            {cfg.label}
                          </span>
                          <span className="text-xs text-slate-500 bg-slate-700/40 px-2 py-0.5 rounded-full">
                            {typeLabel[appt.appointmentType] ?? appt.appointmentType}
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-3 text-xs text-slate-400">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {format(new Date(appt.scheduledAt), "MMM d, yyyy · h:mm a")}
                          </span>
                          {appt.department && (
                            <span className="flex items-center gap-1">
                              <Stethoscope className="w-3 h-3" />
                              {appt.department.name}
                            </span>
                          )}
                          {appt.queueEntry && appt.status === "BOOKED" && (
                            <span className="flex items-center gap-1 text-sky-400">
                              <Clock className="w-3 h-3" />
                              Queue #{appt.queueEntry.position} · ~{appt.queueEntry.estimatedWaitMins}min
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 shrink-0">
                      {["BOOKED", "CHECKED_IN", "IN_CONSULTATION"].includes(appt.status) && (
                        <Link
                          href={`/patient/queue/${appt.id}`}
                          className="flex items-center gap-1 text-sky-400 hover:text-sky-300 text-xs font-medium transition-colors"
                        >
                          Track <ChevronRight className="w-3.5 h-3.5" />
                        </Link>
                      )}
                      {canCancel(appt) && (
                        <button
                          onClick={() => setCancelTarget(appt.id)}
                          className="text-xs text-red-400/70 hover:text-red-400 transition-colors font-medium px-2 py-1 rounded-lg hover:bg-red-500/10"
                        >
                          Cancel
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {cancelTarget && (
        <CancelDialog
          apptId={cancelTarget}
          onClose={() => setCancelTarget(null)}
          onConfirm={() => cancelMutation.mutate(cancelTarget)}
        />
      )}
    </>
  );
}
