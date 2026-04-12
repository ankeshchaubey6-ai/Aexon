// src/lib/ai/llm/editor.ts
// v18.0 — Clean editor: modify only necessary files, preserve existing libraries and styling.

import OpenAI from "openai";
import type { StreamFile } from "@/lib/ai/stream/stream-pipeline";

const client = new OpenAI({
  apiKey: process.env.NVIDIA_API_KEY!,
  baseURL: "https://integrate.api.nvidia.com/v1",
});

const MODEL = "meta/llama-3.1-70b-instruct";
const PING_INTERVAL_MS = 8_000;

function stripMarkdown(text: string): string {
  return text
    .replace(/^```(?:json)?\s*/m, "")
    .replace(/\s*```\s*$/m, "")
    .trim();
}

export async function generateEdit(
  prompt: string,
  files: StreamFile[],
  onPing?: () => void
): Promise<StreamFile[]> {
  const pingTimer = onPing ? setInterval(onPing, PING_INTERVAL_MS) : null;

  try {
    const fileBundle = files
      .map((f) => `// ═══ ${f.path} ═══\n${f.content}`)
      .join("\n\n");

    const systemPrompt = `You are a senior React engineer editing an existing project.

Return ONLY a valid JSON array of modified files. No markdown, no explanation.

Format: [{"path": "src/...", "content": "..."}]

RULES:
- Modify ONLY the files that need changes.
- Keep the existing project structure and styling.
- Tailwind CSS is allowed (className with Tailwind utilities).
- framer-motion is allowed (import { motion, AnimatePresence } from "framer-motion").
- lucide-react is allowed (import icons from "lucide-react").
- Preserve all existing functionality and imports.
- DO NOT remove working code unless requested.
- DO NOT introduce new libraries unless necessary.
- Every .jsx file must have import React from 'react' and export default.`;

    const userPrompt = `User request: ${prompt}

Current project files:
${fileBundle}

Return the updated versions of ONLY the files that changed.`;

    const completion = await client.chat.completions.create({
      model: MODEL,
      temperature: 0.2,
      max_tokens: 2000, // NVIDIA-safe limit
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    });

    if (pingTimer) clearInterval(pingTimer);

    const raw = completion.choices[0]?.message?.content ?? "";
    const cleaned = stripMarkdown(raw);

    const start = cleaned.indexOf("[");
    const end = cleaned.lastIndexOf("]");

    if (start === -1 || end === -1) {
      console.warn("[editor] No JSON array found in response");
      return files;
    }

    const parsed = JSON.parse(cleaned.slice(start, end + 1));

    if (!Array.isArray(parsed)) {
      console.warn("[editor] Parsed response is not an array");
      return files;
    }

    const updatedMap = new Map<string, string>();

    for (const item of parsed) {
      if (
        typeof item === "object" &&
        item !== null &&
        typeof item.path === "string" &&
        typeof item.content === "string" &&
        item.content.trim().length > 20
      ) {
        updatedMap.set(item.path, item.content);
      }
    }

    if (updatedMap.size === 0) {
      console.warn("[editor] No valid file updates in response");
      return files;
    }

    const result = files.map((f) => {
      const newContent = updatedMap.get(f.path);
      return newContent ? { ...f, content: newContent } : f;
    });

    return result;
  } catch (error) {
    if (pingTimer) clearInterval(pingTimer);
    console.error("❌ [editor] LLM call failed:", error);
    return files;
  }
}