import OpenAI from "openai";
import { parseJSON } from "@/lib/ai/utils/parse-json";
const client = new OpenAI({
  apiKey: process.env.NVIDIA_API_KEY!,
  baseURL: "https://integrate.api.nvidia.com/v1",
});

export async function enhanceUI(files: any[]) {
  console.log("🎨 GLM UI ENHANCER");

  try {
    const completion = await client.chat.completions.create({
      model: "z-ai/glm4.7",

      messages: [
        {
          role: "system",
          content: `
Improve UI/UX of given code.

STRICT RULES:
- Return ONLY JSON
- Do NOT remove functionality
- Improve styling, spacing, layout

FORMAT:
[
  { "path": "file_path", "content": "file_content" }
]
`,
        },
        {
          role: "user",
          content: JSON.stringify(files),
        },
      ],

      temperature: 0.5,
      max_tokens: 8192,
      stream: false,
    });

    return parseJSON(completion);

  } catch (err) {
    console.error("❌ GLM Error:", err);
    return files;
  }
}