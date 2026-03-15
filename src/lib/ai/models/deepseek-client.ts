// src/lib/ai/models/deepseek-client.ts
export const DeepSeekClient = {
  async generate(prompt: string) {
    return {
      text: `DeepSeek generated code for: ${prompt}`,
      model: "deepseek",
    };
  },

  async edit(instructions: string) {
    return {
      text: `DeepSeek patch applied: ${instructions}`,
      model: "deepseek",
    };
  },
};