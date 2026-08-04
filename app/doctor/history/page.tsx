import { getSessionUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { format } from "date-fns";
import { FileText, Clock, Users, CheckCircle2, Timer } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Consultation History | MediFlow AI" };

export default async function DoctorHistoryPage() {
  const session = await getSessionUser();
  const doctor = await prisma.doctor.findUnique({
    where: { userId: session!.id },
    include: {
      appointments: {
        where: {
          deletedAt: null,
          status: { in: ["COMPLETED", "NO_SHOW"] },
        },
        orderBy: { scheduledAt: "desc" },
        take: 100,
        include: {
          patient: {},
          department: { select: { name: true } },
          consultLog: { select: { durationMins: true } },
        },
      },
    },
  });

  const appointments = doctor?.appointments ?? [];
  const completed = appointments.filter((a) => a.status === "COMPLETED");
  const avgDuration =
    completed.length > 0
      ? Math.round(
          completed.reduce((sum, a) => sum + (a.consultLog?.durationMins ?? 0), 0) /
            completed.length
        )
      : 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Consultation History</h1>
        <p className="text-slate-400 text-sm mt-1">
          Your completed and missed consultations
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { icon: Users, label: "Total Seen", value: completed.length, color: "sky" },
          { icon: CheckCircle2, label: "Completed", value: completed.length, color: "emerald" },
          { icon: Clock, label: "No-shows", value: appointments.filter((a) => a.status === "NO_SHOW").length, color: "red" },
          { icon: Timer, label: "Avg Duration", value: avgDuration > 0 ? `${avgDuration}m` : "—", color: "amber" },
        ].map((stat) => (
          <div key={stat.label} className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-4 backdrop-blur">
            <div className={`w-9 h-9 rounded-xl bg-${stat.color}-500/20 flex items-center justify-center mb-3`}>
              <stat.icon className={`w-4 h-4 text-${stat.color}-400`} />
            </div>
            <div className="text-2xl font-bold text-white">{stat.value}</div>
            <div className="text-slate-400 text-xs mt-0.5">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* History */}
      {appointments.length === 0 ? (
        <div className="bg-slate-800/30 border border-slate-700/30 rounded-2xl p-12 text-center">
          <FileText className="w-16 h-16 text-slate-600 mx-auto mb-4" />
          <p className="text-slate-300 font-semibold text-lg">No consultations yet</p>
          <p className="text-slate-500 text-sm mt-1">Completed consultations will appear here</p>
        </div>
      ) : (
        <div className="space-y-3">
          {appointments.map((appt) => (
            <div
              key={appt.id}
              className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-4 hover:border-slate-600 transition-all backdrop-blur"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center shrink-0">
                    <span className="text-emerald-400 font-bold text-sm">#{appt.tokenNumber}</span>
                  </div>
                  <div>
                    <p className="text-white font-semibold text-sm">{appt.patient.name}</p>
                    <p className="text-slate-400 text-xs">{appt.appointmentType.replace(/_/g, " ")} · {appt.department.name}</p>
                    <p className="text-slate-500 text-xs mt-0.5">
                      {format(new Date(appt.scheduledAt), "MMM d, yyyy 'at' h:mm a")}
                      {appt.consultLog?.durationMins
                        ? ` · ${Math.round(appt.consultLog.durationMins)} min session`
                        : ""}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {appt.isEmergency && (
                    <span className="text-xs bg-red-500/20 text-red-300 border border-red-500/30 px-2 py-0.5 rounded-full">Emergency</span>
                  )}
                  <span className={`text-xs px-2.5 py-1 rounded-full border font-medium ${appt.status === "COMPLETED" ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30" : "bg-red-500/20 text-red-300 border-red-500/30"}`}>
                    {appt.status.replace(/_/g, " ")}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
