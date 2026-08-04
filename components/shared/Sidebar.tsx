"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { authClient } from "@/lib/auth/client";
import { normalizeRole } from "@/lib/auth/roles";
import {
  Activity,
  Calendar,
  LayoutDashboard,
  LogOut,
  Menu,
  Moon,
  Sun,
  X,
  Users,
  Stethoscope,
  BarChart3,
  Building2,
  ChevronLeft,
  FileText,
  AlertTriangle,
  UserCircle,
  BookOpen,
  History,
  Siren,
  LayoutList,
  Layers,
  Settings,
} from "lucide-react";
import { useState } from "react";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";
import { NotificationBell } from "@/components/shared/NotificationBell";

const patientNav = [
  { href: "/patient/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/patient/book", label: "Book Appointment", icon: BookOpen },
  { href: "/patient/appointments", label: "Appointments", icon: Calendar },
  { href: "/patient/history", label: "Medical History", icon: History },
  { href: "/patient/profile", label: "My Profile", icon: UserCircle },
  { href: "/patient/settings", label: "Settings", icon: Settings },
];

const doctorNav = [
  { href: "/doctor/dashboard", label: "Live Queue", icon: LayoutDashboard },
  { href: "/doctor/appointments", label: "Appointments", icon: Calendar },
  { href: "/doctor/history", label: "Consultation Log", icon: FileText },
  { href: "/doctor/profile", label: "My Profile", icon: UserCircle },
  { href: "/doctor/settings", label: "Settings", icon: Settings },
];

const adminNav = [
  { href: "/admin/dashboard", label: "Analytics", icon: BarChart3 },
  { href: "/admin/queues", label: "All Queues", icon: LayoutList },
  { href: "/admin/hospitals", label: "Hospitals", icon: Building2 },
  { href: "/admin/departments", label: "Departments", icon: Layers },
  { href: "/admin/doctors", label: "Doctors", icon: Stethoscope },
  { href: "/admin/emergency", label: "Emergency Override", icon: Siren },
  { href: "/admin/settings", label: "Settings", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const { data: session } = authClient.useSession();
  const { theme, setTheme } = useTheme();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  const role = normalizeRole(session?.user?.role);
  const navItems =
    role === "DOCTOR" ? doctorNav : role === "ADMIN" ? adminNav : patientNav;

  const roleColors: Record<string, string> = {
    PATIENT: "from-sky-500 to-blue-600",
    DOCTOR: "from-emerald-500 to-teal-600",
    ADMIN: "from-violet-500 to-purple-600",
  };

  const roleIcon: Record<string, React.ElementType> = {
    PATIENT: Users,
    DOCTOR: Stethoscope,
    ADMIN: BarChart3,
  };

  const RoleIcon = roleIcon[role] ?? Users;

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className={cn("p-4 flex items-center gap-3 border-b border-slate-700/50", collapsed && "justify-center")}>
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-sky-400 to-blue-600 flex items-center justify-center shrink-0 shadow-lg shadow-sky-500/20">
          <Activity className="w-5 h-5 text-white" />
        </div>
        {!collapsed && (
          <div>
            <span className="text-white font-bold text-base">MediFlow AI</span>
            <div className="text-slate-500 text-xs">{role.charAt(0) + role.slice(1).toLowerCase()} Portal</div>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + "/");
          const isEmergency = item.href === "/admin/emergency";
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all",
                active
                  ? isEmergency
                    ? "bg-red-500/20 text-red-300 border border-red-500/30"
                    : "bg-sky-500/20 text-sky-300 border border-sky-500/30"
                  : isEmergency
                    ? "text-red-400/70 hover:text-red-300 hover:bg-red-500/10"
                    : "text-slate-400 hover:text-white hover:bg-slate-700/50",
                collapsed && "justify-center px-2"
              )}
            >
              <item.icon className={cn("w-5 h-5 shrink-0", active ? (isEmergency ? "text-red-400" : "text-sky-400") : "")} />
              {!collapsed && <span>{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Bottom actions */}
      <div className="p-3 border-t border-slate-700/50 space-y-2">
        {/* Theme toggle */}
        <button
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          className={cn(
            "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-slate-400 hover:text-white hover:bg-slate-700/50 transition-all",
            collapsed && "justify-center"
          )}
        >
          {theme === "dark" ? (
            <Sun className="w-5 h-5 shrink-0" />
          ) : (
            <Moon className="w-5 h-5 shrink-0" />
          )}
          {!collapsed && <span>{theme === "dark" ? "Light Mode" : "Dark Mode"}</span>}
        </button>

        {/* User */}
        <div className={cn("flex items-center gap-3 px-3 py-2 rounded-xl bg-slate-700/30", collapsed && "justify-center")}>
          <div className={cn("w-8 h-8 rounded-lg bg-gradient-to-br shrink-0 flex items-center justify-center", roleColors[role])}>
            <RoleIcon className="w-4 h-4 text-white" />
          </div>
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <div className="text-white text-xs font-semibold truncate">
                {session?.user?.name ?? "User"}
              </div>
              <div className="text-slate-500 text-xs truncate">
                {session?.user?.email}
              </div>
            </div>
          )}
        </div>

        <button
          onClick={() => authClient.signOut()}
          className={cn(
            "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-all",
            collapsed && "justify-center"
          )}
        >
          <LogOut className="w-5 h-5 shrink-0" />
          {!collapsed && <span>Sign Out</span>}
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar */}
      <aside
        className={cn(
          "hidden lg:flex flex-col h-screen bg-slate-900 border-r border-slate-700/50 sticky top-0 transition-all duration-300",
          collapsed ? "w-16" : "w-64"
        )}
      >
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="absolute -right-3 top-8 w-6 h-6 bg-slate-800 border border-slate-700 rounded-full flex items-center justify-center text-slate-400 hover:text-white transition-colors z-10"
        >
          <ChevronLeft className={cn("w-3 h-3 transition-transform", collapsed && "rotate-180")} />
        </button>
        <SidebarContent />
      </aside>

      {/* Mobile Header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-40 bg-slate-900/95 backdrop-blur border-b border-slate-700/50 h-14 flex items-center justify-between px-4">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-sky-400 to-blue-600 flex items-center justify-center">
            <Activity className="w-4 h-4 text-white" />
          </div>
          <span className="text-white font-bold text-sm">MediFlow AI</span>
        </div>
        <div className="flex items-center gap-2">
          <NotificationBell />
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="text-slate-400 hover:text-white transition-colors"
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-30 pt-14">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />
          <div className="relative w-72 h-full bg-slate-900 border-r border-slate-700/50">
            <SidebarContent />
          </div>
        </div>
      )}
    </>
  );
}
