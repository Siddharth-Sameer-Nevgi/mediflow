import { getSessionUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import {
  User,
  Mail,
  Phone,
  Stethoscope,
  Building2,
  BadgeDollarSign,
  Users,
  CheckCircle2,
  Clock,
  Activity,
  ShieldCheck,
  Pencil,
} from "lucide-react";
import { format, isToday } from "date-fns";
import { AvailabilityToggle } from "@/components/doctor/AvailabilityToggle";
import Link from "next/link";

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export default async function DoctorProfilePage() {
  const session = await getSessionUser();
  if (!session?.id) redirect("/login");

  const doctor = await prisma.doctor.findUnique({
    where: { userId: session.id },
    include: {
      department: true,
      appointments: { where: { deletedAt: null } },
    },
  });

  if (!doctor) redirect("/doctor/dashboard");

  const { department, appointments } = doctor;
  // Identity now lives on the Doctor row itself, mirrored from Neon Auth.
  const user = {
    name: doctor.name,
    email: doctor.email,
    phone: doctor.phone,
    createdAt: doctor.createdAt,
  };

  const todaysPatients = appointments.filter((a) =>
    isToday(new Date(a.scheduledAt))
  ).length;

  const completedToday = appointments.filter(
    (a) => isToday(new Date(a.scheduledAt)) && a.status === "COMPLETED"
  ).length;

  const totalCompleted = appointments.filter(
    (a) => a.status === "COMPLETED"
  ).length;

  const upcomingToday = appointments.filter(
    (a) =>
      isToday(new Date(a.scheduledAt)) &&
      ["BOOKED", "CHECKED_IN", "IN_CONSULTATION"].includes(a.status)
  ).length;

  const stats = [
    {
      label: "Today's Patients",
      value: todaysPatients,
      icon: Users,
      color: "sky",
    },
    {
      label: "Completed Today",
      value: completedToday,
      icon: CheckCircle2,
      color: "emerald",
    },
    {
      label: "Remaining Today",
      value: upcomingToday,
      icon: Clock,
      color: "amber",
    },
    {
      label: "Total Consultations",
      value: totalCompleted,
      icon: Activity,
      color: "violet",
    },
  ];

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Page heading */}
      <div>
        <h1 className="text-2xl font-bold text-white">Doctor Profile</h1>
        <p className="text-slate-400 text-sm mt-1">
          Your professional details and consultation summary
        </p>
      </div>

      {/* Avatar + identity card */}
      <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-6 backdrop-blur">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5">
          {/* Avatar */}
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shrink-0 shadow-lg shadow-emerald-500/20">
            <span className="text-white font-bold text-2xl tracking-tight">
              {getInitials(user.name)}
            </span>
          </div>

          {/* Identity */}
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <h2 className="text-xl font-bold text-white truncate">
                Dr. {user.name}
              </h2>
              <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5 rounded-full border bg-emerald-500/20 text-emerald-300 border-emerald-500/30">
                <ShieldCheck className="w-3 h-3" />
                Doctor
              </span>
            </div>
            <p className="text-emerald-400 text-sm font-medium">
              {doctor.specialization}
            </p>
            <p className="text-slate-400 text-sm mt-0.5">
              {department.name} Department
            </p>
          </div>

          {/* Interactive controls */}
          <div className="flex items-center gap-2">
            <AvailabilityToggle initialAvailable={doctor.isAvailable} />
            <Link
              href="/doctor/profile/edit"
              className="flex items-center gap-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 hover:text-white px-3.5 py-2 rounded-xl text-sm font-medium transition-all border border-slate-600"
            >
              <Pencil className="w-3.5 h-3.5" />
              Edit Profile
            </Link>
          </div>
        </div>
      </div>

      {/* Professional details */}
      <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-6 backdrop-blur">
        <h3 className="text-white font-semibold text-sm uppercase tracking-wider mb-4">
          Professional Details
        </h3>
        <div className="space-y-3">
          {/* Email */}
          <div className="flex items-center gap-3 p-3 bg-slate-700/30 rounded-xl">
            <div className="w-9 h-9 rounded-xl bg-slate-700 flex items-center justify-center shrink-0">
              <Mail className="w-4 h-4 text-slate-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-slate-400 text-xs mb-0.5">Email</p>
              <p className="text-white text-sm font-medium truncate">
                {user.email}
              </p>
            </div>
          </div>

          {/* Phone */}
          <div className="flex items-center gap-3 p-3 bg-slate-700/30 rounded-xl">
            <div className="w-9 h-9 rounded-xl bg-slate-700 flex items-center justify-center shrink-0">
              <Phone className="w-4 h-4 text-slate-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-slate-400 text-xs mb-0.5">Phone</p>
              {user.phone ? (
                <p className="text-white text-sm font-medium">{user.phone}</p>
              ) : (
                <p className="text-slate-500 text-sm italic">Not provided</p>
              )}
            </div>
          </div>

          {/* Specialization */}
          <div className="flex items-center gap-3 p-3 bg-slate-700/30 rounded-xl">
            <div className="w-9 h-9 rounded-xl bg-slate-700 flex items-center justify-center shrink-0">
              <Stethoscope className="w-4 h-4 text-slate-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-slate-400 text-xs mb-0.5">Specialization</p>
              <p className="text-white text-sm font-medium">
                {doctor.specialization}
              </p>
            </div>
          </div>

          {/* Department */}
          <div className="flex items-center gap-3 p-3 bg-slate-700/30 rounded-xl">
            <div className="w-9 h-9 rounded-xl bg-slate-700 flex items-center justify-center shrink-0">
              <Building2 className="w-4 h-4 text-slate-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-slate-400 text-xs mb-0.5">Department</p>
              <p className="text-white text-sm font-medium">
                {department.name}
              </p>
              <p className="text-slate-500 text-xs">Code: {department.code}</p>
            </div>
          </div>

          {/* Consultation fee */}
          <div className="flex items-center gap-3 p-3 bg-slate-700/30 rounded-xl">
            <div className="w-9 h-9 rounded-xl bg-slate-700 flex items-center justify-center shrink-0">
              <BadgeDollarSign className="w-4 h-4 text-slate-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-slate-400 text-xs mb-0.5">
                Avg Consultation Duration
              </p>
              <p className="text-white text-sm font-medium">
                {doctor.avgConsultMins} minutes
              </p>
            </div>
          </div>

          {/* License */}
          <div className="flex items-center gap-3 p-3 bg-slate-700/30 rounded-xl">
            <div className="w-9 h-9 rounded-xl bg-slate-700 flex items-center justify-center shrink-0">
              <User className="w-4 h-4 text-slate-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-slate-400 text-xs mb-0.5">License Number</p>
              <p className="text-white text-sm font-mono">
                {doctor.licenseNumber}
              </p>
            </div>
          </div>

          {/* Joined */}
          <div className="flex items-center gap-3 p-3 bg-slate-700/30 rounded-xl">
            <div className="w-9 h-9 rounded-xl bg-slate-700 flex items-center justify-center shrink-0">
              <Activity className="w-4 h-4 text-slate-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-slate-400 text-xs mb-0.5">Joined Platform</p>
              <p className="text-white text-sm font-medium">
                {format(new Date(user.createdAt), "MMMM d, yyyy")}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Today's stats */}
      <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-6 backdrop-blur">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-white font-semibold text-sm uppercase tracking-wider">
            Activity Summary
          </h3>
          <span className="text-xs text-slate-400 bg-slate-700/50 px-2.5 py-1 rounded-full">
            {format(new Date(), "EEEE, MMM d")}
          </span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {stats.map((stat) => (
            <div
              key={stat.label}
              className="bg-slate-900/50 border border-slate-700/40 rounded-xl p-4 text-center"
            >
              <div
                className={`w-9 h-9 rounded-xl bg-${stat.color}-500/20 flex items-center justify-center mx-auto mb-3`}
              >
                <stat.icon className={`w-4 h-4 text-${stat.color}-400`} />
              </div>
              <div className="text-2xl font-bold text-white mb-0.5">
                {stat.value}
              </div>
              <div className="text-slate-400 text-xs leading-tight">
                {stat.label}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
