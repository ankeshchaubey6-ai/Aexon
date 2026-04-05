//=================== FILE: src/lib/ai/llm/editor.ts ====================

// src/lib/ai/llm/kimi-editor.ts
import OpenAI from "openai";
import { AIFileNode } from "../types/ai-project.types";

const client = new OpenAI({
  apiKey: process.env.NVIDIA_API_KEY!,
  baseURL: "https://integrate.api.nvidia.com/v1",
});

export async function generateEditWithKimi(
  prompt: string,
  files: AIFileNode[]
): Promise<AIFileNode[]> {
  console.log("✏️ KIMI EDIT MODE");

  try {
    const completion = await client.chat.completions.create({
      model: "moonshotai/kimi-k2-instruct",

      messages: [
        {
          role: "system",
          content: `
You are an expert React developer specializing in code editing and refactoring.

You are given an existing React project. Your task is to modify ONLY what is needed based on the user's request.

STRICT RULES:
- Return the FULL updated files array with ALL files
- Do NOT remove unrelated files
- Keep the existing project structure intact
- Only modify files that need changes
- Return ONLY valid JSON array
- No markdown, no backticks, no explanations

FORMAT:
[
  { "path": "file_path", "content": "updated_file_content" },
  { "path": "another_file.jsx", "content": "updated_content" }
]

IMPORTANT:
- Include ALL files, even unchanged ones
- Preserve all existing functionality
- Make minimal changes to achieve the goal
- Ensure the code remains valid and working
`,
        },
        {
          role: "user",
          content: `
User Request:
${prompt}

Current Project Files:
${JSON.stringify(files, null, 2)}

Please update the project according to the user's request.
Return the COMPLETE updated files array.
`,
        },
      ],

      temperature: 0.2,
      max_tokens: 8000,
    });

    let text = completion.choices[0]?.message?.content || "";

    // Clean response
    text = text.replace(/```json/g, "").replace(/```/g, "").trim();

    // Extract array
    const start = text.indexOf("[");
    const end = text.lastIndexOf("]");

    if (start !== -1 && end !== -1) {
      text = text.slice(start, end + 1);
    }

    try {
      const parsed = JSON.parse(text);
      
      if (!Array.isArray(parsed)) {
        console.error("❌ Edit parse failed: not an array");
        return files;
      }
      
      // Validate each file has required fields
      const validFiles = parsed.filter((file: any) => 
        file.path && typeof file.content === 'string'
      );
      
      if (validFiles.length === 0) {
        console.error("❌ No valid files in AI response");
        return files;
      }
      
      console.log(`✅ Successfully edited ${validFiles.length} files`);
      return validFiles;
      
    } catch (parseError) {
      console.error("❌ Edit parse failed:", parseError);
      console.error("Raw text:", text);
      return files;
    }

  } catch (err) {
    console.error("❌ Kimi edit error:", err);
    return files;
  }
}


