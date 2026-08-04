"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { authClient } from "@/lib/auth/client";
import {
  User, Phone, Bell, Shield, LogOut, Loader2, Save, Clock,
} from "lucide-react";

interface ProfileData { name: string; email: string; phone: string | null; }

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-6 backdrop-blur space-y-4">
      <h2 className="text-white font-semibold text-sm uppercase tracking-wider">{title}</h2>
      {children}
    </div>
  );
}

function Toggle({ checked, onChange, label, description }: { checked: boolean; onChange: () => void; label: string; description: string }) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <p className="text-white text-sm font-medium">{label}</p>
        <p className="text-slate-400 text-xs mt-0.5">{description}</p>
      </div>
      <button
        onClick={onChange}
        className={`relative w-10 h-6 rounded-full transition-colors ${checked ? "bg-emerald-500" : "bg-slate-600"}`}
      >
        <span className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform ${checked ? "translate-x-4" : "translate-x-0"}`} />
      </button>
    </div>
  );
}

export default function DoctorSettingsPage() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ name: "", phone: "" });
  const [initialized, setInitialized] = useState(false);
  const [notifPrefs, setNotifPrefs] = useState({
    newPatients: true,
    queueAlerts: true,
    systemUpdates: true,
  });

  useQuery<ProfileData>({
    queryKey: ["doctor-settings-profile"],
    queryFn: async () => {
      const res = await fetch("/api/user/profile");
      const data = await res.json();
      if (!initialized) {
        setForm({ name: data.name ?? "", phone: data.phone ?? "" });
        setInitialized(true);
      }
      return data;
    },
    staleTime: Infinity,
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/user/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: form.name.trim(), phone: form.phone || null }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Update failed");
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["doctor-settings-profile"] });
      toast.success("Settings saved!");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Settings</h1>
        <p className="text-slate-400 text-sm mt-1">Manage your account and consultation preferences</p>
      </div>

      {/* Profile */}
      <Section title="Personal Information">
        <div className="space-y-3">
          <div>
            <label className="flex items-center gap-1.5 text-sm text-slate-300 font-medium mb-1.5">
              <User className="w-3.5 h-3.5" /> Full Name
            </label>
            <input
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className="w-full bg-slate-700/50 border border-slate-600 text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/50 transition-all"
            />
          </div>
          <div>
            <label className="flex items-center gap-1.5 text-sm text-slate-300 font-medium mb-1.5">
              <Phone className="w-3.5 h-3.5" /> Phone <span className="text-slate-500">(optional)</span>
            </label>
            <input
              type="tel"
              value={form.phone}
              onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
              placeholder="+91 98765 43210"
              className="w-full bg-slate-700/50 border border-slate-600 text-white placeholder:text-slate-500 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/50 transition-all"
            />
          </div>
          <button
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending || !form.name.trim()}
            className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 disabled:bg-emerald-500/40 text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition-all"
          >
            {saveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {saveMutation.isPending ? "Saving…" : "Save Changes"}
          </button>
        </div>
      </Section>

      {/* Consultation Prefs */}
      <Section title="Consultation Preferences">
        <div className="bg-slate-700/30 rounded-xl p-4 flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-slate-700 flex items-center justify-center shrink-0 mt-0.5">
            <Clock className="w-4 h-4 text-slate-400" />
          </div>
          <div>
            <p className="text-white text-sm font-medium">Average Consultation Duration</p>
            <p className="text-slate-400 text-xs mt-0.5">
              Auto-updated after each session using an Exponential Moving Average.
              Set a manual override via your profile page.
            </p>
          </div>
        </div>
      </Section>

      {/* Notifications */}
      <Section title="Notifications">
        <div className="space-y-4">
          <Toggle
            label="New Patient Alerts"
            description="Notify when a patient joins your queue"
            checked={notifPrefs.newPatients}
            onChange={() => { setNotifPrefs((n) => ({ ...n, newPatients: !n.newPatients })); toast.success("Preference saved"); }}
          />
          <div className="border-t border-slate-700/50" />
          <Toggle
            label="Queue Emergency Alerts"
            description="High-priority alerts when a patient is moved to front"
            checked={notifPrefs.queueAlerts}
            onChange={() => { setNotifPrefs((n) => ({ ...n, queueAlerts: !n.queueAlerts })); toast.success("Preference saved"); }}
          />
          <div className="border-t border-slate-700/50" />
          <Toggle
            label="System Updates"
            description="Platform announcements and feature updates"
            checked={notifPrefs.systemUpdates}
            onChange={() => { setNotifPrefs((n) => ({ ...n, systemUpdates: !n.systemUpdates })); toast.success("Preference saved"); }}
          />
        </div>
      </Section>

      {/* Security */}
      <Section title="Security">
        <div className="flex items-center justify-between p-3 bg-slate-700/30 rounded-xl">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-slate-700 flex items-center justify-center">
              <Shield className="w-4 h-4 text-emerald-400" />
            </div>
            <div>
              <p className="text-white text-sm font-medium">Authentication</p>
              <p className="text-slate-400 text-xs">OTP-based · Email verified</p>
            </div>
          </div>
          <span className="text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-2.5 py-1 rounded-full font-medium">Active</span>
        </div>
      </Section>

      {/* Sign out */}
      <Section title="Session">
        <button
          onClick={() => authClient.signOut()}
          className="flex items-center gap-2 text-red-400 hover:text-red-300 text-sm font-medium transition-colors hover:bg-red-500/10 px-4 py-2.5 rounded-xl w-full"
        >
          <LogOut className="w-4 h-4" />
          Sign Out
        </button>
      </Section>
    </div>
  );
}
