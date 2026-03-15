// src/lib/ai/models/gpt-client.ts
export const GPTClient = {
  async generate(prompt: string) {
    return {
      text: `Generated code for: ${prompt}`,
      model: "gpt-5",
    };
  },

  async edit(instructions: string) {
    return {
      text: `Patched with instructions: ${instructions}`,
      model: "gpt-5",
    };
  },
};