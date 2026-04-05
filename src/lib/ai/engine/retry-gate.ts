//==================== FILE: src/lib/ai/engine/retry-gate.ts ====================

// src/lib/ai/engine/retry-gate.ts
// Stage 6 — Retry gate using Devstral (best open code model, 256k context)
// Only patches the BROKEN files, not the whole project.
// Max 2 passes to prevent infinite loops.

import OpenAI from "openai";
import type { CriticError } from "./ai-critic";

const client = new OpenAI({
  apiKey: process.env.NVIDIA_API_KEY!,
  baseURL: "https://integrate.api.nvidia.com/v1",
});

// devstral-2 is purpose-built for code repair with long context
const PATCH_MODEL = "mistralai/devstral-2-123b-instruct-2512";

export type AIFile = { path: string; content: string };

// ── Helpers ──────────────────────────────────────────────────────────────────

function extractExports(content: string): string[] {
  const names: string[] = [];
  const re = /export\s+(?:default\s+)?(?:function|const|class)\s+(\w+)/g;
  let m;
  while ((m = re.exec(content)) !== null) names.push(m[1]);
  return names;
}

function parseFilesFromResponse(text: string): AIFile[] {
  const cleaned = text.replace(/```json?|```/g, "").trim();

  // Try direct JSON parse
  try {
    const parsed = JSON.parse(cleaned);
    if (Array.isArray(parsed)) {
      return parsed.filter(
        (f): f is AIFile => typeof f?.path === "string" && typeof f?.content === "string"
      );
    }
  } catch {}

  // Fallback: regex salvage for individual file objects
  const files: AIFile[] = [];
  const re = /\{\s*"path"\s*:\s*"([^"]+)"\s*,\s*"content"\s*:\s*"([\s\S]*?)"\s*\}/g;
  let m;
  while ((m = re.exec(cleaned)) !== null) {
    files.push({
      path: m[1],
      content: m[2]
        .replace(/\\n/g, "\n")
        .replace(/\\t/g, "\t")
        .replace(/\\"/g, '"')
        .replace(/\\\\/g, "\\"),
    });
  }
  return files;
}

// ── Main export ───────────────────────────────────────────────────────────────

export async function retryGate(
  files: AIFile[],
  errors: CriticError[],
  attempt: number = 0
): Promise<AIFile[]> {
  if (errors.length === 0 || attempt >= 2) return files;

  const brokenPaths = new Set(errors.map((e) => e.file));
  const brokenFiles = files.filter((f) => brokenPaths.has(f.path));
  const contextFiles = files
    .filter((f) => !brokenPaths.has(f.path))
    .map((f) => ({
      path: f.path,
      exports: extractExports(f.content),
    }));

  console.log(
    `🔄 [retry] Pass ${attempt + 1} — patching ${brokenFiles.length} file(s): ${[...brokenPaths].join(", ")}`
  );

  const errorSummary = errors.map((e) => `${e.file} [${e.errorType}]: ${e.description} → ${e.suggestedFix}`).join("\n");

  try {
    const response = await client.chat.completions.create({
      model: PATCH_MODEL,
      temperature: 0.1,
      max_tokens: 12000,
      messages: [
        {
          role: "system",
          content: `You are a React code repair specialist. Fix ONLY the specific errors listed.
Do NOT change anything else — preserve all styling, animations, logic, and component names.
Return ONLY a valid JSON array: [{"path":"...","content":"..."}]
Escape all content strings properly. No markdown. No explanation.`,
        },
        {
          role: "user",
          content: `Errors to fix:
${errorSummary}

Other project files (reference only — their exports):
${JSON.stringify(contextFiles, null, 2)}

Files that need repair:
${JSON.stringify(brokenFiles.map((f) => ({ path: f.path, content: f.content })), null, 2)}`,
        },
      ],
    });

    const raw = response.choices[0]?.message?.content ?? "[]";
    const fixed = parseFilesFromResponse(raw);

    if (fixed.length === 0) {
      console.warn("⚠️ [retry] No files returned from patcher — keeping originals");
      return files;
    }

    const fixedMap = new Map(fixed.map((f) => [f.path, f]));
    const result = files.map((f) => fixedMap.get(f.path) ?? f);

    console.log(`✅ [retry] Patched ${fixed.length} file(s) on pass ${attempt + 1}`);
    return result;

  } catch (err) {
    console.error("❌ [retry] Patcher failed:", err instanceof Error ? err.message : err);
    return files; // non-fatal, return originals
  }
}

