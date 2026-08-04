import type { AIService } from "./ai.types";
import { GeminiProvider } from "./gemini.provider";
import { mockAIProvider } from "./mock.provider";

function createAIService(): AIService {
  const apiKey = process.env.GEMINI_API_KEY;

  if (apiKey && apiKey.length > 10) {
    const model = process.env.GEMINI_MODEL ?? "gemini-2.5-flash";
    console.log(`[AI] Using Google Gemini provider (${model})`);
    return new GeminiProvider(apiKey, model);
  }

  console.log("[AI] Using mock provider (set GEMINI_API_KEY to use Gemini)");
  return mockAIProvider;
}

export const aiService: AIService = createAIService();

export * from "./ai.types";
