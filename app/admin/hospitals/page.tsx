"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Building2, MapPin, Clock, CheckCircle2, XCircle,
  Plus, X, Loader2, Globe, Layers,
} from "lucide-react";


interface Hospital {
  id: string;
  name: string;
  city: string;
  address: string;
  timezone: string;
  isActive: boolean;
  _count?: { departments: number; admins: number };
}

function CreateHospitalModal({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ name: "", city: "", address: "", timezone: "UTC" });

  const mutation = useMutation({
    mutationFn: async (payload: typeof form) => {
      const res = await fetch("/api/hospitals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Failed to create hospital");
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-hospitals"] });
      toast.success("Hospital created successfully!");
      onClose();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const TIMEZONES = [
    "UTC", "Asia/Kolkata", "America/New_York", "America/Los_Angeles",
    "Europe/London", "Europe/Paris", "Asia/Dubai", "Asia/Singapore",
    "Asia/Tokyo", "Australia/Sydney",
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md bg-slate-900 border border-slate-700/50 rounded-2xl shadow-2xl p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-white font-bold text-lg">Add Hospital</h2>
          <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4">
          {[
            { key: "name", label: "Hospital Name", placeholder: "e.g. City General Hospital" },
            { key: "city", label: "City", placeholder: "e.g. Mumbai" },
            { key: "address", label: "Address", placeholder: "e.g. 123 Medical Ave" },
          ].map(({ key, label, placeholder }) => (
            <div key={key}>
              <label className="text-sm text-slate-300 font-medium mb-1.5 block">{label}</label>
              <input
                value={form[key as keyof typeof form]}
                onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                placeholder={placeholder}
                className="w-full bg-slate-800 border border-slate-600 text-white placeholder:text-slate-500 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500/50 transition-all"
              />
            </div>
          ))}

          <div>
            <label className="text-sm text-slate-300 font-medium mb-1.5 block">Timezone</label>
            <select
              value={form.timezone}
              onChange={(e) => setForm((f) => ({ ...f, timezone: e.target.value }))}
              className="w-full bg-slate-800 border border-slate-600 text-white rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-sky-500 transition-all"
            >
              {TIMEZONES.map((tz) => (
                <option key={tz} value={tz}>{tz}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button
            onClick={onClose}
            className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 py-3 rounded-xl text-sm font-medium transition-all border border-slate-700"
          >
            Cancel
          </button>
          <button
            onClick={() => mutation.mutate(form)}
            disabled={mutation.isPending || !form.name || !form.city || !form.address}
            className="flex-1 bg-sky-500 hover:bg-sky-400 disabled:bg-sky-500/40 text-white py-3 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2"
          >
            {mutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
            {mutation.isPending ? "Creating..." : "Create Hospital"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function HospitalsPage() {
  const [showCreate, setShowCreate] = useState(false);

  const { data, isLoading } = useQuery<{ hospitals: Hospital[] }>({
    queryKey: ["admin-hospitals"],
    queryFn: async () => {
      const res = await fetch("/api/hospitals");
      if (!res.ok) return { hospitals: [] };
      return res.json();
    },
  });

  const hospitals = data?.hospitals ?? [];

  return (
    <>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Hospitals</h1>
            <p className="text-slate-400 text-sm mt-1">
              {hospitals.length} registered hospital{hospitals.length !== 1 ? "s" : ""}
            </p>
          </div>
          <button
            id="create-hospital-btn"
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 bg-sky-500 hover:bg-sky-400 text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-all shadow-lg shadow-sky-500/25"
          >
            <Plus className="w-4 h-4" />
            Add Hospital
          </button>
        </div>

        {isLoading ? (
          <div className="grid md:grid-cols-2 gap-4 animate-pulse">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-36 bg-slate-800/30 rounded-2xl" />
            ))}
          </div>
        ) : hospitals.length === 0 ? (
          <div className="bg-slate-800/30 border border-slate-700/30 rounded-2xl p-16 text-center">
            <Building2 className="w-16 h-16 text-slate-600 mx-auto mb-4" />
            <p className="text-slate-300 font-semibold text-lg mb-2">No hospitals yet</p>
            <p className="text-slate-500 text-sm mb-4">Add your first hospital or run the seed script</p>
            <button
              onClick={() => setShowCreate(true)}
              className="inline-flex items-center gap-2 bg-sky-500 hover:bg-sky-400 text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition-all"
            >
              <Plus className="w-4 h-4" /> Add Hospital
            </button>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 gap-4">
            {hospitals.map((hospital) => (
              <div
                key={hospital.id}
                className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-5 backdrop-blur hover:border-slate-600 transition-all group"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-xl bg-sky-500/20 flex items-center justify-center">
                      <Building2 className="w-5 h-5 text-sky-400" />
                    </div>
                    <div>
                      <p className="text-white font-semibold text-sm">{hospital.name}</p>
                      <p className="text-slate-400 text-xs">{hospital.city}</p>
                    </div>
                  </div>
                  <span className={`flex items-center gap-1 text-xs px-2.5 py-1 rounded-full border font-medium ${
                    hospital.isActive
                      ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/30"
                      : "text-red-400 bg-red-500/10 border-red-500/30"
                  }`}>
                    {hospital.isActive
                      ? <CheckCircle2 className="w-3 h-3" />
                      : <XCircle className="w-3 h-3" />}
                    {hospital.isActive ? "Active" : "Inactive"}
                  </span>
                </div>

                <div className="space-y-1.5 text-xs text-slate-400">
                  <div className="flex items-center gap-2">
                    <MapPin className="w-3.5 h-3.5 shrink-0 text-slate-500" />
                    <span>{hospital.address}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Globe className="w-3.5 h-3.5 shrink-0 text-slate-500" />
                    <span>{hospital.timezone}</span>
                  </div>
                  {hospital._count && (
                    <div className="flex items-center gap-2">
                      <Layers className="w-3.5 h-3.5 shrink-0 text-slate-500" />
                      <span>{hospital._count.departments} departments</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showCreate && <CreateHospitalModal onClose={() => setShowCreate(false)} />}
    </>
  );
}
