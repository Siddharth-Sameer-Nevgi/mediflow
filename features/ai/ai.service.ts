import type { AIService } from "./ai.types";
import { AnthropicProvider } from "./anthropic.provider";
import { mockAIProvider } from "./mock.provider";

function createAIService(): AIService {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (apiKey && apiKey.length > 10) {
    console.log("[AI] Using Anthropic Claude provider");
    return new AnthropicProvider(apiKey);
  }

  console.log("[AI] Using mock provider (set ANTHROPIC_API_KEY to use Claude)");
  return mockAIProvider;
}

export const aiService: AIService = createAIService();

export * from "./ai.types";
