"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { signOut } from "next-auth/react";
import {
  Shield, LogOut, Globe, Database, Activity, Server, Users,
  CheckCircle2, AlertTriangle,
} from "lucide-react";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-6 backdrop-blur space-y-4">
      <h2 className="text-white font-semibold text-sm uppercase tracking-wider">{title}</h2>
      {children}
    </div>
  );
}

function InfoRow({ label, value, status }: { label: string; value: string; status?: "ok" | "warn" }) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-slate-700/40 last:border-0">
      <span className="text-slate-400 text-sm">{label}</span>
      <div className="flex items-center gap-2">
        {status === "ok" && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />}
        {status === "warn" && <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />}
        <span className="text-white text-sm font-medium">{value}</span>
      </div>
    </div>
  );
}

export default function AdminSettingsPage() {
  const [confirmSignOut, setConfirmSignOut] = useState(false);

  const { data: analytics } = useQuery({
    queryKey: ["admin-system-info"],
    queryFn: () => fetch("/api/admin/analytics").then((r) => r.json()),
    staleTime: 60000,
  });

  const totalAppointments = analytics?.appointments?.total ?? "—";
  const activeUsers = analytics?.users?.total ?? "—";

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Admin Settings</h1>
        <p className="text-slate-400 text-sm mt-1">Platform configuration and system health</p>
      </div>

      {/* System Health */}
      <Section title="System Status">
        <div>
          <InfoRow label="Database" value="PostgreSQL · Neon" status="ok" />
          <InfoRow label="Real-time Server" value="Socket.IO · Port 3001" status="ok" />
          <InfoRow label="AI Provider" value="Mock (set GEMINI_API_KEY for Gemini)" status="warn" />
          <InfoRow label="Email Provider" value="OTP Auth · requires RESEND_API_KEY" status="warn" />
          <InfoRow label="Total Appointments" value={String(totalAppointments)} />
          <InfoRow label="Active Users" value={String(activeUsers)} />
        </div>
      </Section>

      {/* Security */}
      <Section title="Security">
        <div className="space-y-3">
          <div className="flex items-center justify-between p-3 bg-slate-700/30 rounded-xl">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-slate-700 flex items-center justify-center">
                <Shield className="w-4 h-4 text-emerald-400" />
              </div>
              <div>
                <p className="text-white text-sm font-medium">Role-Based Access Control</p>
                <p className="text-slate-400 text-xs">Patient · Doctor · Admin roles enforced on all routes</p>
              </div>
            </div>
            <span className="text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-2.5 py-1 rounded-full font-medium">Active</span>
          </div>

          <div className="flex items-center justify-between p-3 bg-slate-700/30 rounded-xl">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-slate-700 flex items-center justify-center">
                <Activity className="w-4 h-4 text-sky-400" />
              </div>
              <div>
                <p className="text-white text-sm font-medium">Audit Logging</p>
                <p className="text-slate-400 text-xs">All admin and doctor actions are logged</p>
              </div>
            </div>
            <span className="text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-2.5 py-1 rounded-full font-medium">Active</span>
          </div>
        </div>
      </Section>

      {/* Environment Checklist */}
      <Section title="Environment Variables">
        <div className="space-y-2 text-sm">
          {[
            { key: "DATABASE_URL", desc: "PostgreSQL connection (Neon)", required: true },
            { key: "NEXTAUTH_SECRET", desc: "Auth.js session secret", required: true },
            { key: "GEMINI_API_KEY", desc: "Google Gemini for triage and wait prediction", required: false },
            { key: "RESEND_API_KEY", desc: "Email OTP delivery", required: true },
            { key: "SOCKET_SERVER_URL", desc: "Socket.IO server endpoint", required: false },
          ].map(({ key, desc, required }) => (
            <div key={key} className="flex items-center justify-between p-3 bg-slate-700/20 rounded-xl">
              <div>
                <p className="text-slate-200 font-mono text-xs">{key}</p>
                <p className="text-slate-500 text-[11px] mt-0.5">{desc}</p>
              </div>
              <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${required ? "text-red-300 bg-red-500/10 border-red-500/30" : "text-slate-400 bg-slate-700 border-slate-600"}`}>
                {required ? "Required" : "Optional"}
              </span>
            </div>
          ))}
        </div>
      </Section>

      {/* Session */}
      <Section title="Session">
        {!confirmSignOut ? (
          <button
            onClick={() => setConfirmSignOut(true)}
            className="flex items-center gap-2 text-red-400 hover:text-red-300 text-sm font-medium transition-colors hover:bg-red-500/10 px-4 py-2.5 rounded-xl w-full"
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>
        ) : (
          <div className="flex items-center gap-3">
            <p className="text-slate-400 text-sm flex-1">Confirm sign out?</p>
            <button onClick={() => setConfirmSignOut(false)} className="text-slate-400 text-sm hover:text-white px-3 py-1.5 rounded-lg">Cancel</button>
            <button onClick={() => signOut({ callbackUrl: "/login" })} className="bg-red-500 hover:bg-red-400 text-white text-sm px-4 py-1.5 rounded-lg font-medium transition-all">
              Sign Out
            </button>
          </div>
        )}
      </Section>
    </div>
  );
}
