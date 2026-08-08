import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { format } from "date-fns";
import { FileText, Activity, Clock, TrendingUp, Calendar, CheckCircle2 } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "My Medical History | MediFlow" };

const statusColors: Record<string, string> = {
  BOOKED: "bg-blue-500/20 text-blue-300 border-blue-500/30",
  CHECKED_IN: "bg-amber-500/20 text-amber-300 border-amber-500/30",
  IN_CONSULTATION: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
  COMPLETED: "bg-slate-700 text-slate-400 border-slate-600",
  NO_SHOW: "bg-red-500/20 text-red-300 border-red-500/30",
  CANCELLED: "bg-gray-700/50 text-gray-500 border-gray-600/30",
};

export default async function PatientHistoryPage() {
  const session = await auth();
  const patient = await prisma.patient.findUnique({
    where: { userId: session!.user.id },
    include: {
      appointments: {
        where: { deletedAt: null },
        orderBy: { scheduledAt: "desc" },
        include: {
          doctor: {
            include: { user: { select: { name: true } } },
          },
          department: { select: { name: true } },
        },
      },
    },
  });

  const appointments = patient?.appointments ?? [];
  const completed = appointments.filter((a) => a.status === "COMPLETED");
  const upcoming = appointments.filter((a) =>
    ["BOOKED", "CHECKED_IN"].includes(a.status)
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Medical History</h1>
        <p className="text-slate-400 text-sm mt-1">
          Your complete appointment history
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { icon: Calendar, label: "Total Visits", value: appointments.length, color: "sky" },
          { icon: CheckCircle2, label: "Completed", value: completed.length, color: "emerald" },
          { icon: Clock, label: "Upcoming", value: upcoming.length, color: "amber" },
          { icon: TrendingUp, label: "This Year", value: appointments.filter(a => new Date(a.scheduledAt).getFullYear() === new Date().getFullYear()).length, color: "violet" },
        ].map((stat) => (
          <div key={stat.label} className={`bg-slate-800/50 border border-slate-700/50 rounded-2xl p-4 backdrop-blur`}>
            <div className={`w-9 h-9 rounded-xl bg-${stat.color}-500/20 flex items-center justify-center mb-3`}>
              <stat.icon className={`w-4 h-4 text-${stat.color}-400`} />
            </div>
            <div className="text-2xl font-bold text-white">{stat.value}</div>
            <div className="text-slate-400 text-xs mt-0.5">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* History list */}
      {appointments.length === 0 ? (
        <div className="bg-slate-800/30 border border-slate-700/30 rounded-2xl p-12 text-center">
          <FileText className="w-16 h-16 text-slate-600 mx-auto mb-4" />
          <p className="text-slate-300 font-semibold text-lg mb-2">No history yet</p>
          <p className="text-slate-500 text-sm">Your appointments will appear here</p>
        </div>
      ) : (
        <div className="space-y-3">
          {appointments.map((appt) => (
            <div
              key={appt.id}
              className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-4 hover:border-slate-600 transition-all backdrop-blur"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-sky-500/20 flex items-center justify-center shrink-0">
                    <Activity className="w-4 h-4 text-sky-400" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-white font-semibold text-sm truncate">
                      Dr. {appt.doctor.user.name}
                    </p>
                    <p className="text-slate-400 text-xs">
                      {appt.department.name} · {appt.appointmentType.replace(/_/g, " ")}
                    </p>
                    <p className="text-slate-500 text-xs mt-0.5">
                      {format(new Date(appt.scheduledAt), "MMM d, yyyy 'at' h:mm a")}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {appt.isEmergency && (
                    <span className="text-xs bg-red-500/20 text-red-300 border border-red-500/30 px-2 py-0.5 rounded-full">
                      Emergency
                    </span>
                  )}
                  <span className={`text-xs px-2.5 py-1 rounded-full border font-medium ${statusColors[appt.status]}`}>
                    {appt.status.replace(/_/g, " ")}
                  </span>
                </div>
              </div>
              {appt.notes && (
                <div className="mt-3 pt-3 border-t border-slate-700/50">
                  <p className="text-xs text-slate-500 font-medium mb-1">Notes</p>
                  <p className="text-slate-400 text-xs italic">&ldquo;{appt.notes}&rdquo;</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

