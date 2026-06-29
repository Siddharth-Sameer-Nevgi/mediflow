import type {
  AIService,
  TriageResult,
  WaitTimePredictionInput,
  WaitTimePrediction,
  NoShowInput,
  NoShowRisk,
} from "./ai.types";
import { sanitizeForAI } from "@/lib/utils";

export class AnthropicProvider implements AIService {
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async triageSymptoms(symptoms: string): Promise<TriageResult> {
    const sanitized = sanitizeForAI(symptoms);

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": this.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-5",
        max_tokens: 512,
        messages: [
          {
            role: "user",
            content: sanitized,
          },
        ],
        system: `You are a medical triage assistant helping patients select the correct hospital department.
Based on the patient's symptoms, return JSON only (no markdown, no extra text):
{
  "department": string (one of: "General Medicine", "Cardiology", "Neurology", "Dermatology", "Orthopedics", "Pediatrics", "ENT"),
  "urgency": "routine" | "urgent" | "emergency",
  "reasoning": string (patient-friendly, 1-2 sentences),
  "disclaimer": "This is not a diagnosis. Please consult a qualified doctor."
}
Do not diagnose conditions. Do not suggest medications. Return valid JSON only.`,
      }),
    });

    if (!response.ok) {
      throw new Error(`Anthropic API error: ${response.statusText}`);
    }

    const data = await response.json();
    const content = data.content[0]?.text ?? "{}";
    return JSON.parse(content) as TriageResult;
  }

  async predictWaitTime(
    input: WaitTimePredictionInput
  ): Promise<WaitTimePrediction> {
    // Use heuristic base calculation
    const { AppointmentType } = await import("@prisma/client");
    const typeMultipliers: Record<string, number> = {
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

    // Ask Claude for confidence scoring with context
    const prompt = `Queue analysis for confidence scoring:
- Queue size: ${input.queueSize} patients
- Average consultation: ${input.avgConsultMins} mins
- Appointment type: ${input.appointmentType}
- Time of day: ${input.timeOfDay}
- Emergency patients ahead: ${input.emergencyCount}
- Historical accuracy: ${input.historicalAccuracy ?? "N/A"}
- Our estimate: ${Math.round(estimatedWaitMins)} mins

Return JSON only: {"confidence": number between 0.5 and 0.95, "adjustment_mins": number between -10 and 10}`;

    try {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": this.apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-5",
          max_tokens: 128,
          messages: [{ role: "user", content: prompt }],
          system:
            "You are a queue management AI. Return JSON only with confidence score and adjustment.",
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const parsed = JSON.parse(data.content[0]?.text ?? "{}");
        const confidence = parsed.confidence ?? 0.75;
        const adjustment = parsed.adjustment_mins ?? 0;

        return {
          estimatedWaitMins: Math.max(
            0,
            Math.round(estimatedWaitMins + adjustment)
          ),
          confidence,
          breakdown: {
            baseWait: Math.round(baseWait),
            typeAdjustment: Math.round(typeAdjustment),
            emergencyPremium: Math.round(emergencyPremium),
          },
        };
      }
    } catch {
      // Fall through to heuristic result
    }

    return {
      estimatedWaitMins: Math.round(estimatedWaitMins),
      confidence: 0.75,
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

    const riskScore = Math.min(1, Math.max(0, noShowRate * 1.2));
    const factors: string[] = [];
    if (noShowRate > 0.3) factors.push("High historical no-show rate");

    return {
      riskScore: Math.round(riskScore * 100) / 100,
      riskLevel: riskScore > 0.6 ? "high" : riskScore > 0.3 ? "medium" : "low",
      factors: factors.length > 0 ? factors : ["No significant risk factors"],
    };
  }
}
