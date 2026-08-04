"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { format, addDays, startOfDay } from "date-fns";
import { toast } from "sonner";
import {
  Building2,
  Stethoscope,
  Calendar,
  CheckCircle2,
  ChevronRight,
  ChevronLeft,
  Loader2,
  Brain,
  Clock,
  AlertCircle,
  Star,
  Send,
  X,
} from "lucide-react";

type Step = "hospital" | "department" | "doctor" | "slot" | "confirm";
type AppointmentType =
  | "FIRST_CONSULTATION"
  | "FOLLOW_UP"
  | "PRESCRIPTION_REFILL"
  | "DIAGNOSTIC_REVIEW";

interface Hospital {
  id: string;
  name: string;
  city: string;
  address: string;
}

interface Department {
  id: string;
  name: string;
  code: string;
  avgConsultDurationMins: number;
}

interface Doctor {
  id: string;
  name: string;
  specialization: string;
  avgConsultMins: number;
  isAvailable: boolean;
  _count: { appointments: number };
}

interface WaitPrediction {
  estimatedWaitMins: number;
  confidence: number;
}

interface TriageResult {
  department: string;
  urgency: "routine" | "urgent" | "emergency";
  reasoning: string;
  disclaimer: string;
}

const appointmentTypes: {
  value: AppointmentType;
  label: string;
  desc: string;
}[] = [
  {
    value: "FIRST_CONSULTATION",
    label: "First Visit",
    desc: "New patient consultation",
  },
  {
    value: "FOLLOW_UP",
    label: "Follow-up",
    desc: "Return visit for existing condition",
  },
  {
    value: "PRESCRIPTION_REFILL",
    label: "Prescription",
    desc: "Medication refill",
  },
  {
    value: "DIAGNOSTIC_REVIEW",
    label: "Test Review",
    desc: "Review lab or imaging results",
  },
];

const steps: { key: Step; label: string }[] = [
  { key: "hospital", label: "Hospital" },
  { key: "department", label: "Department" },
  { key: "doctor", label: "Doctor" },
  { key: "slot", label: "Slot" },
  { key: "confirm", label: "Confirm" },
];

export default function BookAppointmentPage() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const [step, setStep] = useState<Step>("hospital");
  const [selectedHospital, setSelectedHospital] = useState<Hospital | null>(null);
  const [selectedDept, setSelectedDept] = useState<Department | null>(null);
  const [selectedDoctor, setSelectedDoctor] = useState<Doctor | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [appointmentType, setAppointmentType] =
    useState<AppointmentType>("FIRST_CONSULTATION");
  const [notes, setNotes] = useState("");
  const [waitPrediction, setWaitPrediction] = useState<WaitPrediction | null>(null);

  // Triage
  const [showTriage, setShowTriage] = useState(false);
  const [symptoms, setSymptoms] = useState("");
  const [triageResult, setTriageResult] = useState<TriageResult | null>(null);
  const [triageLoading, setTriageLoading] = useState(false);

  const { data: hospitals, isLoading: loadingHospitals } = useQuery<Hospital[]>({
    queryKey: ["hospitals"],
    queryFn: async () => {
      const res = await fetch("/api/hospitals");
      if (!res.ok) return [];
      const data = await res.json();
      return data.hospitals ?? [];
    },
  });

  const { data: departments, isLoading: loadingDepts } = useQuery<Department[]>({
    queryKey: ["departments", selectedHospital?.id],
    queryFn: async () => {
      const res = await fetch(
        `/api/departments?hospitalId=${selectedHospital?.id}`
      );
      if (!res.ok) return [];
      const data = await res.json();
      return data.departments ?? [];
    },
    enabled: !!selectedHospital,
  });

  const { data: doctors, isLoading: loadingDoctors } = useQuery<Doctor[]>({
    queryKey: ["doctors", selectedDept?.id],
    queryFn: async () => {
      const res = await fetch(
        `/api/doctors?departmentId=${selectedDept?.id}`
      );
      if (!res.ok) return [];
      const data = await res.json();
      return data.doctors ?? [];
    },
    enabled: !!selectedDept,
  });

  const bookMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/appointments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          doctorId: selectedDoctor!.id,
          departmentId: selectedDept!.id,
          scheduledAt: new Date(
            `${format(selectedDate, "yyyy-MM-dd")}T${selectedSlot}:00`
          ).toISOString(),
          appointmentType,
          notes: notes || undefined,
        }),
      });
      if (!res.ok) throw new Error("Booking failed");
      return res.json();
    },
    onSuccess: (data) => {
      toast.success(
        `Appointment booked! Token #${data.appointment.tokenNumber}`
      );
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
      const params = new URLSearchParams({
        appointmentId: data.appointment.id,
        tokenNumber: String(data.appointment.tokenNumber),
        doctorName: selectedDoctor?.name ?? "",
        departmentName: selectedDept?.name ?? "",
        scheduledAt: data.appointment.scheduledAt,
        estimatedWaitMins: String(
          data.appointment.queueEntry?.estimatedWaitMins ?? ""
        ),
      });
      router.push(`/patient/booking-confirmation?${params.toString()}`);
    },
    onError: () => {
      toast.error("Failed to book appointment. Please try again.");
    },
  });

  const handleTriage = async () => {
    if (!symptoms.trim() || symptoms.length < 10) {
      toast.error("Please describe your symptoms in more detail");
      return;
    }
    setTriageLoading(true);
    try {
      const res = await fetch("/api/ai/triage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ symptoms }),
      });
      const result = await res.json();
      setTriageResult(result);
    } catch {
      toast.error("AI triage unavailable. Please select manually.");
    } finally {
      setTriageLoading(false);
    }
  };

  const fetchWaitPrediction = async (doctorId: string) => {
    const res = await fetch("/api/ai/predict-wait", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ doctorId, appointmentType }),
    });
    if (res.ok) {
      const data = await res.json();
      setWaitPrediction(data);
    }
  };

  const stepIndex = steps.findIndex((s) => s.key === step);

  const generateSlots = () => {
    const slots = [];
    for (let h = 9; h <= 17; h++) {
      for (let m of [0, 30]) {
        if (h === 17 && m === 30) continue;
        slots.push(`${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`);
      }
    }
    return slots;
  };

  const urgencyColors = {
    routine: "text-emerald-400 bg-emerald-500/10 border-emerald-500/30",
    urgent: "text-amber-400 bg-amber-500/10 border-amber-500/30",
    emergency: "text-red-400 bg-red-500/10 border-red-500/30",
  };

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Book an Appointment</h1>
        <p className="text-slate-400 text-sm mt-1">
          Use AI Triage to find the right department, or select manually
        </p>
      </div>

      {/* AI Triage Banner */}
      {!showTriage && !triageResult && (
        <button
          onClick={() => setShowTriage(true)}
          id="open-triage-btn"
          className="w-full flex items-center gap-4 bg-violet-500/10 border border-violet-500/30 hover:border-violet-500/60 rounded-2xl p-4 text-left transition-all group"
        >
          <div className="w-12 h-12 rounded-xl bg-violet-500/20 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
            <Brain className="w-6 h-6 text-violet-400" />
          </div>
          <div>
            <p className="text-white font-semibold text-sm">
              Not sure which department?
            </p>
            <p className="text-slate-400 text-xs">
              Use our AI Triage — describe your symptoms and get an instant recommendation
            </p>
          </div>
          <ChevronRight className="w-5 h-5 text-slate-500 group-hover:text-violet-400 ml-auto transition-colors" />
        </button>
      )}

      {/* Triage Widget */}
      {showTriage && (
        <div className="bg-slate-800/60 border border-violet-500/30 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Brain className="w-5 h-5 text-violet-400" />
              <span className="text-white font-semibold text-sm">
                AI Triage Assistant
              </span>
              <span className="text-xs bg-violet-500/20 text-violet-300 px-2 py-0.5 rounded-full">
                Powered by AI
              </span>
            </div>
            <button
              onClick={() => setShowTriage(false)}
              className="text-slate-500 hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {!triageResult ? (
            <div className="space-y-3">
              <div className="relative">
                <textarea
                  value={symptoms}
                  onChange={(e) => setSymptoms(e.target.value)}
                  placeholder="Describe your symptoms... e.g. 'I have chest pain and shortness of breath for 2 days'"
                  className="w-full bg-slate-900/50 border border-slate-600 text-white placeholder:text-slate-500 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500/50 transition-all resize-none h-24"
                  maxLength={500}
                />
                <span className="absolute bottom-2 right-3 text-slate-600 text-xs">
                  {symptoms.length}/500
                </span>
              </div>
              <button
                onClick={handleTriage}
                disabled={triageLoading || symptoms.length < 10}
                id="run-triage-btn"
                className="flex items-center gap-2 bg-violet-500 hover:bg-violet-400 disabled:bg-violet-500/30 text-white px-4 py-2 rounded-xl text-sm font-medium transition-all"
              >
                {triageLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
                {triageLoading ? "Analyzing..." : "Analyze Symptoms"}
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <div
                className={`border rounded-xl p-4 ${urgencyColors[triageResult.urgency]}`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <span className="font-bold text-lg">{triageResult.department}</span>
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full border font-medium capitalize ${urgencyColors[triageResult.urgency]}`}
                  >
                    {triageResult.urgency}
                  </span>
                </div>
                <p className="text-sm opacity-80">{triageResult.reasoning}</p>
                <p className="text-xs opacity-60 mt-2 italic">
                  {triageResult.disclaimer}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    // Find and auto-select matching department
                    const match = departments?.find((d) =>
                      d.name.toLowerCase().includes(triageResult.department.toLowerCase())
                    );
                    if (match) {
                      setSelectedDept(match);
                      setStep("doctor");
                    }
                    setShowTriage(false);
                  }}
                  className="flex-1 bg-violet-500 hover:bg-violet-400 text-white py-2 rounded-xl text-sm font-medium transition-all"
                >
                  Go to {triageResult.department}
                </button>
                <button
                  onClick={() => {
                    setTriageResult(null);
                    setSymptoms("");
                  }}
                  className="px-4 bg-slate-700 hover:bg-slate-600 text-white py-2 rounded-xl text-sm font-medium transition-all"
                >
                  Try again
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Progress Steps */}
      <div className="flex items-center gap-1">
        {steps.map((s, i) => (
          <div key={s.key} className="flex items-center gap-1 flex-1">
            <div
              className={`flex items-center gap-1.5 text-xs font-medium ${
                i < stepIndex
                  ? "text-sky-400"
                  : i === stepIndex
                  ? "text-white"
                  : "text-slate-600"
              }`}
            >
              <div
                className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                  i < stepIndex
                    ? "bg-sky-500 text-white"
                    : i === stepIndex
                    ? "bg-sky-500/20 border-2 border-sky-500 text-sky-400"
                    : "bg-slate-700 text-slate-500"
                }`}
              >
                {i < stepIndex ? "✓" : i + 1}
              </div>
              <span className="hidden sm:block">{s.label}</span>
            </div>
            {i < steps.length - 1 && (
              <div
                className={`flex-1 h-px mx-1 transition-all ${
                  i < stepIndex ? "bg-sky-500" : "bg-slate-700"
                }`}
              />
            )}
          </div>
        ))}
      </div>

      {/* Step Content */}
      <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-6 backdrop-blur">
        {/* Step 1: Hospital */}
        {step === "hospital" && (
          <div className="space-y-4">
            <h2 className="text-white font-semibold flex items-center gap-2">
              <Building2 className="w-5 h-5 text-sky-400" />
              Select Hospital
            </h2>
            {loadingHospitals ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="h-16 bg-slate-700/30 rounded-xl animate-pulse"
                  />
                ))}
              </div>
            ) : hospitals?.length === 0 ? (
              <div className="text-center py-8">
                <AlertCircle className="w-10 h-10 text-slate-600 mx-auto mb-2" />
                <p className="text-slate-400 text-sm">No hospitals available</p>
                <p className="text-slate-600 text-xs mt-1">
                  Please contact admin to add hospitals
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {hospitals?.map((hospital) => (
                  <button
                    key={hospital.id}
                    id={`hospital-${hospital.id}`}
                    onClick={() => {
                      setSelectedHospital(hospital);
                      setStep("department");
                    }}
                    className="w-full text-left flex items-center gap-3 p-4 bg-slate-900/50 border border-slate-700 hover:border-sky-500/50 rounded-xl transition-all group"
                  >
                    <div className="w-10 h-10 rounded-xl bg-sky-500/20 flex items-center justify-center shrink-0">
                      <Building2 className="w-5 h-5 text-sky-400" />
                    </div>
                    <div className="flex-1">
                      <p className="text-white font-medium text-sm">
                        {hospital.name}
                      </p>
                      <p className="text-slate-400 text-xs">
                        {hospital.city} · {hospital.address}
                      </p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-sky-400 transition-colors" />
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Step 2: Department */}
        {step === "department" && (
          <div className="space-y-4">
            <h2 className="text-white font-semibold flex items-center gap-2">
              <Stethoscope className="w-5 h-5 text-sky-400" />
              Select Department
            </h2>
            {loadingDepts ? (
              <div className="grid grid-cols-2 gap-3">
                {[1, 2, 3, 4].map((i) => (
                  <div
                    key={i}
                    className="h-20 bg-slate-700/30 rounded-xl animate-pulse"
                  />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {departments?.map((dept) => (
                  <button
                    key={dept.id}
                    id={`dept-${dept.id}`}
                    onClick={() => {
                      setSelectedDept(dept);
                      setStep("doctor");
                    }}
                    className={`text-left p-4 rounded-xl border transition-all ${
                      selectedDept?.id === dept.id
                        ? "border-sky-500 bg-sky-500/10"
                        : "border-slate-700 bg-slate-900/50 hover:border-sky-500/50"
                    }`}
                  >
                    <p className="text-white font-semibold text-sm">
                      {dept.name}
                    </p>
                    <p className="text-slate-400 text-xs mt-1">
                      ~{dept.avgConsultDurationMins} min avg
                    </p>
                  </button>
                ))}
              </div>
            )}
            <button
              onClick={() => setStep("hospital")}
              className="flex items-center gap-1 text-slate-400 hover:text-white text-sm transition-colors"
            >
              <ChevronLeft className="w-4 h-4" /> Back
            </button>
          </div>
        )}

        {/* Step 3: Doctor */}
        {step === "doctor" && (
          <div className="space-y-4">
            <h2 className="text-white font-semibold flex items-center gap-2">
              <Stethoscope className="w-5 h-5 text-sky-400" />
              Select Doctor
            </h2>
            {loadingDoctors ? (
              <div className="space-y-3">
                {[1, 2].map((i) => (
                  <div
                    key={i}
                    className="h-20 bg-slate-700/30 rounded-xl animate-pulse"
                  />
                ))}
              </div>
            ) : (
              <div className="space-y-3">
                {doctors?.map((doc) => {
                  const queueSize = doc._count.appointments;
                  const estWait = Math.round(queueSize * doc.avgConsultMins);
                  return (
                    <button
                      key={doc.id}
                      id={`doctor-${doc.id}`}
                      onClick={async () => {
                        setSelectedDoctor(doc);
                        await fetchWaitPrediction(doc.id);
                        setStep("slot");
                      }}
                      disabled={!doc.isAvailable}
                      className={`w-full text-left flex items-center gap-3 p-4 rounded-xl border transition-all group ${
                        !doc.isAvailable
                          ? "border-slate-700 opacity-50 cursor-not-allowed"
                          : "border-slate-700 bg-slate-900/50 hover:border-sky-500/50"
                      }`}
                    >
                      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-sky-500 to-blue-600 flex items-center justify-center shrink-0 text-white font-bold text-sm">
                        {doc.name
                          .split(" ")
                          .map((n) => n[0])
                          .join("")
                          .slice(0, 2)}
                      </div>
                      <div className="flex-1">
                        <p className="text-white font-semibold text-sm">
                          {doc.name}
                        </p>
                        <p className="text-slate-400 text-xs">
                          {doc.specialization}
                        </p>
                        <div className="flex items-center gap-3 mt-1.5">
                          <span className="flex items-center gap-1 text-xs text-slate-500">
                            <Clock className="w-3 h-3" />
                            {doc.isAvailable
                              ? `~${estWait} min wait`
                              : "Unavailable"}
                          </span>
                          <span className="text-xs text-slate-500">
                            {queueSize} in queue
                          </span>
                        </div>
                      </div>
                      {doc.isAvailable && (
                        <div className="flex items-center gap-1">
                          <div
                            className={`w-2 h-2 rounded-full ${
                              estWait < 15
                                ? "bg-emerald-400"
                                : estWait < 30
                                ? "bg-amber-400"
                                : "bg-red-400"
                            }`}
                          />
                          <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-sky-400 transition-colors" />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
            <button
              onClick={() => setStep("department")}
              className="flex items-center gap-1 text-slate-400 hover:text-white text-sm transition-colors"
            >
              <ChevronLeft className="w-4 h-4" /> Back
            </button>
          </div>
        )}

        {/* Step 4: Slot */}
        {step === "slot" && (
          <div className="space-y-4">
            <h2 className="text-white font-semibold flex items-center gap-2">
              <Calendar className="w-5 h-5 text-sky-400" />
              Select Date & Time
            </h2>

            {/* Appointment Type */}
            <div>
              <p className="text-slate-400 text-xs mb-2 uppercase tracking-wider font-medium">
                Appointment Type
              </p>
              <div className="grid grid-cols-2 gap-2">
                {appointmentTypes.map((type) => (
                  <button
                    key={type.value}
                    onClick={() => setAppointmentType(type.value)}
                    className={`text-left p-3 rounded-xl border text-sm transition-all ${
                      appointmentType === type.value
                        ? "border-sky-500 bg-sky-500/10"
                        : "border-slate-700 bg-slate-900/50 hover:border-slate-600"
                    }`}
                  >
                    <p className={`font-medium ${appointmentType === type.value ? "text-sky-300" : "text-white"}`}>
                      {type.label}
                    </p>
                    <p className="text-slate-500 text-xs mt-0.5">{type.desc}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Date */}
            <div>
              <p className="text-slate-400 text-xs mb-2 uppercase tracking-wider font-medium">
                Date
              </p>
              <div className="flex gap-2 overflow-x-auto pb-1">
                {Array.from({ length: 7 }, (_, i) => addDays(new Date(), i)).map(
                  (date) => {
                    const isSelected =
                      format(date, "yyyy-MM-dd") ===
                      format(selectedDate, "yyyy-MM-dd");
                    return (
                      <button
                        key={format(date, "yyyy-MM-dd")}
                        onClick={() => setSelectedDate(date)}
                        className={`flex flex-col items-center gap-0.5 px-4 py-2.5 rounded-xl border shrink-0 transition-all text-sm ${
                          isSelected
                            ? "border-sky-500 bg-sky-500/20 text-sky-300"
                            : "border-slate-700 text-slate-400 hover:border-slate-600"
                        }`}
                      >
                        <span className="text-xs uppercase">
                          {format(date, "EEE")}
                        </span>
                        <span className="font-bold text-base">
                          {format(date, "d")}
                        </span>
                      </button>
                    );
                  }
                )}
              </div>
            </div>

            {/* Time Slots */}
            <div>
              <p className="text-slate-400 text-xs mb-2 uppercase tracking-wider font-medium">
                Available Slots
              </p>
              <div className="grid grid-cols-4 gap-2">
                {generateSlots().map((slot) => (
                  <button
                    key={slot}
                    onClick={() => setSelectedSlot(slot)}
                    className={`py-2 rounded-xl border text-xs font-medium transition-all ${
                      selectedSlot === slot
                        ? "border-sky-500 bg-sky-500/20 text-sky-300"
                        : "border-slate-700 text-slate-400 hover:border-slate-600 hover:text-white"
                    }`}
                  >
                    {slot}
                  </button>
                ))}
              </div>
            </div>

            {/* Notes */}
            <div>
              <p className="text-slate-400 text-xs mb-1 uppercase tracking-wider font-medium">
                Notes (optional)
              </p>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Any specific concerns or medical history to share..."
                className="w-full bg-slate-900/50 border border-slate-600 text-white placeholder:text-slate-500 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-sky-500 transition-all resize-none h-20"
                maxLength={500}
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setStep("doctor")}
                className="flex items-center gap-1 text-slate-400 hover:text-white text-sm transition-colors"
              >
                <ChevronLeft className="w-4 h-4" /> Back
              </button>
              <button
                onClick={() => {
                  if (!selectedSlot) {
                    toast.error("Please select a time slot");
                    return;
                  }
                  setStep("confirm");
                }}
                disabled={!selectedSlot}
                className="flex-1 bg-sky-500 hover:bg-sky-400 disabled:bg-sky-500/30 text-white py-2.5 rounded-xl text-sm font-medium transition-all flex items-center justify-center gap-2"
              >
                Continue <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Step 5: Confirm */}
        {step === "confirm" && (
          <div className="space-y-4">
            <h2 className="text-white font-semibold flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-sky-400" />
              Confirm Appointment
            </h2>

            <div className="bg-slate-900/50 border border-slate-700 rounded-xl p-4 space-y-3">
              {[
                { label: "Hospital", value: selectedHospital?.name },
                { label: "Department", value: selectedDept?.name },
                { label: "Doctor", value: selectedDoctor?.name },
                {
                  label: "Date",
                  value: `${format(selectedDate, "EEEE, MMMM d, yyyy")} at ${selectedSlot}`,
                },
                {
                  label: "Type",
                  value: appointmentTypes.find(
                    (t) => t.value === appointmentType
                  )?.label,
                },
              ].map(({ label, value }) => (
                <div key={label} className="flex justify-between text-sm">
                  <span className="text-slate-400">{label}</span>
                  <span className="text-white font-medium">{value}</span>
                </div>
              ))}
            </div>

            {waitPrediction && (
              <div className="bg-sky-500/10 border border-sky-500/30 rounded-xl p-4">
                <p className="text-sky-400 text-xs font-semibold uppercase tracking-wider mb-1">
                  AI Wait Prediction
                </p>
                <div className="flex items-baseline gap-2">
                  <span className="text-white text-2xl font-bold">
                    ~{waitPrediction.estimatedWaitMins} mins
                  </span>
                  <span className="text-slate-400 text-sm">estimated wait</span>
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <div className="flex-1 bg-slate-700 rounded-full h-1.5">
                    <div
                      className="bg-sky-500 h-1.5 rounded-full"
                      style={{ width: `${waitPrediction.confidence * 100}%` }}
                    />
                  </div>
                  <span className="text-sky-400 text-xs font-medium">
                    {Math.round(waitPrediction.confidence * 100)}% confident
                  </span>
                </div>
                {waitPrediction.estimatedWaitMins > 30 && (
                  <p className="text-amber-400 text-xs mt-2 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    Long wait — virtual waiting room available. You'll be notified when your turn approaches.
                  </p>
                )}
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => setStep("slot")}
                className="flex items-center gap-1 text-slate-400 hover:text-white text-sm transition-colors"
              >
                <ChevronLeft className="w-4 h-4" /> Back
              </button>
              <button
                onClick={() => bookMutation.mutate()}
                disabled={bookMutation.isPending}
                id="confirm-booking-btn"
                className="flex-1 bg-sky-500 hover:bg-sky-400 disabled:bg-sky-500/50 text-white py-3 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2"
              >
                {bookMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="w-4 h-4" />
                )}
                {bookMutation.isPending ? "Booking..." : "Confirm Booking"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
