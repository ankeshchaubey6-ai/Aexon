// src/lib/ai/engine/project-fixer.ts
// STAGE 4b: Surgical LLM patch — broken files only.
// v18.0 — Clean reduction: only sanitizeFiles and surgicalPatch remain.

import OpenAI from "openai";

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface StreamFile {
  path: string;
  content: string;
}

export interface ValidationError {
  file: string;
  type: string;
  message: string;
}

export type ErrorClass =
  | "syntax"
  | "missing-import"
  | "jsx-imbalance"
  | "unknown-component";

export interface ClassifiedError extends ValidationError {
  class: ErrorClass;
}

// ─── Constants ─────────────────────────────────────────────────────────────────

const PING_INTERVAL_MS = 8_000;
const FIX_MODEL = "mistralai/devstral-2-123b-instruct-2512";

function makeClient(): OpenAI {
  return new OpenAI({
    apiKey: process.env.NVIDIA_API_KEY!,
    baseURL: "https://integrate.api.nvidia.com/v1",
  });
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function stripMarkdown(text: string): string {
  return text
    .replace(/^```(?:json|jsx?|javascript|typescript|tsx?)?\s*/gim, "")
    .replace(/^```\s*$/gim, "")
    .trim();
}

function resolveRelative(dir: string, rel: string): string {
  const parts = (dir ? `${dir}/${rel}` : rel).split("/");
  const out: string[] = [];
  for (const p of parts) {
    if (p === "..") out.pop();
    else if (p !== ".") out.push(p);
  }
  return out.join("/");
}

// ─── Final Sanitization (kept unchanged) ───────────────────────────────────────

export function sanitizeFiles(files: StreamFile[]): StreamFile[] {
  return files.map((f): StreamFile => {
    if (!/\.(jsx?|tsx?|css)$/.test(f.path)) return f;

    let c = f.content;

    // Remove duplicate import lines (exact duplicates)
    const importsSeen = new Set<string>();
    const lines = c.split("\n");
    const deduped: string[] = [];
    for (const line of lines) {
      if (/^\s*import\s/.test(line)) {
        const trimmed = line.trim();
        if (importsSeen.has(trimmed)) continue;
        importsSeen.add(trimmed);
      }
      deduped.push(line);
    }
    c = deduped.join("\n");

    // Remove console.log/warn/error/info/debug calls
    c = c.replace(/\bconsole\.(log|warn|error|info|debug)\s*\([^)]*\)\s*;?/g, "");

    // Normalize trailing whitespace per line
    c = c
      .split("\n")
      .map((l) => l.trimEnd())
      .join("\n");

    // Ensure single trailing newline
    c = c.trimEnd() + "\n";

    return { ...f, content: c };
  });
}

// ─── Surgical Patch ────────────────────────────────────────────────────────────

/**
 * Surgical patch: only broken files + their direct dependents are sent to the LLM.
 * Single call, no retries, no metrics.
 */
export async function surgicalPatch(
  allFiles: StreamFile[],
  brokenPaths: string[],
  errors: ClassifiedError[],
  onPing?: () => void,
): Promise<StreamFile[]> {
  if (brokenPaths.length === 0) return allFiles;

  console.log(`[S4b] Surgical LLM patch on ${brokenPaths.length} broken file(s): ${brokenPaths.join(", ")}`);

  // 1. Determine target files: broken files + dependents
  const brokenSet = new Set(brokenPaths);
  const targetPaths = new Set(brokenPaths);

  for (const file of allFiles) {
    if (brokenSet.has(file.path)) continue;
    const relRe = /from\s+['"](\.[^'"]+)['"]/g;
    let m: RegExpExecArray | null;
    while ((m = relRe.exec(file.content)) !== null) {
      const dir = file.path.split("/").slice(0, -1).join("/");
      const resolved = resolveRelative(dir, m[1]);
      const candidates = [resolved, `${resolved}.jsx`, `${resolved}.js`];
      if (candidates.some((p) => brokenSet.has(p))) {
        targetPaths.add(file.path);
        break;
      }
    }
  }

  const targetFiles = allFiles.filter((f) => targetPaths.has(f.path));

  // 2. Build error summary
  const errorSummary = errors
    .filter((e) => brokenPaths.includes(e.file))
    .map((e) => `[${e.file}] ${e.class}: ${e.message}`)
    .join("\n");

  // 3. Build file bundle
  const fileBundle = targetFiles
    .map((f) => `// ═══ FILE: ${f.path} ═══\n${f.content}`)
    .join("\n\n");

  const pingTimer = onPing ? setInterval(onPing, PING_INTERVAL_MS) : null;

  try {
    const client = makeClient();
    const res = await client.chat.completions.create({
      model: FIX_MODEL,
      temperature: 0.05,
      max_tokens: 16000,
      messages: [
        {
          role: "system",
          content: `You are a React expert fixing specific errors in project files.

Return ONLY a JSON array: [{"path":"...","content":"..."}]
The array must contain EXACTLY ${targetFiles.length} files with IDENTICAL paths.
Fix ONLY the listed errors. Preserve all logic, styling, and functionality.
Every .jsx file must have: import React from 'react' AND export default.
Use Tailwind className for styling. framer-motion and lucide-react are allowed.`,
        },
        {
          role: "user",
          content: `ERRORS TO FIX:\n${errorSummary}\n\nFILES:\n${fileBundle}\n\nReturn all ${targetFiles.length} fixed files as JSON array.`,
        },
      ],
    });

    if (pingTimer) clearInterval(pingTimer);

    const raw = res.choices[0]?.message?.content ?? "";
    const text = stripMarkdown(raw);
    const start = text.indexOf("[");
    const end = text.lastIndexOf("]");
    if (start === -1 || end === -1) {
      throw new Error("No JSON array in patch response");
    }

    const parsed = JSON.parse(text.slice(start, end + 1)) as Array<{ path: string; content: string }>;

    // 4. Validate fixed files
    const validPaths = new Set(targetFiles.map((f) => f.path));
    const fixedMap = new Map<string, string>();

    for (const item of parsed) {
      if (
        typeof item.path === "string" &&
        typeof item.content === "string" &&
        validPaths.has(item.path) &&
        item.content.trim().length > 30
      ) {
        const hasExport = /\bexport\s+default\b/.test(item.content);
        const hasJSX = /return\s*\(?\s*</.test(item.content) || /return\s+</.test(item.content);
        if (item.path.endsWith(".jsx") && (!hasExport || !hasJSX)) continue;
        fixedMap.set(item.path, item.content);
      }
    }

    // 5. Merge fixes
    const result = allFiles.map((f) => {
      if (!fixedMap.has(f.path)) return f;
      return { ...f, content: fixedMap.get(f.path)! };
    });

    console.log(`[S4b] ✓ Surgical patch applied to ${fixedMap.size}/${targetFiles.length} files`);
    return result;
  } catch (error) {
    if (pingTimer) clearInterval(pingTimer);
    console.error(`[S4b] Surgical patch failed: ${String(error)} — keeping deterministic fixes`);
    return allFiles;
  }
}