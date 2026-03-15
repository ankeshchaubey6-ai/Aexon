// src/lib/ai/router/model-router.ts
import { AIModelId } from "@/config/ai.config";

export const resolveModel = (model?: string): AIModelId => {
  if (!model) return "gpt-5";

  const normalized = model.toLowerCase();

  if (normalized.includes("gemini")) return "gemini";
  if (normalized.includes("deepseek")) return "deepseek";

  return "gpt-5";
};