import { createGoogle } from "@ai-sdk/google";
import type { LanguageModel } from "ai";

/**
 * The language models a reply uses. Tests pass their own source, with the
 * AI SDK mock model, instead of calling Gemini.
 */
export type ModelSource = {
  main(): LanguageModel;
  maxOutputTokens: number;
};

export function runtimeModelSource(): ModelSource {
  const { geminiApiKey, models } = useRuntimeConfig();
  const google = createGoogle({ apiKey: geminiApiKey });

  return {
    main: () => google(models.main),
    maxOutputTokens: Number(models.maxOutputTokens),
  };
}
