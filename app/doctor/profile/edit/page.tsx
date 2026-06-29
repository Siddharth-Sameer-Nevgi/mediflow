"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { User, Phone, Loader2, ArrowLeft, Save } from "lucide-react";
import Link from "next/link";

interface ProfileData {
  name: string;
  email: string;
  phone: string | null;
}

export default function DoctorProfileEditPage() {
  const router = useRouter();
  const [form, setForm] = useState({ name: "", phone: "" });
  const [initialized, setInitialized] = useState(false);

  const { isLoading } = useQuery<ProfileData>({
    queryKey: ["doctor-profile-edit"],
    queryFn: () => fetch("/api/user/profile").then((r) => r.json()),
    select: (data) => data,
    // Initialize form once loaded
  });

  // Use a separate query to initialize form values
  useQuery<{ name: string; phone: string | null }>({
    queryKey: ["doctor-profile-init"],
    queryFn: async () => {
      const res = await fetch("/api/user/profile");
      const data = await res.json();
      if (!initialized) {
        setForm({ name: data.name ?? "", phone: data.phone ?? "" });
        setInitialized(true);
      }
      return data;
    },
    staleTime: Infinity,
  });

  const mutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/user/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: form.name, phone: form.phone || null }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Update failed");
      return data;
    },
    onSuccess: () => {
      toast.success("Profile updated successfully!");
      router.push("/doctor/profile");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  if (isLoading && !initialized) {
    return (
      <div className="flex items-center justify-center h-48">
        <Loader2 className="w-6 h-6 text-sky-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-lg space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href="/doctor/profile"
          className="w-9 h-9 rounded-xl bg-slate-800 hover:bg-slate-700 flex items-center justify-center transition-all border border-slate-700"
        >
          <ArrowLeft className="w-4 h-4 text-slate-300" />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-white">Edit Profile</h1>
          <p className="text-slate-400 text-xs mt-0.5">Update your personal details</p>
        </div>
      </div>

      <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-6 backdrop-blur space-y-4">
        {/* Name */}
        <div>
          <label className="flex items-center gap-1.5 text-sm text-slate-300 font-medium mb-2">
            <User className="w-3.5 h-3.5" /> Full Name
          </label>
          <input
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            placeholder="Dr. Jane Smith"
            className="w-full bg-slate-700/50 border border-slate-600 text-white placeholder:text-slate-500 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500/50 transition-all"
          />
        </div>

        {/* Phone */}
        <div>
          <label className="flex items-center gap-1.5 text-sm text-slate-300 font-medium mb-2">
            <Phone className="w-3.5 h-3.5" /> Phone <span className="text-slate-500 text-xs">(optional)</span>
          </label>
          <input
            type="tel"
            value={form.phone}
            onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
            placeholder="+91 98765 43210"
            className="w-full bg-slate-700/50 border border-slate-600 text-white placeholder:text-slate-500 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500/50 transition-all"
          />
        </div>

        <p className="text-slate-500 text-xs">
          Note: Email, specialization, and license number can only be changed by an admin.
        </p>
      </div>

      <div className="flex gap-3">
        <Link
          href="/doctor/profile"
          className="flex-1 flex items-center justify-center bg-slate-800 hover:bg-slate-700 text-slate-300 py-3 rounded-xl text-sm font-medium transition-all border border-slate-700"
        >
          Cancel
        </Link>
        <button
          onClick={() => mutation.mutate()}
          disabled={mutation.isPending || !form.name.trim()}
          className="flex-1 flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-400 disabled:bg-emerald-500/40 text-white py-3 rounded-xl text-sm font-semibold transition-all"
        >
          {mutation.isPending ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          {mutation.isPending ? "Saving..." : "Save Changes"}
        </button>
      </div>
    </div>
  );
}
