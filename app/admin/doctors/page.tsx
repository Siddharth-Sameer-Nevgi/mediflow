"use client";

import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Search,
  Stethoscope,
  CircleDot,
  CircleOff,
  Users,
  Building2,
  Plus,
  X,
  Loader2,
  DollarSign,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Doctor {
  id: string;
  name: string;
  email: string;
  specialization: string;
  consultationFee: number;
  isAvailable: boolean;
  department: {
    id: string;
    name: string;
  } | null;
  _count: {
    appointments: number;
  };
}

interface Department { id: string; name: string; }

function AddDoctorModal({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    name: "", email: "", phone: "", specialization: "",
    departmentId: "", licenseNumber: "", avgConsultMins: 15,
  });

  const { data: deptData } = useQuery<{ departments: Department[] }>({
    queryKey: ["departments-list"],
    queryFn: () => fetch("/api/departments").then((r) => r.json()),
  });
  const departments = deptData?.departments ?? [];

  const mutation = useMutation({
    mutationFn: async (payload: typeof form) => {
      const res = await fetch("/api/doctors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Failed");
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-doctors"] });
      toast.success("Doctor added successfully!");
      onClose();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const fields = [
    { key: "name", label: "Full Name", placeholder: "Dr. Jane Smith" },
    { key: "email", label: "Email", placeholder: "doctor@hospital.com" },
    { key: "phone", label: "Phone (optional)", placeholder: "+91 98765 43210" },
    { key: "specialization", label: "Specialization", placeholder: "Cardiology" },
    { key: "licenseNumber", label: "License Number", placeholder: "MCI-12345" },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-slate-900 border border-slate-700/50 rounded-2xl shadow-2xl p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-white font-bold text-lg">Add New Doctor</h2>
          <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-3">
          {fields.map(({ key, label, placeholder }) => (
            <div key={key}>
              <label className="text-sm text-slate-300 font-medium mb-1 block">{label}</label>
              <input
                value={form[key as keyof typeof form] as string}
                onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                placeholder={placeholder}
                type={key === "email" ? "email" : key === "phone" ? "tel" : "text"}
                className="w-full bg-slate-800 border border-slate-600 text-white placeholder:text-slate-500 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500/50 transition-all"
              />
            </div>
          ))}

          <div>
            <label className="text-sm text-slate-300 font-medium mb-1 block">Department</label>
            <select
              value={form.departmentId}
              onChange={(e) => setForm((f) => ({ ...f, departmentId: e.target.value }))}
              className="w-full bg-slate-800 border border-slate-600 text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-sky-500 transition-all"
            >
              <option value="">Select department…</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-sm text-slate-300 font-medium mb-1 block">Avg Consult Duration (min)</label>
            <input
              type="number" min={5} max={120}
              value={form.avgConsultMins}
              onChange={(e) => setForm((f) => ({ ...f, avgConsultMins: Number(e.target.value) }))}
              className="w-full bg-slate-800 border border-slate-600 text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-sky-500 transition-all"
            />
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button onClick={onClose} className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 py-3 rounded-xl text-sm font-medium transition-all border border-slate-700">
            Cancel
          </button>
          <button
            onClick={() => mutation.mutate(form)}
            disabled={mutation.isPending || !form.name || !form.email || !form.specialization || !form.departmentId || !form.licenseNumber}
            className="flex-1 bg-emerald-500 hover:bg-emerald-400 disabled:bg-emerald-500/40 text-white py-3 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2"
          >
            {mutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
            {mutation.isPending ? "Adding..." : "Add Doctor"}
          </button>
        </div>
      </div>
    </div>
  );
}

const AVATAR_COLORS = [
  "from-sky-500 to-blue-600",
  "from-violet-500 to-purple-600",
  "from-emerald-500 to-teal-600",
  "from-amber-500 to-orange-600",
  "from-rose-500 to-pink-600",
  "from-cyan-500 to-sky-600",
];

function getInitials(name: string): string {
  return name.split(" ").slice(0, 2).map((p) => p[0]?.toUpperCase() ?? "").join("");
}

function avatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + hash * 31;
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

export default function DoctorsPage() {
  const [search, setSearch] = useState("");
  const [showAdd, setShowAdd] = useState(false);

  const { data, isLoading } = useQuery<{ doctors: Doctor[] }>({
    queryKey: ["admin-doctors"],
    queryFn: async () => {
      const res = await fetch("/api/doctors");
      if (!res.ok) return { doctors: [] };
      return res.json();
    },
  });

  const doctors = data?.doctors ?? [];

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return doctors;
    return doctors.filter(
      (d) =>
        d.name.toLowerCase().includes(q) ||
        d.specialization.toLowerCase().includes(q) ||
        d.department?.name.toLowerCase().includes(q)
    );
  }, [doctors, search]);

  return (
    <>
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Doctors</h1>
          <p className="text-slate-400 text-sm mt-1">
            {doctors.length} registered doctor{doctors.length !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Search */}
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name or specialization…"
              className="w-full bg-slate-800/70 border border-slate-700/60 rounded-xl pl-9 pr-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500/50 focus:border-sky-500/50 transition-all"
            />
          </div>
          <button
            id="add-doctor-btn"
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-all shadow-lg shadow-emerald-500/25 whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            Add Doctor
          </button>
        </div>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              className="h-16 bg-slate-800/30 rounded-xl animate-pulse"
            />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-slate-800/30 border border-slate-700/30 rounded-2xl p-16 text-center">
          <div className="w-16 h-16 rounded-2xl bg-slate-800 border border-slate-700/50 flex items-center justify-center mx-auto mb-4">
            <Stethoscope className="w-8 h-8 text-slate-600" />
          </div>
          <p className="text-slate-300 font-semibold text-lg mb-1">
            {search ? "No doctors match your search" : "No doctors registered"}
          </p>
          <p className="text-slate-500 text-sm">
            {search
              ? `Try a different name or specialization`
              : "Doctors will appear here once they register"}
          </p>
        </div>
      ) : (
        <div className="bg-slate-800/40 border border-slate-700/40 rounded-2xl overflow-hidden">
          {/* Table header — desktop */}
          <div className="hidden md:grid grid-cols-[2.5fr_1.5fr_1.5fr_1fr_1fr_auto] gap-4 px-5 py-3 border-b border-slate-700/50 text-xs font-semibold uppercase tracking-wide text-slate-500">
            <span>Doctor</span>
            <span>Specialization</span>
            <span>Department</span>
            <span className="text-right">Fee</span>
            <span className="text-right">Today</span>
            <span className="text-center">Status</span>
          </div>

          {/* Rows */}
          <div className="divide-y divide-slate-700/30">
            {filtered.map((doctor) => {
              const initials = getInitials(doctor.name);
              const color = avatarColor(doctor.name);

              return (
                <div
                  key={doctor.id}
                  className="grid md:grid-cols-[2.5fr_1.5fr_1.5fr_1fr_1fr_auto] gap-4 items-center px-5 py-4 hover:bg-slate-800/50 transition-colors"
                >
                  {/* Avatar + Name */}
                  <div className="flex items-center gap-3">
                    <div
                      className={cn(
                        "w-9 h-9 rounded-xl bg-gradient-to-br shrink-0 flex items-center justify-center text-white text-xs font-bold shadow-md",
                        color
                      )}
                    >
                      {initials}
                    </div>
                    <div className="min-w-0">
                      <p className="text-white text-sm font-semibold truncate">
                        {doctor.name}
                      </p>
                      <p className="text-slate-500 text-xs truncate">
                        {doctor.email}
                      </p>
                    </div>
                  </div>

                  {/* Specialization */}
                  <div className="flex items-center gap-1.5">
                    <Stethoscope className="w-3.5 h-3.5 text-sky-400 shrink-0 hidden md:block" />
                    <span className="text-slate-300 text-sm truncate">
                      {doctor.specialization}
                    </span>
                  </div>

                  {/* Department */}
                  <div className="flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5 text-slate-500 shrink-0 hidden md:block" />
                    <span className="text-slate-400 text-sm truncate">
                      {doctor.department?.name ?? (
                        <span className="text-slate-600 italic">
                          Unassigned
                        </span>
                      )}
                    </span>
                  </div>

                  {/* Consultation fee */}
                  <div className="flex items-center justify-end gap-1">
                    <DollarSign className="w-3.5 h-3.5 text-emerald-400 hidden md:block" />
                    <span className="text-slate-300 text-sm font-medium tabular-nums">
                      {doctor.consultationFee.toLocaleString()}
                    </span>
                  </div>

                  {/* Today's patients */}
                  <div className="flex items-center justify-end gap-1.5">
                    <Users className="w-3.5 h-3.5 text-slate-500 hidden md:block" />
                    <span
                      className={cn(
                        "text-sm font-semibold tabular-nums",
                        doctor._count.appointments > 0
                          ? "text-sky-400"
                          : "text-slate-600"
                      )}
                    >
                      {doctor._count.appointments}
                    </span>
                  </div>

                  {/* Status badge */}
                  <div className="flex justify-center md:justify-end">
                    <span
                      className={cn(
                        "inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border",
                        doctor.isAvailable
                          ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/30"
                          : "text-slate-500 bg-slate-700/30 border-slate-600/30"
                      )}
                    >
                      {doctor.isAvailable ? (
                        <CircleDot className="w-3 h-3" />
                      ) : (
                        <CircleOff className="w-3 h-3" />
                      )}
                      {doctor.isAvailable ? "Active" : "Inactive"}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Footer summary */}
          <div className="flex items-center justify-between px-5 py-3 border-t border-slate-700/50 bg-slate-800/20">
            <p className="text-slate-500 text-xs">
              Showing{" "}
              <span className="text-slate-300 font-medium">
                {filtered.length}
              </span>{" "}
              of{" "}
              <span className="text-slate-300 font-medium">
                {doctors.length}
              </span>{" "}
              doctors
            </p>
            {search && (
              <button
                onClick={() => setSearch("")}
                className="text-xs text-sky-400 hover:text-sky-300 transition-colors"
              >
                Clear filter
              </button>
            )}
          </div>
        </div>
      )}
    </div>
    {showAdd && <AddDoctorModal onClose={() => setShowAdd(false)} />}
  </>);
}
