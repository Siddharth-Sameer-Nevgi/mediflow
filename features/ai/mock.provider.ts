import { AppointmentType } from "@prisma/client";
import type {
  AIService,
  TriageResult,
  WaitTimePredictionInput,
  WaitTimePrediction,
  NoShowInput,
  NoShowRisk,
} from "./ai.types";

/**
 * Intelligent mock AI provider.
 * Used when ANTHROPIC_API_KEY is not set.
 * Produces realistic results using heuristics.
 */
export class MockAIProvider implements AIService {
  async triageSymptoms(symptoms: string): Promise<TriageResult> {
    const lower = symptoms.toLowerCase();

    const rules: Array<{
      keywords: string[];
      department: string;
      urgency: "routine" | "urgent" | "emergency";
    }> = [
      {
        keywords: ["chest pain", "heart attack", "palpitation", "cardiac"],
        department: "Cardiology",
        urgency: "emergency",
      },
      {
        keywords: ["headache", "migraine", "seizure", "stroke", "numbness"],
        department: "Neurology",
        urgency: "urgent",
      },
      {
        keywords: ["rash", "skin", "acne", "eczema", "psoriasis", "itching"],
        department: "Dermatology",
        urgency: "routine",
      },
      {
        keywords: ["bone", "joint", "fracture", "back pain", "knee", "hip"],
        department: "Orthopedics",
        urgency: "urgent",
      },
      {
        keywords: ["ear", "throat", "nose", "hearing", "tonsil", "sinus"],
        department: "ENT",
        urgency: "routine",
      },
      {
        keywords: ["child", "infant", "baby", "pediatric", "fever in child"],
        department: "Pediatrics",
        urgency: "urgent",
      },
    ];

    for (const rule of rules) {
      if (rule.keywords.some((kw) => lower.includes(kw))) {
        return {
          department: rule.department,
          urgency: rule.urgency,
          reasoning: `Based on your symptoms, a ${rule.department} specialist would be best suited to evaluate your condition.`,
          disclaimer:
            "This is not a diagnosis. Please consult a qualified doctor.",
        };
      }
    }

    return {
      department: "General Medicine",
      urgency: "routine",
      reasoning:
        "Your symptoms suggest a general check-up with a primary care physician would be appropriate.",
      disclaimer: "This is not a diagnosis. Please consult a qualified doctor.",
    };
  }

  async predictWaitTime(
    input: WaitTimePredictionInput
  ): Promise<WaitTimePrediction> {
    const typeMultipliers: Record<AppointmentType, number> = {
      PRESCRIPTION_REFILL: 0.5,
      FOLLOW_UP: 0.8,
      FIRST_CONSULTATION: 1.0,
      DIAGNOSTIC_REVIEW: 1.3,
      EMERGENCY: 0.3,
    };

    const multiplier = typeMultipliers[input.appointmentType] ?? 1.0;
    const baseWait = input.queueSize * input.avgConsultMins;
    const typeAdjustment = baseWait * multiplier - baseWait;
    const emergencyPremium = input.emergencyCount * input.avgConsultMins * 1.5;

    const estimatedWaitMins = Math.max(
      0,
      baseWait + typeAdjustment + emergencyPremium
    );

    // Confidence decreases with queue size and increases with historical data
    const confidence = Math.min(
      0.95,
      Math.max(0.5, 0.85 - input.queueSize * 0.02 + (input.historicalAccuracy ?? 0) * 0.1)
    );

    return {
      estimatedWaitMins: Math.round(estimatedWaitMins),
      confidence: Math.round(confidence * 100) / 100,
      breakdown: {
        baseWait: Math.round(baseWait),
        typeAdjustment: Math.round(typeAdjustment),
        emergencyPremium: Math.round(emergencyPremium),
      },
    };
  }

  async detectNoShowRisk(input: NoShowInput): Promise<NoShowRisk> {
    const noShowRate =
      input.totalAppointments > 0
        ? input.historicalNoShows / input.totalAppointments
        : 0;

    const scheduledHour = new Date(input.scheduledAt).getHours();
    const isEarlyMorning = scheduledHour < 8;
    const isLateEvening = scheduledHour > 18;

    let riskScore = noShowRate;
    const factors: string[] = [];

    if (noShowRate > 0.3) {
      factors.push("High historical no-show rate");
      riskScore += 0.2;
    }
    if (isEarlyMorning) {
      factors.push("Early morning appointment");
      riskScore += 0.1;
    }
    if (isLateEvening) {
      factors.push("Late evening appointment");
      riskScore += 0.1;
    }
    if (input.appointmentType === "PRESCRIPTION_REFILL") {
      factors.push("Prescription refill appointments have higher no-show rates");
      riskScore += 0.05;
    }

    riskScore = Math.min(1, Math.max(0, riskScore));

    return {
      riskScore: Math.round(riskScore * 100) / 100,
      riskLevel: riskScore > 0.6 ? "high" : riskScore > 0.3 ? "medium" : "low",
      factors: factors.length > 0 ? factors : ["No significant risk factors"],
    };
  }
}

export const mockAIProvider = new MockAIProvider();
