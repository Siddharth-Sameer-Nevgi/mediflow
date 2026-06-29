"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import {
  User,
  Mail,
  Phone,
  Calendar,
  ShieldCheck,
  CheckCircle2,
  Clock,
  Activity,
  Pencil,
  Loader2,
} from "lucide-react";
import { EditProfileModal } from "@/components/shared/EditProfileModal";

interface ProfileData {
  name: string;
  email: string;
  phone: string | null;
  role: string;
  createdAt: string;
}

interface AppointmentSummary {
  id: string;
  status: string;
  scheduledAt: string;
}

const roleBadge: Record<string, { label: string; cls: string }> = {
  PATIENT: { label: "Patient", cls: "bg-sky-500/20 text-sky-300 border-sky-500/30" },
  DOCTOR: { label: "Doctor", cls: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30" },
  ADMIN: { label: "Administrator", cls: "bg-violet-500/20 text-violet-300 border-violet-500/30" },
};

function getInitials(name: string): string {
  return name.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase();
}

export default function PatientProfilePage() {
  const [editOpen, setEditOpen] = useState(false);

  const {
    data: profileData,
    isLoading: profileLoading,
    refetch,
  } = useQuery<{ user: ProfileData }>({
    queryKey: ["patient-profile"],
    queryFn: () => fetch("/api/user/profile").then((r) => r.json()),
  });

  const { data: apptData, isLoading: apptLoading } = useQuery<{
    appointments: AppointmentSummary[];
  }>({
    queryKey: ["patient-appointments-summary"],
    queryFn: () => fetch("/api/appointments").then((r) => r.json()),
  });

  const user = profileData?.user;
  const appointments = apptData?.appointments ?? [];

  const totalAppointments = appointments.length;
  const completedAppointments = appointments.filter((a) => a.status === "COMPLETED").length;
  const upcomingAppointments = appointments.filter(
    (a) => ["BOOKED", "CHECKED_IN"].includes(a.status) && new Date(a.scheduledAt) >= new Date()
  ).length;
  const cancelledAppointments = appointments.filter((a) => a.status === "CANCELLED").length;

  const badge = user ? (roleBadge[user.role] ?? roleBadge.PATIENT) : roleBadge.PATIENT;

  const stats = [
    { label: "Total",     value: totalAppointments,     icon: Activity,     color: "sky" },
    { label: "Completed", value: completedAppointments, icon: CheckCircle2, color: "emerald" },
    { label: "Upcoming",  value: upcomingAppointments,  icon: Clock,        color: "amber" },
    { label: "Cancelled", value: cancelledAppointments, icon: Calendar,     color: "slate" },
  ];

  if (profileLoading || apptLoading) {
    return (
      <div className="animate-pulse space-y-6 max-w-3xl">
        <div className="space-y-2">
          <div className="h-7 bg-slate-800 rounded-xl w-40" />
          <div className="h-4 bg-slate-800/60 rounded-lg w-64" />
        </div>
        <div className="bg-slate-800/40 border border-slate-700/30 rounded-2xl p-6">
          <div className="flex items-center gap-5">
            <div className="w-20 h-20 rounded-2xl bg-slate-700 shrink-0" />
            <div className="space-y-2">
              <div className="h-6 bg-slate-700 rounded w-48" />
              <div className="h-4 bg-slate-700/60 rounded w-24" />
            </div>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1,2,3,4].map((i) => (
            <div key={i} className="bg-slate-800/40 border border-slate-700/30 rounded-2xl p-4 space-y-3">
              <div className="w-9 h-9 rounded-xl bg-slate-700" />
              <div className="h-7 bg-slate-700 rounded w-12" />
              <div className="h-3 bg-slate-700/60 rounded w-20" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 text-slate-500 animate-spin" />
      </div>
    );
  }

  return (
    <>
      <div className="space-y-6 max-w-3xl">
        {/* Heading */}
        <div>
          <h1 className="text-2xl font-bold text-white">My Profile</h1>
          <p className="text-slate-400 text-sm mt-1">
            Manage your personal information and account details
          </p>
        </div>

        {/* Profile card */}
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-6 backdrop-blur">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5">
            {/* Avatar */}
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-sky-500 to-blue-600 flex items-center justify-center shrink-0 shadow-lg shadow-sky-500/20">
              <span className="text-white font-black text-2xl tracking-tight">
                {getInitials(user.name)}
              </span>
            </div>

            {/* Identity */}
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <h2 className="text-xl font-bold text-white truncate">{user.name}</h2>
                <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5 rounded-full border ${badge.cls}`}>
                  <ShieldCheck className="w-3 h-3" />
                  {badge.label}
                </span>
              </div>
              <p className="text-slate-400 text-sm">{user.email}</p>
              <p className="text-slate-500 text-xs mt-1">
                Member since {format(new Date(user.createdAt), "MMMM yyyy")}
              </p>
            </div>

            {/* Edit button */}
            <button
              id="edit-profile-btn"
              onClick={() => setEditOpen(true)}
              className="flex items-center gap-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 hover:text-white px-3.5 py-2 rounded-xl text-sm font-medium transition-all border border-slate-600"
            >
              <Pencil className="w-3.5 h-3.5" />
              Edit
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {stats.map((stat) => (
            <div
              key={stat.label}
              className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-4 backdrop-blur"
            >
              <div className={`w-9 h-9 rounded-xl bg-${stat.color}-500/20 flex items-center justify-center mb-3`}>
                <stat.icon className={`w-4 h-4 text-${stat.color}-400`} />
              </div>
              <div className="text-2xl font-bold text-white">{stat.value}</div>
              <div className="text-slate-400 text-xs mt-0.5">{stat.label}</div>
            </div>
          ))}
        </div>

        {/* Contact info */}
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-6 backdrop-blur">
          <h3 className="text-white font-semibold text-sm mb-4">Contact Information</h3>
          <div className="space-y-4">
            {[
              { icon: Mail, label: "Email address", value: user.email },
              {
                icon: Phone,
                label: "Phone number",
                value: user.phone ?? (
                  <button
                    onClick={() => setEditOpen(true)}
                    className="text-sky-400 hover:text-sky-300 text-sm transition-colors"
                  >
                    Add phone number →
                  </button>
                ),
              },
              {
                icon: Calendar,
                label: "Account created",
                value: format(new Date(user.createdAt), "MMMM d, yyyy"),
              },
              { icon: User, label: "User ID", value: <span className="font-mono text-xs text-slate-500">{user.email.split("@")[0]}</span> },
            ].map((row, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-slate-700/60 flex items-center justify-center shrink-0">
                  <row.icon className="w-4 h-4 text-slate-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-slate-500 text-xs">{row.label}</p>
                  {typeof row.value === "string" ? (
                    <p className="text-white text-sm font-medium truncate">{row.value}</p>
                  ) : (
                    <div className="text-white text-sm font-medium">{row.value}</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Edit modal */}
      <EditProfileModal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        initialName={user.name}
        initialPhone={user.phone}
        onSuccess={() => refetch()}
      />
    </>
  );
}
