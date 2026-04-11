// src/lib/ai/llm/editor.ts
import OpenAI from "openai";
import { AIFileNode } from "../types/ai-project.types";

const client = new OpenAI({
  apiKey: process.env.NVIDIA_API_KEY!,
  baseURL: "https://integrate.api.nvidia.com/v1",
});

function isUnsafeContent(content: string): boolean {
  return (
    /\.css/.test(content) ||
    /framer-motion/.test(content) ||
    /lucide-react/.test(content) ||
    /react-router/.test(content) ||
    /className=/.test(content)
  );
}

function makeSafeFile(path: string): AIFileNode {
  const name = path.split("/").pop()?.replace(/\.[^.]+$/, "") || "Component";
  return {
    path,
    type: "file",
    content: `import React from 'react';
export default function ${name}() {
  return <div style={{ padding: 10 }}>${name}</div>;
}`
  };
}

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
You are a senior React engineer editing an existing project.

Return ONLY valid JSON array. No markdown. No explanation.

FORMAT:
[
  { "path": "file_path", "content": "updated_code" }
]

---

STRICT RULES (MANDATORY):

* ONLY React (no Next.js)
* ONLY inline styles (style={{}})
* NO CSS files
* NO Tailwind
* NO className styling
* NO external UI libraries
* NO framer-motion
* NO lucide-react
* NO react-router
* DO NOT introduce new dependencies
* DO NOT remove existing files
* Modify ONLY what is required
* Components must:
  * export default
  * return valid JSX
* If unsafe code is required → DO NOT implement it
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
      
      // Validate and sanitize each file
      const validFiles = parsed
        .map((file: any) => {
          if (!file.path || typeof file.content !== "string") return null;
          
          if (isUnsafeContent(file.content)) {
            console.warn(`⚠️ Unsafe content detected in ${file.path}, replacing with safe fallback`);
            return makeSafeFile(file.path);
          }
          
          return file;
        })
        .filter(Boolean);
      
      if (validFiles.length === 0) {
        console.error("❌ No valid files in AI response");
        return files;
      }
      
      // Ensure no files are lost (merge with original)
      const merged = files.map(original => {
        const updated = validFiles.find(f => f.path === original.path);
        return updated || original;
      });
      
      console.log(`✅ Successfully edited ${merged.length} files`);
      return merged;
      
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