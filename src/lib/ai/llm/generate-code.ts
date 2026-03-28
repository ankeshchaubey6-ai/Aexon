import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.NVIDIA_API_KEY!,
  baseURL: "https://integrate.api.nvidia.com/v1",
});

export async function generateCodeFromAI(input: string) {
  console.log("🔥 USING KIMI K2");

  try {
    const completion = await client.chat.completions.create({
      model: "moonshotai/kimi-k2-instruct",

      messages: [
        {
          role: "system",
          content: `
You are an expert React developer.

Generate a Vite + React project.

STRICT RULES:
- Return ONLY valid JSON
- No markdown
- No explanation
- No backticks
- Ensure JSON is COMPLETE
- Ensure JSON is NOT truncated

FORMAT:
[
  { "path": "file_path", "content": "file_content" }
]
`,
        },
        {
          role: "user",
          content: `
Project Plan or Prompt:
${input}

Generate full project code.
`,
        },
      ],

      temperature: 0.3,
      top_p: 0.9,
      max_tokens: 8192,
      stream: false,
    });

    let text = completion.choices[0]?.message?.content || "";

    // 🔥 CLEAN RESPONSE
    text = text
      .replace(/```json/g, "")
      .replace(/```/g, "")
      .trim();

    // 🔥 EXTRACT JSON ARRAY SAFELY
    const first = text.indexOf("[");
    const last = text.lastIndexOf("]");

    if (first !== -1 && last !== -1) {
      text = text.slice(first, last + 1);
    }

    try {
      const parsed = JSON.parse(text);

      if (!Array.isArray(parsed)) {
        throw new Error("Invalid JSON format");
      }

      return parsed;
    } catch (err) {
      console.error("❌ JSON parse failed:", text);
      return [];
    }

  } catch (error) {
    console.error("❌ Kimi Error:", error);
    return [];
  }
}