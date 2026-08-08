"use client";

import { usePathname } from "next/navigation";
import { NotificationBell } from "@/components/shared/NotificationBell";
import { useSession } from "next-auth/react";
import { Activity } from "lucide-react";

const routeLabels: Record<string, string> = {
  "/patient/dashboard": "Dashboard",
  "/patient/book": "Book Appointment",
  "/patient/appointments": "My Appointments",
  "/patient/history": "Medical History",
  "/patient/profile": "My Profile",
  "/doctor/dashboard": "Live Queue",
  "/doctor/appointments": "Appointments",
  "/doctor/history": "Consultation Log",
  "/doctor/profile": "My Profile",
  "/admin/dashboard": "Analytics",
  "/admin/queues": "All Queues — Live",
  "/admin/hospitals": "Hospitals",
  "/admin/departments": "Departments",
  "/admin/doctors": "Doctors",
  "/admin/emergency": "Emergency Override",
};

function getPageLabel(pathname: string): string {
  // Exact match first
  if (routeLabels[pathname]) return routeLabels[pathname];
  // Match by prefix for dynamic routes
  for (const [route, label] of Object.entries(routeLabels)) {
    if (pathname.startsWith(route + "/")) return label;
  }
  return "MediFlow";
}

export function Topbar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const label = getPageLabel(pathname);

  return (
    <div className="hidden lg:flex items-center justify-between mb-6">
      <div>
        <h2 className="text-xl font-bold text-white">{label}</h2>
        <p className="text-slate-500 text-xs mt-0.5">
          Welcome back,{" "}
          <span className="text-slate-400">{session?.user?.name ?? "..."}</span>
        </p>
      </div>
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 bg-slate-800/60 border border-slate-700/50 rounded-xl px-3 py-1.5">
          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-slate-400 text-xs font-medium">System Live</span>
        </div>
        <NotificationBell />
      </div>
    </div>
  );
}
