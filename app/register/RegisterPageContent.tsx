"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { signIn } from "next-auth/react";
import { toast } from "sonner";
import {
  Activity, User, Mail, Phone, Stethoscope, Users, BarChart3,
  ArrowRight, Loader2, KeyRound, RefreshCw,
} from "lucide-react";
import { registerSchema, type RegisterInput } from "@/lib/validations";

const roles = [
  { value: "PATIENT" as const, label: "Patient", icon: Users, description: "Book appointments and track your queue" },
  { value: "DOCTOR" as const, label: "Doctor", icon: Stethoscope, description: "Manage your patients and consultations" },
  { value: "ADMIN" as const, label: "Admin", icon: BarChart3, description: "Oversee hospital operations" },
];

export default function RegisterPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const defaultRole = (searchParams.get("role") as "PATIENT" | "DOCTOR" | "ADMIN") ?? "PATIENT";

  const [step, setStep] = useState<"form" | "otp">("form");
  const [selectedRole, setSelectedRole] = useState<"PATIENT" | "DOCTOR" | "ADMIN">(defaultRole);
  const [registeredEmail, setRegisteredEmail] = useState("");
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [loading, setLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [devOtp, setDevOtp] = useState<string | null>(null);

  const { register, handleSubmit, formState: { errors } } = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
    defaultValues: { role: defaultRole ?? "PATIENT" },
  });

  const startCooldown = () => {
    let countdown = 60;
    setResendCooldown(countdown);
    const interval = setInterval(() => {
      countdown--;
      setResendCooldown(countdown);
      if (countdown <= 0) clearInterval(interval);
    }, 1000);
  };

  const onSubmit = async (data: RegisterInput) => {
    setLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, role: selectedRole }),
      });
      const result = await res.json();

      if (!res.ok) {
        const errorMsg = typeof result.error === "string"
          ? result.error
          : Object.values(result.error ?? {}).flat().join(", ");
        toast.error(errorMsg);
        return;
      }

      if (result.devOtp) setDevOtp(result.devOtp);
      setRegisteredEmail(data.email);
      setStep("otp");
      toast.success("Account created! Check your email for the OTP.");
      startCooldown();
    } catch {
      toast.error("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleOtpInput = (index: number, value: string) => {
    if (value.length > 1) {
      const digits = value.slice(0, 6).split("");
      const newOtp = [...otp];
      digits.forEach((d, i) => { if (index + i < 6) newOtp[index + i] = d; });
      setOtp(newOtp);
      document.getElementById(`reg-otp-${Math.min(index + digits.length, 5)}`)?.focus();
      return;
    }
    if (!/^\d?$/.test(value)) return;
    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);
    if (value && index < 5) document.getElementById(`reg-otp-${index + 1}`)?.focus();
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      document.getElementById(`reg-otp-${index - 1}`)?.focus();
    }
  };

  const handleOtpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const otpString = otp.join("");
    if (otpString.length !== 6) { toast.error("Please enter the complete 6-digit OTP"); return; }

    setLoading(true);
    try {
      const result = await signIn("credentials", {
        email: registeredEmail, otp: otpString, redirect: false,
      });

      if (result?.error) {
        toast.error("Invalid or expired OTP.");
        setOtp(["", "", "", "", "", ""]);
      } else {
        toast.success("Welcome to MediFlow AI! 🎉");
        const roleRedirects: Record<string, string> = {
          PATIENT: "/patient/dashboard", DOCTOR: "/doctor/dashboard", ADMIN: "/admin/dashboard",
        };
        router.push(roleRedirects[selectedRole] ?? "/patient/dashboard");
        router.refresh();
      }
    } finally {
      setLoading(false);
    }
  };

  const resendOtp = async () => {
    setLoading(true);
    const res = await fetch("/api/auth/resend-otp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: registeredEmail }),
    });
    const data = await res.json();
    if (data.devOtp) setDevOtp(data.devOtp);
    toast.success("OTP resent!");
    startCooldown();
    setLoading(false);
  };

  if (step === "otp") {
    return (
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-sky-400 to-blue-600 mb-4 shadow-lg shadow-sky-500/30">
            <KeyRound className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">Verify Your Email</h1>
          <p className="text-slate-400 text-sm mt-1">We sent a 6-digit code to <strong className="text-white">{registeredEmail}</strong></p>
        </div>

        <div className="bg-slate-800/60 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-8 shadow-2xl">
          {devOtp && (
            <div className="mb-4 p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl">
              <p className="text-amber-400 text-xs font-mono text-center">
                [DEV MODE] Your OTP: <strong className="text-lg">{devOtp}</strong>
              </p>
            </div>
          )}
          <form onSubmit={handleOtpSubmit} className="space-y-6">
            <div className="flex gap-2 justify-center">
              {otp.map((digit, i) => (
                <input key={i} id={`reg-otp-${i}`} type="text" inputMode="numeric" maxLength={6}
                  value={digit}
                  onChange={(e) => handleOtpInput(i, e.target.value)}
                  onKeyDown={(e) => handleOtpKeyDown(i, e)}
                  className="w-11 h-12 text-center bg-slate-900/50 border border-slate-600 text-white text-lg font-bold rounded-xl focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500/50 transition-all"
                />
              ))}
            </div>
            <button type="submit" disabled={loading || otp.join("").length !== 6} id="complete-registration-btn"
              className="w-full bg-sky-500 hover:bg-sky-400 disabled:bg-sky-500/40 disabled:cursor-not-allowed text-white py-3 rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-2">
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              Complete Registration
            </button>
            <div className="flex items-center justify-between text-xs">
              <button type="button" onClick={() => setStep("form")} className="text-slate-400 hover:text-white transition-colors">← Go back</button>
              <button type="button" disabled={resendCooldown > 0 || loading} onClick={resendOtp}
                className="text-sky-400 hover:text-sky-300 disabled:text-slate-600 disabled:cursor-not-allowed flex items-center gap-1 transition-colors">
                <RefreshCw className="w-3 h-3" />
                {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : "Resend OTP"}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md">
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-sky-400 to-blue-600 mb-4 shadow-lg shadow-sky-500/30">
          <Activity className="w-7 h-7 text-white" />
        </div>
        <h1 className="text-2xl font-bold text-white">Create Your Account</h1>
        <p className="text-slate-400 text-sm mt-1">Join MediFlow AI today</p>
      </div>

      <div className="bg-slate-800/60 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-8 shadow-2xl">
        <div className="mb-6">
          <label className="text-sm text-slate-300 font-medium mb-2 block">I am a...</label>
          <div className="grid grid-cols-3 gap-2">
            {roles.map((role) => (
              <button key={role.value} type="button" id={`role-${role.value.toLowerCase()}`}
                onClick={() => setSelectedRole(role.value)}
                className={`relative p-3 rounded-xl border text-center transition-all ${selectedRole === role.value ? "border-sky-500 bg-sky-500/15" : "border-slate-600 bg-slate-900/30 hover:border-slate-500"}`}>
                <role.icon className={`w-5 h-5 mx-auto mb-1 ${selectedRole === role.value ? "text-sky-400" : "text-slate-400"}`} />
                <span className={`text-xs font-medium ${selectedRole === role.value ? "text-white" : "text-slate-400"}`}>{role.label}</span>
              </button>
            ))}
          </div>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="text-sm text-slate-300 font-medium mb-1.5 block">Full Name</label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input {...register("name")} id="name" type="text" placeholder="Dr. Priya Sharma"
                className="w-full bg-slate-900/50 border border-slate-600 text-white placeholder:text-slate-500 rounded-xl pl-10 pr-4 py-3 text-sm focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500/50 transition-all" />
            </div>
            {errors.name && <p className="text-red-400 text-xs mt-1">{errors.name.message}</p>}
          </div>

          <div>
            <label className="text-sm text-slate-300 font-medium mb-1.5 block">Email Address</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input {...register("email")} id="register-email" type="email" placeholder="you@example.com"
                className="w-full bg-slate-900/50 border border-slate-600 text-white placeholder:text-slate-500 rounded-xl pl-10 pr-4 py-3 text-sm focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500/50 transition-all" />
            </div>
            {errors.email && <p className="text-red-400 text-xs mt-1">{errors.email.message}</p>}
          </div>

          <div>
            <label className="text-sm text-slate-300 font-medium mb-1.5 block">Phone Number <span className="text-slate-500 font-normal">(optional)</span></label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input {...register("phone")} id="phone" type="tel" placeholder="+91 98765 43210"
                className="w-full bg-slate-900/50 border border-slate-600 text-white placeholder:text-slate-500 rounded-xl pl-10 pr-4 py-3 text-sm focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500/50 transition-all" />
            </div>
          </div>

          <button type="submit" disabled={loading} id="register-submit-btn"
            className="w-full bg-sky-500 hover:bg-sky-400 disabled:bg-sky-500/50 text-white py-3 rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-2 hover:shadow-lg hover:shadow-sky-500/25 mt-2">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
            {loading ? "Creating account..." : "Create Account"}
          </button>

          <p className="text-center text-slate-500 text-xs pt-2">
            Already have an account?{" "}
            <Link href="/login" className="text-sky-400 hover:text-sky-300">Sign in</Link>
          </p>
        </form>
      </div>
    </div>
  );
}
