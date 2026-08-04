import type {
  AIService,
  TriageResult,
  WaitTimePredictionInput,
  WaitTimePrediction,
  NoShowInput,
  NoShowRisk,
} from "./ai.types";
import { mockAIProvider } from "./mock.provider";
import { sanitizeForAI } from "@/lib/utils";

const GEMINI_BASE_URL =
  "https://generativelanguage.googleapis.com/v1beta/models";

/** Requests block appointment booking, so never let one hang indefinitely. */
const REQUEST_TIMEOUT_MS = 8_000;

const DISCLAIMER = "This is not a diagnosis. Please consult a qualified doctor.";

const VALID_DEPARTMENTS = [
  "General Medicine",
  "Cardiology",
  "Neurology",
  "Dermatology",
  "Orthopedics",
  "Pediatrics",
  "ENT",
] as const;

const VALID_URGENCIES = ["routine", "urgent", "emergency"] as const;

export class GeminiProvider implements AIService {
  private apiKey: string;
  private model: string;

  constructor(apiKey: string, model?: string) {
    this.apiKey = apiKey;
    this.model = model ?? process.env.GEMINI_MODEL ?? "gemini-2.5-flash";
  }

  /**
   * Single request helper. Gemini's `responseMimeType: "application/json"`
   * makes the model emit bare JSON, so there are no markdown fences to strip.
   * Returns null on any failure so callers can fall back to heuristics.
   */
  private async generateJson<T>(
    systemInstruction: string,
    prompt: string,
    maxOutputTokens: number
  ): Promise<T | null> {
    try {
      const response = await fetch(
        `${GEMINI_BASE_URL}/${this.model}:generateContent`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": this.apiKey,
          },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: systemInstruction }] },
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            generationConfig: {
              temperature: 0.2,
              maxOutputTokens,
              responseMimeType: "application/json",
            },
          }),
          signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        }
      );

      if (!response.ok) {
        const detail = await response.text().catch(() => "");
        console.error(
          `[AI] Gemini API error ${response.status}: ${detail.slice(0, 300)}`
        );
        return null;
      }

      const data = await response.json();
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (typeof text !== "string") {
        console.error("[AI] Gemini returned no text content.");
        return null;
      }

      return JSON.parse(text) as T;
    } catch (error) {
      console.error("[AI] Gemini request failed.", error);
      return null;
    }
  }

  async triageSymptoms(symptoms: string): Promise<TriageResult> {
    const sanitized = sanitizeForAI(symptoms);

    const result = await this.generateJson<Partial<TriageResult>>(
      `You are a medical triage assistant helping patients select the correct hospital department.
Return JSON matching this shape:
{
  "department": one of ${JSON.stringify(VALID_DEPARTMENTS)},
  "urgency": one of ${JSON.stringify(VALID_URGENCIES)},
  "reasoning": string (patient-friendly, 1-2 sentences)
}
Do not diagnose conditions. Do not suggest medications. Do not name specific illnesses.`,
      sanitized,
      512
    );

    // Reject anything outside the known enums rather than trusting the model
    // to route a patient to a department that does not exist.
    const department = VALID_DEPARTMENTS.find(
      (d) => d === result?.department
    );
    const urgency = VALID_URGENCIES.find((u) => u === result?.urgency);

    if (!department || !urgency) {
      if (result) {
        console.warn(
          "[AI] Gemini triage returned an unrecognised department/urgency; using heuristics."
        );
      }
      return mockAIProvider.triageSymptoms(symptoms);
    }

    return {
      department,
      urgency,
      reasoning:
        typeof result?.reasoning === "string" && result.reasoning.trim()
          ? result.reasoning
          : `A ${department} specialist would be best suited to evaluate your symptoms.`,
      // Always ours — never let the model omit or reword the disclaimer.
      disclaimer: DISCLAIMER,
    };
  }

  async predictWaitTime(
    input: WaitTimePredictionInput
  ): Promise<WaitTimePrediction> {
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

    const breakdown = {
      baseWait: Math.round(baseWait),
      typeAdjustment: Math.round(typeAdjustment),
      emergencyPremium: Math.round(emergencyPremium),
    };

    // The arithmetic above is the estimate; Gemini only refines confidence
    // and applies a small correction.
    const result = await this.generateJson<{
      confidence?: number;
      adjustment_mins?: number;
    }>(
      "You are a queue management assistant. Return JSON only: " +
        '{"confidence": number between 0.5 and 0.95, "adjustment_mins": number between -10 and 10}',
      `Queue analysis:
- Queue size: ${input.queueSize} patients
- Average consultation: ${input.avgConsultMins} mins
- Appointment type: ${input.appointmentType}
- Time of day: ${input.timeOfDay}
- Emergency patients ahead: ${input.emergencyCount}
- Historical accuracy: ${input.historicalAccuracy ?? "N/A"}
- Our estimate: ${Math.round(estimatedWaitMins)} mins`,
      128
    );

    if (!result) {
      return {
        estimatedWaitMins: Math.round(estimatedWaitMins),
        confidence: 0.75,
        breakdown,
      };
    }

    const confidence =
      typeof result.confidence === "number"
        ? Math.min(0.95, Math.max(0.5, result.confidence))
        : 0.75;
    const adjustment =
      typeof result.adjustment_mins === "number"
        ? Math.min(10, Math.max(-10, result.adjustment_mins))
        : 0;

    return {
      estimatedWaitMins: Math.max(
        0,
        Math.round(estimatedWaitMins + adjustment)
      ),
      confidence,
      breakdown,
    };
  }

  async detectNoShowRisk(input: NoShowInput): Promise<NoShowRisk> {
    // Purely statistical — an LLM adds nothing here, and this keeps booking
    // free of an extra network round-trip.
    return mockAIProvider.detectNoShowRisk(input);
  }
}
