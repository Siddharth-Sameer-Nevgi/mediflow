import { getSessionUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import {
  Calendar,
  Clock,
  Activity,
  Plus,
  ChevronRight,
  AlertCircle,
} from "lucide-react";
import { format, isToday, isTomorrow } from "date-fns";

function formatDate(date: Date): string {
  if (isToday(date)) return "Today";
  if (isTomorrow(date)) return "Tomorrow";
  return format(date, "MMM d, yyyy");
}

const statusColors: Record<string, string> = {
  BOOKED: "bg-blue-500/20 text-blue-300 border-blue-500/30",
  CHECKED_IN: "bg-amber-500/20 text-amber-300 border-amber-500/30",
  IN_CONSULTATION: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
  COMPLETED: "bg-slate-500/20 text-slate-400 border-slate-500/30",
  NO_SHOW: "bg-red-500/20 text-red-300 border-red-500/30",
  CANCELLED: "bg-gray-500/20 text-gray-400 border-gray-500/30",
};

export default async function PatientDashboard() {
  const session = await getSessionUser();
  const patient = await prisma.patient.findUnique({
    where: { userId: session!.id },
    include: {
      appointments: {
        where: {
          deletedAt: null,
          status: { not: "CANCELLED" },
        },
        orderBy: { scheduledAt: "asc" },
        take: 5,
        include: {
          doctor: {
            include: { department: true },
          },
          department: true,
          queueEntry: true,
        },
      },
    },
  });

  const upcoming = patient?.appointments.filter(
    (a) =>
      ["BOOKED", "CHECKED_IN", "IN_CONSULTATION"].includes(a.status) &&
      new Date(a.scheduledAt) >= new Date()
  ) ?? [];

  const recent = patient?.appointments.filter(
    (a) => a.status === "COMPLETED"
  ).slice(0, 3) ?? [];

  const activeAppointment = patient?.appointments.find(
    (a) => a.status === "IN_CONSULTATION"
  );

  const nextInQueue = patient?.appointments.find(
    (a) => a.status === "CHECKED_IN" && a.queueEntry
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">
            Good {new Date().getHours() < 12 ? "Morning" : new Date().getHours() < 18 ? "Afternoon" : "Evening"},{" "}
            <span className="text-sky-400">
              {session?.name?.split(" ")[0]}
            </span>{" "}
            👋
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            {format(new Date(), "EEEE, MMMM d, yyyy")}
          </p>
        </div>
        <Link
          href="/patient/book"
          className="inline-flex items-center gap-2 bg-sky-500 hover:bg-sky-400 text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-all hover:shadow-lg hover:shadow-sky-500/25"
        >
          <Plus className="w-4 h-4" />
          Book Appointment
        </Link>
      </div>

      {/* Active Consultation Alert */}
      {activeAppointment && (
        <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center shrink-0">
            <Activity className="w-5 h-5 text-emerald-400 animate-pulse" />
          </div>
          <div className="flex-1">
            <p className="text-emerald-300 font-semibold text-sm">
              You&apos;re in consultation now!
            </p>
            <p className="text-emerald-400/70 text-xs">
              With {activeAppointment.doctor.name} ·{" "}
              {activeAppointment.department.name}
            </p>
          </div>
          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
        </div>
      )}

      {/* Queue Status */}
      {nextInQueue && nextInQueue.queueEntry && (
        <Link
          href={`/patient/queue/${nextInQueue.id}`}
          className="block bg-sky-500/10 border border-sky-500/30 rounded-2xl p-5 hover:border-sky-500/60 transition-all group"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sky-400 text-xs font-semibold uppercase tracking-wider mb-1">
                You&apos;re in Queue
              </p>
              <p className="text-white font-bold text-lg">
                Token #{nextInQueue.tokenNumber}
              </p>
              <p className="text-slate-400 text-sm">
                Position {nextInQueue.queueEntry.position} ·{" "}
                <span className="text-sky-300">
                  ~{Math.round(nextInQueue.queueEntry.estimatedWaitMins)} min wait
                </span>
              </p>
            </div>
            <div className="flex items-center gap-2">
              <div className="text-right">
                <div className="text-2xl font-bold text-sky-400">
                  #{nextInQueue.queueEntry.position}
                </div>
                <div className="text-slate-500 text-xs">in queue</div>
              </div>
              <ChevronRight className="w-5 h-5 text-slate-500 group-hover:text-sky-400 transition-colors" />
            </div>
          </div>
        </Link>
      )}

      {/* Stats Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            label: "Upcoming",
            value: upcoming.length,
            icon: Calendar,
            color: "sky",
          },
          {
            label: "Completed",
            value: recent.length,
            icon: Activity,
            color: "emerald",
          },
          {
            label: "In Queue",
            value: patient?.appointments.filter((a) =>
              ["BOOKED", "CHECKED_IN"].includes(a.status)
            ).length ?? 0,
            icon: Clock,
            color: "amber",
          },
          {
            label: "This Month",
            value: patient?.appointments.filter((a) => {
              const d = new Date(a.scheduledAt);
              const now = new Date();
              return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
            }).length ?? 0,
            icon: Activity,
            color: "violet",
          },
        ].map((stat) => (
          <div
            key={stat.label}
            className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-4 backdrop-blur"
          >
            <div
              className={`w-10 h-10 rounded-xl bg-${stat.color}-500/20 flex items-center justify-center mb-3`}
            >
              <stat.icon className={`w-5 h-5 text-${stat.color}-400`} />
            </div>
            <div className="text-2xl font-bold text-white">{stat.value}</div>
            <div className="text-slate-400 text-xs mt-0.5">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Upcoming Appointments */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white">
            Upcoming Appointments
          </h2>
          <Link
            href="/patient/appointments"
            className="text-sky-400 hover:text-sky-300 text-sm transition-colors flex items-center gap-1"
          >
            View all <ChevronRight className="w-4 h-4" />
          </Link>
        </div>

        {upcoming.length === 0 ? (
          <div className="bg-slate-800/30 border border-slate-700/30 rounded-2xl p-8 text-center">
            <div className="w-14 h-14 rounded-2xl bg-slate-700/50 flex items-center justify-center mx-auto mb-3">
              <Calendar className="w-7 h-7 text-slate-500" />
            </div>
            <p className="text-slate-300 font-medium mb-1">
              No upcoming appointments
            </p>
            <p className="text-slate-500 text-sm mb-4">
              Book your first appointment to get started
            </p>
            <Link
              href="/patient/book"
              className="inline-flex items-center gap-2 bg-sky-500 hover:bg-sky-400 text-white px-4 py-2 rounded-xl text-sm font-medium transition-all"
            >
              <Plus className="w-4 h-4" />
              Book Now
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {upcoming.map((appt) => (
              <Link
                key={appt.id}
                href={`/patient/queue/${appt.id}`}
                className="block bg-slate-800/50 border border-slate-700/50 rounded-2xl p-4 hover:border-slate-600 transition-all group backdrop-blur"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-sky-500/20 flex items-center justify-center shrink-0">
                      <span className="text-sky-400 font-bold text-sm">
                        #{appt.tokenNumber}
                      </span>
                    </div>
                    <div>
                      <p className="text-white font-semibold text-sm">
                        {appt.doctor.name}
                      </p>
                      <p className="text-slate-400 text-xs">
                        {appt.department.name} ·{" "}
                        {formatDate(new Date(appt.scheduledAt))} at{" "}
                        {format(new Date(appt.scheduledAt), "h:mm a")}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-xs px-2.5 py-1 rounded-full border font-medium ${
                        statusColors[appt.status]
                      }`}
                    >
                      {appt.status.replace("_", " ")}
                    </span>
                    {appt.queueEntry && (
                      <span className="text-slate-500 text-xs">
                        Pos. {appt.queueEntry.position}
                      </span>
                    )}
                    <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-slate-300 transition-colors" />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
