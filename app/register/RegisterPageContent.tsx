"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import {
  Activity, User, Mail, Phone,
  ArrowRight, Loader2, KeyRound, RefreshCw,
} from "lucide-react";
import { registerSchema, type RegisterInput } from "@/lib/validations";
import { authClient } from "@/lib/auth/client";

export default function RegisterPageContent() {
  const router = useRouter();

  const [step, setStep] = useState<"form" | "otp">("form");
  const [registeredEmail, setRegisteredEmail] = useState("");
  const [profile, setProfile] = useState<{ name: string; phone?: string }>({ name: "" });
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [loading, setLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  const { register, handleSubmit, formState: { errors } } = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
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

  const sendOtp = async (emailAddr: string) => {
    const { error } = await authClient.emailOtp.sendVerificationOtp({
      email: emailAddr,
      type: "sign-in",
    });
    if (error) {
      toast.error(error.message ?? "Failed to send OTP");
      return false;
    }
    startCooldown();
    return true;
  };

  const onSubmit = async (data: RegisterInput) => {
    setLoading(true);
    try {
      // Neon Auth creates the account on first successful OTP sign-in.
      if (!(await sendOtp(data.email))) return;

      setProfile({ name: data.name, phone: data.phone });
      setRegisteredEmail(data.email);
      setStep("otp");
      toast.success("Check your email for the verification code.");
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
      const { error } = await authClient.signIn.emailOtp({
        email: registeredEmail,
        otp: otpString,
      });

      if (error) {
        toast.error(error.message ?? "Invalid or expired OTP.");
        setOtp(["", "", "", "", "", ""]);
        return;
      }

      // The OTP flow has nowhere to carry a display name, so set it now.
      await authClient.updateUser({ name: profile.name });

      const res = await fetch("/api/user/bootstrap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: profile.phone }),
      });
      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error ?? "Signed in, but your profile failed to load.");
        return;
      }

      toast.success("Welcome to MediFlow AI! 🎉");
      router.push(data.redirectTo);
      router.refresh();
    } catch {
      toast.error("Registration failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const resendOtp = async () => {
    setLoading(true);
    try {
      if (await sendOtp(registeredEmail)) toast.success("OTP resent!");
    } catch {
      toast.error("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
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
        <p className="text-slate-400 text-xs mb-6 p-3 bg-slate-900/40 border border-slate-700/50 rounded-xl">
          Registration creates a <strong className="text-slate-200">patient</strong> account.
          Doctor and admin access is granted by a hospital administrator.
        </p>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="text-sm text-slate-300 font-medium mb-1.5 block">Full Name</label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input {...register("name")} id="name" type="text" placeholder="Priya Sharma"
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
            {loading ? "Sending code..." : "Create Account"}
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
