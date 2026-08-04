"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Building2,
  Plus,
  Users,
  CalendarDays,
  X,
  Loader2,
  Stethoscope,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Department {
  id: string;
  name: string;
  description: string | null;
  hospitalId: string;
  isActive: boolean;
  _count: {
    doctors: number;
    appointments: number;
  };
}

function CreateDepartmentModal({
  hospitalId,
  onClose,
}: {
  hospitalId: string;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  const mutation = useMutation({
    mutationFn: async (payload: {
      name: string;
      description?: string;
      hospitalId: string;
    }) => {
      const res = await fetch("/api/departments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Failed to create department");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-departments"] });
      toast.success("Department created successfully!");
      onClose();
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Department name is required");
      return;
    }
    mutation.mutate({
      name: name.trim(),
      description: description.trim() || undefined,
      hospitalId,
    });
  }

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-slate-900 border border-slate-700/60 rounded-2xl shadow-2xl shadow-black/60 w-full max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700/50">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-violet-500/20 flex items-center justify-center">
              <Building2 className="w-4 h-4 text-violet-400" />
            </div>
            <h2 className="text-white font-semibold">Create Department</h2>
          </div>
          <button
            onClick={onClose}
            className="text-slate-500 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="space-y-1.5">
            <label className="text-slate-300 text-sm font-medium">
              Department Name <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Cardiology"
              className="w-full bg-slate-800/70 border border-slate-700/60 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500/50 focus:border-sky-500/50 transition-all"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-slate-300 text-sm font-medium">
              Description{" "}
              <span className="text-slate-500 font-normal">(optional)</span>
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description of this department…"
              rows={3}
              className="w-full bg-slate-800/70 border border-slate-700/60 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500/50 focus:border-sky-500/50 transition-all resize-none"
            />
          </div>

          <div className="flex items-center gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 rounded-xl border border-slate-700/60 text-slate-400 hover:text-white hover:border-slate-600 text-sm font-medium transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={mutation.isPending}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 disabled:opacity-60 disabled:cursor-not-allowed text-white text-sm font-semibold transition-all shadow-lg shadow-sky-500/20"
            >
              {mutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Plus className="w-4 h-4" />
              )}
              {mutation.isPending ? "Creating…" : "Create"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function DepartmentsPage() {
  const [modalOpen, setModalOpen] = useState(false);

  // Neon Auth sessions do not carry hospitalId, so read it from the profile.
  const { data: profile } = useQuery<{ user: { hospitalId: string | null } }>({
    queryKey: ["user-profile"],
    queryFn: async () => {
      const res = await fetch("/api/user/profile");
      if (!res.ok) return { user: { hospitalId: null } };
      return res.json();
    },
  });

  const { data, isLoading } = useQuery<{ departments: Department[] }>({
    queryKey: ["admin-departments"],
    queryFn: async () => {
      const res = await fetch("/api/departments");
      if (!res.ok) return { departments: [] };
      return res.json();
    },
  });

  const departments = data?.departments ?? [];
  const hospitalId = profile?.user?.hospitalId ?? "";

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Departments</h1>
          <p className="text-slate-400 text-sm mt-1">
            {departments.length} department
            {departments.length !== 1 ? "s" : ""} configured
          </p>
        </div>
        <button
          onClick={() => setModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-white text-sm font-semibold transition-all shadow-lg shadow-sky-500/20 shrink-0"
        >
          <Plus className="w-4 h-4" />
          Create Department
        </button>
      </div>

      {/* Loading skeletons */}
      {isLoading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div
              key={i}
              className="h-36 bg-slate-800/30 rounded-2xl animate-pulse"
            />
          ))}
        </div>
      ) : departments.length === 0 ? (
        /* Empty state */
        <div className="bg-slate-800/30 border border-slate-700/30 rounded-2xl p-16 text-center">
          <div className="w-16 h-16 rounded-2xl bg-slate-800 border border-slate-700/50 flex items-center justify-center mx-auto mb-4">
            <Building2 className="w-8 h-8 text-slate-600" />
          </div>
          <p className="text-slate-300 font-semibold text-lg mb-1">
            No departments yet
          </p>
          <p className="text-slate-500 text-sm mb-6">
            Create your first department to get started
          </p>
          <button
            onClick={() => setModalOpen(true)}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-white text-sm font-semibold transition-all shadow-lg shadow-sky-500/20"
          >
            <Plus className="w-4 h-4" />
            Create Department
          </button>
        </div>
      ) : (
        /* Department grid */
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {departments.map((dept) => (
            <div
              key={dept.id}
              className="group bg-slate-800/50 border border-slate-700/50 rounded-2xl p-5 backdrop-blur hover:border-slate-600 hover:bg-slate-800/70 transition-all"
            >
              {/* Icon + Name */}
              <div className="flex items-start gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-violet-500/20 border border-violet-500/20 flex items-center justify-center shrink-0 group-hover:bg-violet-500/30 transition-colors">
                  <Building2 className="w-5 h-5 text-violet-400" />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-white font-semibold text-sm truncate">
                    {dept.name}
                  </h3>
                  <p className="text-slate-500 text-xs mt-0.5 line-clamp-2 leading-relaxed">
                    {dept.description ?? "No description provided"}
                  </p>
                </div>
              </div>

              {/* Badges */}
              <div className="flex items-center gap-2 mt-4">
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-700/50 border border-slate-600/40">
                  <Stethoscope className="w-3 h-3 text-sky-400" />
                  <span className="text-xs text-slate-300 font-medium">
                    {dept._count.doctors}
                  </span>
                  <span className="text-xs text-slate-500">
                    {dept._count.doctors === 1 ? "doctor" : "doctors"}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-700/50 border border-slate-600/40">
                  <CalendarDays className="w-3 h-3 text-emerald-400" />
                  <span className="text-xs text-slate-300 font-medium">
                    {dept._count.appointments}
                  </span>
                  <span className="text-xs text-slate-500">appts</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create modal */}
      {modalOpen && (
        <CreateDepartmentModal
          hospitalId={hospitalId}
          onClose={() => setModalOpen(false)}
        />
      )}
    </div>
  );
}
