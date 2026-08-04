"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Activity, Mail, KeyRound, ArrowRight, Loader2, RefreshCw } from "lucide-react";
import { loginSchema, type LoginInput } from "@/lib/validations";
import { authClient } from "@/lib/auth/client";

export default function LoginPageContent() {
  const router = useRouter();
  const [step, setStep] = useState<"email" | "otp">("email");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [loading, setLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginInput>({ resolver: zodResolver(loginSchema) });

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
    setLoading(true);
    try {
      // Neon Auth generates, stores, and emails the code.
      const { error } = await authClient.emailOtp.sendVerificationOtp({
        email: emailAddr,
        type: "sign-in",
      });

      if (error) {
        toast.error(error.message ?? "Failed to send OTP");
        return false;
      }

      setEmail(emailAddr);
      setStep("otp");
      toast.success("OTP sent to your email");
      startCooldown();
      return true;
    } catch {
      toast.error("Network error. Please try again.");
      return false;
    } finally {
      setLoading(false);
    }
  };

  const onEmailSubmit = async (data: LoginInput) => {
    await sendOtp(data.email);
  };

  const handleOtpInput = (index: number, value: string) => {
    if (value.length > 1) {
      const digits = value.slice(0, 6).split("");
      const newOtp = [...otp];
      digits.forEach((d, i) => {
        if (index + i < 6) newOtp[index + i] = d;
      });
      setOtp(newOtp);
      const nextIndex = Math.min(index + digits.length, 5);
      document.getElementById(`otp-${nextIndex}`)?.focus();
      return;
    }
    if (!/^\d?$/.test(value)) return;
    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);
    if (value && index < 5) {
      document.getElementById(`otp-${index + 1}`)?.focus();
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      document.getElementById(`otp-${index - 1}`)?.focus();
    }
  };

  const handleOtpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const otpString = otp.join("");
    if (otpString.length !== 6) {
      toast.error("Please enter the complete 6-digit OTP");
      return;
    }

    setLoading(true);
    try {
      const { error } = await authClient.signIn.emailOtp({
        email,
        otp: otpString,
      });

      if (error) {
        toast.error(error.message ?? "Invalid or expired OTP. Please try again.");
        setOtp(["", "", "", "", "", ""]);
        document.getElementById("otp-0")?.focus();
        return;
      }

      // Sync the Prisma profile and find out where this role belongs.
      const res = await fetch("/api/user/bootstrap", { method: "POST" });
      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error ?? "Signed in, but your profile failed to load.");
        return;
      }

      toast.success("Welcome back!");
      router.push(data.redirectTo);
      router.refresh();
    } catch {
      toast.error("Authentication failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md">
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-sky-400 to-blue-600 mb-4 shadow-lg shadow-sky-500/30">
          <Activity className="w-7 h-7 text-white" />
        </div>
        <h1 className="text-2xl font-bold text-white">Welcome to MediFlow</h1>
        <p className="text-slate-400 text-sm mt-1">Sign in with your email and OTP</p>
      </div>

      <div className="bg-slate-800/60 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-8 shadow-2xl">
        {step === "email" ? (
          <form onSubmit={handleSubmit(onEmailSubmit)} className="space-y-4">
            <div>
              <label className="text-sm text-slate-300 font-medium mb-1.5 block">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  {...register("email")}
                  type="email"
                  id="email"
                  placeholder="you@example.com"
                  autoComplete="email"
                  className="w-full bg-slate-900/50 border border-slate-600 text-white placeholder:text-slate-500 rounded-xl pl-10 pr-4 py-3 text-sm focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500/50 transition-all"
                />
              </div>
              {errors.email && (
                <p className="text-red-400 text-xs mt-1">{errors.email.message}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={loading}
              id="send-otp-btn"
              className="w-full bg-sky-500 hover:bg-sky-400 disabled:bg-sky-500/50 text-white py-3 rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-2 hover:shadow-lg hover:shadow-sky-500/25"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
              {loading ? "Sending OTP..." : "Continue with Email"}
            </button>

            <p className="text-center text-slate-500 text-xs">
              Don&apos;t have an account?{" "}
              <Link href="/register" className="text-sky-400 hover:text-sky-300">Register here</Link>
            </p>
          </form>
        ) : (
          <form onSubmit={handleOtpSubmit} className="space-y-6">
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-sky-500/20 mb-3">
                <KeyRound className="w-5 h-5 text-sky-400" />
              </div>
              <p className="text-slate-300 text-sm">Enter the 6-digit code sent to</p>
              <p className="text-white font-semibold text-sm">{email}</p>
            </div>

            <div className="flex gap-2 justify-center">
              {otp.map((digit, i) => (
                <input
                  key={i}
                  id={`otp-${i}`}
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={digit}
                  onChange={(e) => handleOtpInput(i, e.target.value)}
                  onKeyDown={(e) => handleOtpKeyDown(i, e)}
                  className="w-11 h-12 text-center bg-slate-900/50 border border-slate-600 text-white text-lg font-bold rounded-xl focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500/50 transition-all"
                />
              ))}
            </div>

            <button
              type="submit"
              disabled={loading || otp.join("").length !== 6}
              id="verify-otp-btn"
              className="w-full bg-sky-500 hover:bg-sky-400 disabled:bg-sky-500/40 disabled:cursor-not-allowed text-white py-3 rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-2"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              {loading ? "Verifying..." : "Verify & Sign In"}
            </button>

            <div className="flex items-center justify-between text-xs">
              <button
                type="button"
                onClick={() => setStep("email")}
                className="text-slate-400 hover:text-white transition-colors"
              >
                ← Change email
              </button>
              <button
                type="button"
                disabled={resendCooldown > 0}
                onClick={() => sendOtp(email)}
                className="text-sky-400 hover:text-sky-300 disabled:text-slate-600 disabled:cursor-not-allowed flex items-center gap-1 transition-colors"
              >
                <RefreshCw className="w-3 h-3" />
                {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : "Resend OTP"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
