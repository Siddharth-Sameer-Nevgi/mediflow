"use client";

import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  AlertTriangle,
  Search,
  ChevronDown,
  Loader2,
  Zap,
  Users,
  X,
  CheckCircle2,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

interface Doctor {
  id: string;
  name: string;
  specialization: string;
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
    patient: { name: string; email: string };
  };
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function EmergencyOverridePage() {
  const queryClient = useQueryClient();

  const [selectedDoctorId, setSelectedDoctorId] = useState<string>("");
  const [search, setSearch] = useState("");
  const [overrideReason, setOverrideReason] = useState("");
  const [confirmEntry, setConfirmEntry] = useState<QueueEntry | null>(null);

  // ── Fetch doctors list ───────────────────────────────────────────────────
  const { data: doctorsData, isLoading: loadingDoctors } = useQuery<{
    doctors: Doctor[];
  }>({
    queryKey: ["doctors-list"],
    queryFn: async () => {
      const res = await fetch("/api/doctors");
      if (!res.ok) throw new Error("Failed to load doctors");
      return res.json();
    },
  });

  const doctors = doctorsData?.doctors ?? [];

  // ── Fetch queue for selected doctor ─────────────────────────────────────
  const { data: queueData, isLoading: loadingQueue } = useQuery<{
    queue: QueueEntry[];
  }>({
    queryKey: ["queue-override", selectedDoctorId],
    queryFn: async () => {
      const res = await fetch(`/api/queue/${selectedDoctorId}`);
      if (!res.ok) throw new Error("Failed to load queue");
      return res.json();
    },
    enabled: !!selectedDoctorId,
    refetchInterval: 15000,
  });

  const queue = queueData?.queue ?? [];

  // Filter by search
  const filteredQueue = queue.filter((entry) => {
    const name =
      entry.appointment.patient.name.toLowerCase();
    const token = String(entry.appointment.tokenNumber);
    const q = search.toLowerCase();
    return name.includes(q) || token.includes(q) || entry.appointmentId.includes(q);
  });

  // ── Emergency override mutation ──────────────────────────────────────────
  const overrideMutation = useMutation({
    mutationFn: async ({
      appointmentId,
      reason,
    }: {
      appointmentId: string;
      reason: string;
    }) => {
      const res = await fetch("/api/queue/emergency", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ appointmentId, reason }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Override failed");
      }
      return res.json();
    },
    onSuccess: (data, variables) => {
      toast.success(
        `Emergency override applied — patient moved to position ${data.newPosition}`,
        { icon: <Zap className="w-4 h-4 text-yellow-400" /> }
      );
      queryClient.invalidateQueries({
        queryKey: ["queue-override", selectedDoctorId],
      });
      setConfirmEntry(null);
      setOverrideReason("");
    },
    onError: (err: Error) => {
      toast.error(`Override failed: ${err.message}`);
    },
  });

  const handleMoveToFront = useCallback(
    (entry: QueueEntry) => {
      if (!overrideReason.trim()) {
        toast.warning("Please enter an override reason before proceeding.");
        return;
      }
      setConfirmEntry(entry);
    },
    [overrideReason]
  );

  const confirmOverride = () => {
    if (!confirmEntry) return;
    overrideMutation.mutate({
      appointmentId: confirmEntry.appointmentId,
      reason: overrideReason.trim() || "EMERGENCY",
    });
  };

  // ─── Status helpers ──────────────────────────────────────────────────────
  const statusColor: Record<string, string> = {
    BOOKED: "text-blue-400 bg-blue-500/10 border-blue-500/30",
    CHECKED_IN: "text-amber-400 bg-amber-500/10 border-amber-500/30",
    IN_CONSULTATION:
      "text-emerald-400 bg-emerald-500/10 border-emerald-500/30",
    COMPLETED: "text-slate-400 bg-slate-700 border-slate-600",
  };

  return (
    <div className="space-y-6 max-w-4xl">
      {/* ── Header ── */}
      <div className="flex items-start gap-4">
        <div className="w-12 h-12 rounded-2xl bg-red-500/20 flex items-center justify-center shrink-0 border border-red-500/30">
          <AlertTriangle className="w-6 h-6 text-red-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">Emergency Override</h1>
          <p className="text-slate-400 text-sm mt-0.5">
            Move a patient to the front of the queue for urgent care. All
            actions are logged.
          </p>
        </div>
      </div>

      {/* ── Warning banner ── */}
      <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-4 flex items-center gap-3">
        <AlertTriangle className="w-5 h-5 text-red-400 shrink-0" />
        <p className="text-red-300 text-sm">
          <strong className="font-semibold">Admin action required:</strong> Use
          this only for genuine medical emergencies. Every override is recorded
          in the audit log.
        </p>
      </div>

      {/* ── Doctor selector ── */}
      <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-5 backdrop-blur">
        <label className="block text-white font-semibold text-sm mb-3">
          Select Doctor Queue
        </label>
        {loadingDoctors ? (
          <div className="flex items-center gap-2 text-slate-400 text-sm">
            <Loader2 className="w-4 h-4 animate-spin" />
            Loading doctors…
          </div>
        ) : (
          <div className="relative">
            <select
              value={selectedDoctorId}
              onChange={(e) => {
                setSelectedDoctorId(e.target.value);
                setSearch("");
              }}
              className="w-full appearance-none bg-slate-900/60 border border-slate-700 text-white text-sm rounded-xl px-4 py-3 pr-10 focus:outline-none focus:border-sky-500/60 focus:ring-1 focus:ring-sky-500/30 transition-all"
            >
              <option value="">— Choose a doctor —</option>
              {doctors.map((d) => (
                <option key={d.id} value={d.id}>
                  Dr. {d.name} · {d.specialization} ·{" "}
                  {d.department.name}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
          </div>
        )}
      </div>

      {/* ── Override reason ── */}
      <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-5 backdrop-blur">
        <label className="block text-white font-semibold text-sm mb-2">
          Override Reason{" "}
          <span className="text-red-400 text-xs font-normal">* required</span>
        </label>
        <textarea
          value={overrideReason}
          onChange={(e) => setOverrideReason(e.target.value)}
          placeholder="Describe the medical emergency or reason for queue override…"
          rows={3}
          className="w-full bg-slate-900/60 border border-slate-700 focus:border-sky-500/60 focus:ring-1 focus:ring-sky-500/30 text-white text-sm rounded-xl px-4 py-3 placeholder:text-slate-500 focus:outline-none resize-none transition-all"
        />
        <p className="text-slate-500 text-xs mt-2">
          This reason will be stored in the audit log alongside your admin
          account.
        </p>
      </div>

      {/* ── Search bar ── */}
      {selectedDoctorId && (
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by patient name, token number, or appointment ID…"
            className="w-full bg-slate-800/50 border border-slate-700/50 text-white text-sm rounded-xl pl-11 pr-4 py-3 placeholder:text-slate-500 focus:outline-none focus:border-sky-500/60 focus:ring-1 focus:ring-sky-500/30 transition-all backdrop-blur"
          />
        </div>
      )}

      {/* ── Queue list ── */}
      {selectedDoctorId && (
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-5 backdrop-blur">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-white font-semibold text-sm flex items-center gap-2">
              <Users className="w-4 h-4 text-sky-400" />
              Current Queue
              {!loadingQueue && (
                <span className="text-slate-400 font-normal">
                  ({filteredQueue.length} entries)
                </span>
              )}
            </h2>
            {loadingQueue && (
              <Loader2 className="w-4 h-4 text-sky-400 animate-spin" />
            )}
          </div>

          {loadingQueue ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="h-16 bg-slate-700/30 rounded-xl animate-pulse"
                />
              ))}
            </div>
          ) : filteredQueue.length === 0 ? (
            <div className="text-center py-10">
              <CheckCircle2 className="w-10 h-10 text-slate-600 mx-auto mb-3" />
              <p className="text-slate-300 font-medium">Queue is empty</p>
              <p className="text-slate-500 text-sm mt-1">
                {search
                  ? "No patients match your search"
                  : "No patients in the queue right now"}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredQueue.map((entry) => (
                <div
                  key={entry.id}
                  className={`flex items-center gap-3 p-4 rounded-xl border transition-all ${
                    entry.appointment.isEmergency
                      ? "bg-red-500/5 border-red-500/30"
                      : entry.position === 1
                      ? "bg-sky-500/5 border-sky-500/30"
                      : "bg-slate-800/40 border-slate-700/40 hover:border-slate-600/60"
                  }`}
                >
                  {/* Position badge */}
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-sm shrink-0 ${
                      entry.position === 1
                        ? "bg-sky-500/30 text-sky-300"
                        : "bg-slate-700 text-white"
                    }`}
                  >
                    {entry.position}
                  </div>

                  {/* Patient info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-white font-medium text-sm truncate">
                        {entry.appointment.patient.name}
                      </p>
                      {entry.appointment.isEmergency && (
                        <span className="text-xs bg-red-500/20 text-red-300 border border-red-500/30 px-1.5 py-0.5 rounded-full font-medium shrink-0">
                          Emergency
                        </span>
                      )}
                    </div>
                    <p className="text-slate-500 text-xs mt-0.5">
                      Token #{entry.appointment.tokenNumber} ·{" "}
                      {entry.appointment.patient.email} · ~
                      {Math.round(entry.estimatedWaitMins)} min wait
                    </p>
                    <p className="text-slate-600 text-xs font-mono">
                      {entry.appointmentId}
                    </p>
                  </div>

                  {/* Status badge */}
                  <span
                    className={`text-xs px-2 py-1 rounded-full border font-medium shrink-0 ${
                      statusColor[entry.appointment.status] ??
                      "text-slate-400 bg-slate-700 border-slate-600"
                    }`}
                  >
                    {entry.appointment.status.replace(/_/g, " ")}
                  </span>

                  {/* Override button */}
                  {entry.position !== 1 && (
                    <button
                      onClick={() => handleMoveToFront(entry)}
                      disabled={overrideMutation.isPending}
                      className="inline-flex items-center gap-1.5 bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/30 hover:border-red-500/50 px-3 py-2 rounded-xl text-xs font-semibold transition-all shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Zap className="w-3.5 h-3.5" />
                      Move to Front
                    </button>
                  )}

                  {entry.position === 1 && (
                    <span className="text-xs text-sky-400 font-semibold shrink-0 px-2">
                      At front
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Confirmation modal ── */}
      {confirmEntry && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm"
            onClick={() => setConfirmEntry(null)}
          />

          {/* Dialog */}
          <div className="relative z-10 w-full max-w-md bg-slate-800 border border-slate-700/60 rounded-2xl shadow-2xl p-6 space-y-5">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-red-500/20 border border-red-500/30 flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5 text-red-400" />
                </div>
                <h3 className="text-white font-bold text-lg">
                  Confirm Emergency Override
                </h3>
              </div>
              <button
                onClick={() => setConfirmEntry(null)}
                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Patient detail */}
            <div className="bg-slate-900/60 border border-slate-700/50 rounded-xl p-4">
              <p className="text-slate-400 text-xs mb-1">Patient</p>
              <p className="text-white font-semibold">
                {confirmEntry.appointment.patient.name}
              </p>
              <p className="text-slate-400 text-sm mt-1">
                Token #{confirmEntry.appointment.tokenNumber} · Currently at
                position{" "}
                <span className="text-white font-semibold">
                  {confirmEntry.position}
                </span>
              </p>
            </div>

            {/* Reason summary */}
            <div className="bg-slate-900/60 border border-slate-700/50 rounded-xl p-4">
              <p className="text-slate-400 text-xs mb-1">Override Reason</p>
              <p className="text-white text-sm font-medium">{overrideReason}</p>
            </div>

            <p className="text-slate-400 text-sm">
              This will move the patient to{" "}
              <strong className="text-white">position 1</strong> and push all
              others down. This action cannot be undone.
            </p>

            {/* Actions */}
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmEntry(null)}
                className="flex-1 bg-slate-700 hover:bg-slate-600 text-white py-2.5 rounded-xl text-sm font-medium transition-all"
              >
                Cancel
              </button>
              <button
                onClick={confirmOverride}
                disabled={overrideMutation.isPending}
                className="flex-1 bg-red-500 hover:bg-red-400 text-white py-2.5 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 shadow-lg shadow-red-500/25 disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {overrideMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Zap className="w-4 h-4" />
                )}
                {overrideMutation.isPending
                  ? "Applying…"
                  : "Confirm Emergency Override"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
