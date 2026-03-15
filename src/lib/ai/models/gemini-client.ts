// src/lib/ai/models/gemini-client.ts
export const GeminiClient = {
  async generate(prompt: string) {
    return {
      text: `Gemini generated output for: ${prompt}`,
      model: "gemini",
    };
  },

  async edit(instructions: string) {
    return {
      text: `Gemini edit: ${instructions}`,
      model: "gemini",
    };
  },
};