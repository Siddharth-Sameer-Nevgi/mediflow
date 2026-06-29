"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

interface Props {
  initialAvailable: boolean;
}

export function AvailabilityToggle({ initialAvailable }: Props) {
  const [available, setAvailable] = useState(initialAvailable);
  const [loading, setLoading] = useState(false);

  const toggle = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/doctors/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isAvailable: !available }),
      });
      if (!res.ok) throw new Error();
      setAvailable((prev) => !prev);
      toast.success(available ? "You are now unavailable" : "You are now available for consultations");
    } catch {
      toast.error("Failed to update availability");
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      id="availability-toggle-btn"
      onClick={toggle}
      disabled={loading}
      className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all border ${
        available
          ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/30"
          : "bg-slate-700/50 text-slate-400 border-slate-600 hover:bg-slate-700"
      }`}
    >
      {loading ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : (
        <span className={`w-2 h-2 rounded-full ${available ? "bg-emerald-400 animate-pulse" : "bg-slate-500"}`} />
      )}
      {available ? "Available" : "Unavailable"}
    </button>
  );
}
