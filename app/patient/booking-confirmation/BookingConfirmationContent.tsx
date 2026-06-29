"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { format } from "date-fns";
import { CheckCircle2, Calendar, Clock, User, Hash, ArrowRight, Stethoscope } from "lucide-react";

export default function BookingConfirmationContent() {
  const params = useSearchParams();
  const router = useRouter();
  const [countdown, setCountdown] = useState(8);

  const appointmentId = params.get("appointmentId") ?? "";
  const tokenNumber   = params.get("tokenNumber") ?? "—";
  const doctorName    = params.get("doctorName") ?? "Your Doctor";
  const departmentName = params.get("departmentName") ?? "Outpatient";
  const scheduledAt   = params.get("scheduledAt");
  const estimatedWaitMins = params.get("estimatedWaitMins") ?? "—";

  const formattedDate = scheduledAt
    ? format(new Date(scheduledAt), "EEEE, MMMM d, yyyy 'at' h:mm a")
    : "—";

  // Auto-redirect countdown
  useEffect(() => {
    if (!appointmentId) return;
    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          router.push(`/patient/queue/${appointmentId}`);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [appointmentId, router]);

  const details = [
    { icon: Hash,         label: "Token Number",  value: `#${tokenNumber}`,   highlight: true },
    { icon: User,         label: "Doctor",         value: `Dr. ${doctorName}`, highlight: false },
    { icon: Stethoscope,  label: "Department",     value: departmentName,      highlight: false },
    { icon: Calendar,     label: "Date & Time",    value: formattedDate,       highlight: false },
    { icon: Clock,        label: "Est. Wait Time", value: estimatedWaitMins !== "—" ? `~${estimatedWaitMins} minutes` : "—", highlight: false },
  ];

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4 py-12">
      {/* Background glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 bg-emerald-600/10 rounded-full blur-3xl pointer-events-none" />

      <div className="relative w-full max-w-md">
        {/* Success icon */}
        <div className="flex justify-center mb-6">
          <div className="w-20 h-20 rounded-full bg-emerald-500/20 border-2 border-emerald-500/30 flex items-center justify-center animate-[scale-in_0.4s_ease-out]">
            <CheckCircle2 className="w-10 h-10 text-emerald-400" />
          </div>
        </div>

        {/* Heading */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-white mb-2">Booking Confirmed!</h1>
          <p className="text-slate-400 text-sm">
            Your appointment has been booked successfully.
          </p>
        </div>

        {/* Details card */}
        <div className="bg-slate-800/60 border border-slate-700/50 rounded-2xl overflow-hidden backdrop-blur mb-6">
          {/* Token highlight */}
          <div className="bg-gradient-to-r from-emerald-500/20 to-teal-500/20 border-b border-slate-700/50 px-5 py-4 text-center">
            <p className="text-slate-400 text-xs font-medium uppercase tracking-wider mb-1">Your Token</p>
            <p className="text-4xl font-black text-emerald-400">#{tokenNumber}</p>
          </div>

          {/* Detail rows */}
          <div className="p-5 space-y-3">
            {details.slice(1).map((d) => (
              <div key={d.label} className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-slate-700/60 flex items-center justify-center shrink-0">
                  <d.icon className="w-4 h-4 text-slate-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-slate-500 text-xs">{d.label}</p>
                  <p className="text-white text-sm font-medium truncate">{d.value}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Countdown banner */}
        {appointmentId && (
          <div className="mb-5 bg-sky-500/10 border border-sky-500/30 rounded-xl px-4 py-3 text-center">
            <p className="text-sky-300 text-sm">
              Redirecting to live queue in <span className="font-bold text-sky-200">{countdown}s</span>…
            </p>
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-col gap-3">
          {appointmentId && (
            <Link
              href={`/patient/queue/${appointmentId}`}
              className="flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-white py-3.5 rounded-xl font-semibold text-sm transition-all hover:shadow-lg hover:shadow-emerald-500/25"
            >
              Track My Queue <ArrowRight className="w-4 h-4" />
            </Link>
          )}
          <Link
            href="/patient/appointments"
            className="flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-300 py-3 rounded-xl font-medium text-sm transition-all border border-slate-700"
          >
            View All Appointments
          </Link>
        </div>

        {/* Tips */}
        <div className="mt-6 bg-slate-800/30 border border-slate-700/30 rounded-xl p-4">
          <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2">Tips for your visit</p>
          <ul className="space-y-1 text-slate-500 text-xs">
            <li>• Arrive 10 minutes before your scheduled time</li>
            <li>• Bring a valid photo ID and insurance card</li>
            <li>• Keep the live queue page open to track your position</li>
            <li>• You&apos;ll get notified when your turn is near</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
