import { AppointmentType } from "@prisma/client";

export interface TriageResult {
  department: string;
  urgency: "routine" | "urgent" | "emergency";
  reasoning: string;
  disclaimer: string;
}

export interface WaitTimePredictionInput {
  doctorId: string;
  queueSize: number;
  avgConsultMins: number;
  appointmentType: AppointmentType;
  timeOfDay: string;
  emergencyCount: number;
  historicalAccuracy?: number;
}

export interface WaitTimePrediction {
  estimatedWaitMins: number;
  confidence: number;
  breakdown: {
    baseWait: number;
    typeAdjustment: number;
    emergencyPremium: number;
  };
}

export interface NoShowInput {
  patientId: string;
  appointmentType: AppointmentType;
  scheduledAt: Date;
  historicalNoShows: number;
  totalAppointments: number;
  distanceKm?: number;
}

export interface NoShowRisk {
  riskScore: number;
  riskLevel: "low" | "medium" | "high";
  factors: string[];
}

export interface AIService {
  triageSymptoms(symptoms: string): Promise<TriageResult>;
  predictWaitTime(
    input: WaitTimePredictionInput
  ): Promise<WaitTimePrediction>;
  detectNoShowRisk(input: NoShowInput): Promise<NoShowRisk>;
}
