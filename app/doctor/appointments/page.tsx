"use client";

import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Calendar, Search, Clock, CheckCircle2, AlertTriangle,
  UserX, ChevronDown, Filter,
} from "lucide-react";
import { format, isToday, isTomorrow, isYesterday, parseISO } from "date-fns";
import type { Metadata } from "next";

interface Appointment {
  id: string;
  status: string;
  tokenNumber: number;
  scheduledAt: string;
  appointmentType: string;
  notes?: string | null;
  isEmergency: boolean;
  patient: { user: { name: string; email: string } };
  department: { name: string };
}

const statusConfig: Record<string, { label: string; cls: string }> = {
  BOOKED:           { label: "Booked",          cls: "bg-blue-500/20 text-blue-300 border-blue-500/30" },
  CHECKED_IN:       { label: "Checked In",      cls: "bg-amber-500/20 text-amber-300 border-amber-500/30" },
  IN_CONSULTATION:  { label: "In Consultation", cls: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30" },
  COMPLETED:        { label: "Completed",       cls: "bg-slate-700 text-slate-400 border-slate-600" },
  NO_SHOW:          { label: "No Show",         cls: "bg-red-500/20 text-red-300 border-red-500/30" },
  CANCELLED:        { label: "Cancelled",       cls: "bg-gray-700/50 text-gray-500 border-gray-600/30" },
};

const typeLabel: Record<string, string> = {
  FIRST_CONSULTATION: "First Visit",
  FOLLOW_UP: "Follow Up",
  PRESCRIPTION_REFILL: "Prescription",
  DIAGNOSTIC_REVIEW: "Diagnostic",
};

function groupByDate(appointments: Appointment[]) {
  const groups = new Map<string, Appointment[]>();
  for (const appt of appointments) {
    const date = parseISO(appt.scheduledAt);
    let key: string;
    if (isToday(date)) key = "Today";
    else if (isTomorrow(date)) key = "Tomorrow";
    else if (isYesterday(date)) key = "Yesterday";
    else key = format(date, "EEEE, MMMM d");
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(appt);
  }
  return groups;
}

export default function DoctorAppointmentsPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");

  const { data, isLoading } = useQuery<{ appointments: Appointment[] }>({
    queryKey: ["doctor-appointments"],
    queryFn: () => fetch("/api/appointments?limit=100").then((r) => r.json()),
  });

  const noShowMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/appointments/${id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "NO_SHOW" }),
      });
      if (!res.ok) throw new Error("Failed to mark no-show");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["doctor-appointments"] });
      toast.success("Marked as No Show");
    },
    onError: () => toast.error("Failed to update status"),
  });

  const appointments = data?.appointments ?? [];
  const todayCount = appointments.filter((a) => isToday(parseISO(a.scheduledAt))).length;

  const filtered = useMemo(() => {
    let list = appointments;
    if (statusFilter !== "ALL") list = list.filter((a) => a.status === statusFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (a) =>
          a.patient.user.name.toLowerCase().includes(q) ||
          a.patient.user.email.toLowerCase().includes(q) ||
          a.department.name.toLowerCase().includes(q)
      );
    }
    return list;
  }, [appointments, search, statusFilter]);

  const grouped = groupByDate(filtered);

  const statuses = [
    { value: "ALL", label: "All" },
    { value: "BOOKED", label: "Booked" },
    { value: "CHECKED_IN", label: "Checked In" },
    { value: "IN_CONSULTATION", label: "In Consult" },
    { value: "COMPLETED", label: "Completed" },
    { value: "NO_SHOW", label: "No Show" },
    { value: "CANCELLED", label: "Cancelled" },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Appointments</h1>
        <p className="text-slate-400 text-sm mt-1">
          {todayCount} today · {appointments.length} total
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search patient name, email…"
            className="w-full bg-slate-800/70 border border-slate-700 text-white placeholder:text-slate-500 rounded-xl pl-9 pr-4 py-2.5 text-sm focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500/50 transition-all"
          />
        </div>

        {/* Status dropdown */}
        <div className="relative">
          <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-slate-800 border border-slate-700 text-slate-300 rounded-xl pl-9 pr-8 py-2.5 text-sm focus:outline-none focus:border-sky-500 transition-all appearance-none cursor-pointer"
          >
            {statuses.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500 pointer-events-none" />
        </div>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="space-y-3 animate-pulse">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-20 bg-slate-800/40 rounded-2xl border border-slate-700/30" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-slate-800/30 border border-slate-700/30 rounded-2xl p-12 text-center">
          <Calendar className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <p className="text-slate-300 font-semibold mb-1">No appointments found</p>
          <p className="text-slate-500 text-sm">
            {search || statusFilter !== "ALL" ? "Try adjusting your filters" : "Appointments will appear as patients book"}
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {Array.from(grouped.entries()).map(([date, appts]) => (
            <div key={date}>
              <h3 className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-3 flex items-center gap-2">
                <span>{date}</span>
                <span className="bg-slate-800 border border-slate-700 text-slate-400 text-[10px] px-1.5 py-0.5 rounded-full">{appts.length}</span>
              </h3>
              <div className="space-y-2">
                {appts.map((appt) => {
                  const cfg = statusConfig[appt.status] ?? statusConfig.BOOKED;
                  const canMarkNoShow = appt.status === "BOOKED" || appt.status === "CHECKED_IN";
                  return (
                    <div
                      key={appt.id}
                      className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-4 hover:border-slate-600 transition-all backdrop-blur"
                    >
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <div className="w-10 h-10 rounded-xl bg-slate-700/60 flex items-center justify-center shrink-0 font-bold text-slate-300 text-sm">
                            #{appt.tokenNumber}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-2 mb-0.5">
                              <p className="text-white font-semibold text-sm">{appt.patient.user.name}</p>
                              <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${cfg.cls}`}>
                                {cfg.label}
                              </span>
                              {appt.isEmergency && (
                                <span className="text-[10px] bg-red-500/20 text-red-300 border border-red-500/30 px-2 py-0.5 rounded-full font-medium">
                                  Emergency
                                </span>
                              )}
                            </div>
                            <div className="flex flex-wrap gap-2 text-xs text-slate-400">
                              <span className="flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {format(parseISO(appt.scheduledAt), "h:mm a")}
                              </span>
                              <span>{appt.department.name}</span>
                              <span className="text-slate-500">{typeLabel[appt.appointmentType] ?? appt.appointmentType.replace(/_/g, " ")}</span>
                            </div>
                          </div>
                        </div>

                        {canMarkNoShow && (
                          <button
                            onClick={() => noShowMutation.mutate(appt.id)}
                            disabled={noShowMutation.isPending}
                            className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-red-400 hover:bg-red-500/10 px-3 py-1.5 rounded-lg transition-all border border-transparent hover:border-red-500/20 whitespace-nowrap"
                            title="Mark as No Show"
                          >
                            <UserX className="w-3.5 h-3.5" />
                            No Show
                          </button>
                        )}
                      </div>

                      {appt.notes && (
                        <div className="mt-3 pt-3 border-t border-slate-700/50">
                          <p className="text-slate-500 text-xs italic">"{appt.notes}"</p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
