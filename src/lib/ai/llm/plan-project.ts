//==================== FILE: src/lib/ai/llm/plan-project.ts ====================

import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.NVIDIA_API_KEY!,
  baseURL: "https://integrate.api.nvidia.com/v1",
});

export async function planProject(prompt: string) {
  console.log("🧠 PLANNER RUNNING");

  try {
    const completion = await client.chat.completions.create({
      model: "moonshotai/kimi-k2-instruct",

      messages: [
        {
          role: "system",
          content: `
You are a senior software architect.

Analyze the user request and return a structured plan.

STRICT RULES:
- Return ONLY JSON
- No explanation
- No markdown

FORMAT:
{
  "projectName": "string",
  "stack": ["vite", "react", "tailwind"],
  "pages": ["home", "pricing"],
  "components": ["Navbar", "Hero", "Footer"],
  "features": ["auth", "responsive"]
}
`,
        },
        {
          role: "user",
          content: prompt,
        },
      ],

      temperature: 0.2,
      max_tokens: 2000,
    });

    let text = completion.choices[0]?.message?.content || "";

    text = text.replace(/```json/g, "").replace(/```/g, "").trim();

    const first = text.indexOf("{");
    const last = text.lastIndexOf("}");

    if (first !== -1 && last !== -1) {
      text = text.slice(first, last + 1);
    }

    return JSON.parse(text);

  } catch (err) {
    console.error("❌ Planner failed:", err);
    return null;
  }
}