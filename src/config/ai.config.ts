// src/config/ai.config.ts
export type AIModelId = "gpt-5" | "gemini" | "deepseek";

export const AI_CONFIG = {
  defaultModel: "gpt-5" as AIModelId,
  maxFiles: 500,
  maxFileSize: 200_000,
  sandboxBasePath: "/sandbox",
};