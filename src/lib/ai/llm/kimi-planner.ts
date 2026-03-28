// src/lib/ai/llm/kimi-planner.ts
import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.NVIDIA_API_KEY!,
  baseURL: "https://integrate.api.nvidia.com/v1",
});

export async function planWithKimi(prompt: string) {
  console.log("🧠 KIMI PLANNER");

  try {
    const completion = await client.chat.completions.create({
      model: "moonshotai/kimi-k2-instruct",

      messages: [
        {
          role: "system",
          content: `You are a senior software architect. Return ONLY a single raw JSON object. No markdown. No backticks. No explanation. No text before or after the JSON. Start your response with { and end with }.

JSON format:
{
  "projectName": "string (PascalCase, no spaces)",
  "description": "string",
  "type": "dashboard|ecommerce|portfolio|todo|game|utility",
  "pages": ["home"],
  "components": ["Header", "Footer"],
  "features": ["responsive design"],
  "uiRequirements": ["modern design"],
  "styling": "CSS with modern features",
  "functionality": ["user interaction"],
  "interactivity": ["buttons"],
  "complexity": "simple|medium|complex"
}`,
        },
        {
          role: "user",
          content: `Create a project plan for: ${prompt}`,
        },
      ],

      temperature: 0.3,
      max_tokens: 800,
      stream: false,
    });

    let text = completion.choices[0]?.message?.content || "";

    console.log(`📝 Planner raw response: ${text.substring(0, 200)}`);

    // Strip any markdown that leaked through
    text = text
      .replace(/```json/gi, "")
      .replace(/```/g, "")
      .trim();

    // Extract the JSON object
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");

    if (start === -1 || end === -1) {
      console.error("❌ Planner: no JSON object found in response");
      return null;
    }

    text = text.slice(start, end + 1);

    try {
      const parsed = JSON.parse(text);
      console.log(`✅ Planner produced plan for: ${parsed.projectName}`);
      return parsed;
    } catch {
      // Try removing trailing commas
      try {
        const fixed = text.replace(/,(\s*[}\]])/g, "$1");
        const parsed = JSON.parse(fixed);
        console.log(`✅ Planner recovered plan for: ${parsed.projectName}`);
        return parsed;
      } catch {
        console.error("❌ Planner JSON parse failed:", text.slice(0, 300));
        return null;
      }
    }
  } catch (error) {
    console.error("❌ Kimi Planner Error:", error);
    return null;
  }
}