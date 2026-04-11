// src/lib/ai/engine/retry-gate.ts
// Stage 6 — Retry gate v2.0
//
// CHANGES vs v1.0:
//   - Full project context sent on every pass (not just broken-file exports).
//   - All files fixed per pass (not just broken files) — cross-file issues resolved.
//   - Upgraded system prompt with mandatory React/Vite fix rules.
//   - Error summary injected prominently into every prompt.
//   - Strict output validation: exact file count + non-empty content required.
//   - Safety filter: rejects responses containing "= />", "<REDACTED", etc.
//   - Retry passes previous fixed state as new input (builds on progress).
//   - Partial-patch logic fully removed.

import OpenAI from "openai";
import type { CriticError } from "./ai-critic";

const client = new OpenAI({
  apiKey:  process.env.NVIDIA_API_KEY!,
  baseURL: "https://integrate.api.nvidia.com/v1",
});

const PATCH_MODEL = "mistralai/devstral-2-123b-instruct-2512";

export type AIFile = { path: string; content: string };

// ─── Prompt builders ──────────────────────────────────────────────────────────

function buildSystemPrompt(fileCount: number, filePaths: string[]): string {
  return `You are a senior React + Vite code repair system.
Fix the project so it compiles and runs without errors.

MANDATORY FIXES:
1. MISSING LUCIDE-REACT IMPORTS
   If a file uses Menu, X, ArrowRight, ArrowLeft, ChevronRight, ChevronDown,
   Check, Plus, Search, Settings, User, Star, Heart, ExternalLink, Github,
   Zap, Shield, Code, Terminal, or any other lucide icon in JSX,
   add or extend: import { <icons> } from 'lucide-react'

2. MISSING FRAMER-MOTION IMPORTS
   If motion.div / motion.span / AnimatePresence / useScroll / useTransform /
   useSpring / useInView are used, add or extend:
   import { motion, AnimatePresence, ... } from 'framer-motion'

3. NEVER USE react-router-dom
   Remove ALL imports from 'react-router-dom'.
   Replace <Link to="..."> → <a href="...">, <Link href="..."> → <a href="...">.
   Replace </Link> → </a>.

4. FIX JSX
   Every opened tag must have a matching close or be self-closed.
   No bare JS conditionals: BAD { if (x) <Foo /> } → GOOD { x && <Foo /> }
   Self-close void elements: <img />, <input />, <br />

5. FIX HOOKS
   Every useEffect MUST have a dependency array as second argument.
   BAD:  useEffect(() => { ... })
   GOOD: useEffect(() => { ... }, [])

6. FIX IMPORTS
   Every JSX component tag must be imported or defined locally.
   Every relative import path must point to an actual file in the project.
   Add .jsx extension to local component imports that lack one.

7. FIX SYNTAX
   Arrow functions: "=>" never "= />" (proxy artifact).
   No undefined variable references in JSX or logic.
   Every .jsx file must have: import React from 'react'
   Every .jsx file must have an export default statement.

8. CSS
   NEVER use data: URIs in url(). Named CSS gradients only.
   NEVER @import npm packages — CDN URLs only.

OUTPUT RULES (non-negotiable):
- Return ONLY a JSON array: [{"path":"...","content":"..."}]
- The array MUST contain EXACTLY ${fileCount} files with EXACTLY these paths:
  ${filePaths.map((p) => `"${p}"`).join(", ")}
- DO NOT create new files. DO NOT drop existing files.
- Escape all backslashes and quotes inside content strings properly.
- No markdown fences. No explanation. No prose. Pure JSON array only.`;
}

function buildUserPrompt(
  files: AIFile[],
  errorSummary: string
): string {
  const separator = "// ═══════════════════════════════════════════════════";
  const bundle = files
    .map((f) => `// FILE: ${f.path}\n${separator}\n${f.content}\n${separator}`)
    .join("\n\n");

  return `Errors to fix:
${errorSummary}

Fix ALL ${files.length} project files and return them as a JSON array.

PROJECT FILES (full content):
${bundle}

Return the fixed versions of ALL ${files.length} files.
Each object must have exactly "path" and "content" keys.
Path values must be identical to the originals.
Array must contain EXACTLY ${files.length} entries — no more, no less.`;
}

// ─── Output validation ────────────────────────────────────────────────────────

const SAFETY_PATTERNS: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /=\s*\/>/, label: '"= />" arrow proxy artifact' },
  { pattern: /<REDACTED/,  label: "<REDACTED token" },
  { pattern: /=\s*undefined\b(?![^;]*typeof)/, label: 'bare "= undefined" assignment' },
  { pattern: /<[a-zA-Z][^>]*$/, label: "unclosed JSX/HTML tag at end of file" },
];

function validateFileContent(file: AIFile): { valid: boolean; reason?: string } {
  if (!file.content || typeof file.content !== "string") {
    return { valid: false, reason: "content is empty or not a string" };
  }
  if (file.content.trim().length < 10) {
    return { valid: false, reason: `content too short (${file.content.trim().length} chars)` };
  }
  for (const { pattern, label } of SAFETY_PATTERNS) {
    if (pattern.test(file.content)) {
      return { valid: false, reason: `contains ${label}` };
    }
  }
  return { valid: true };
}

// ─── Response parser ──────────────────────────────────────────────────────────

function parseFilesFromResponse(
  text:          string,
  originalFiles: AIFile[]
): AIFile[] | null {
  const expectedCount = originalFiles.length;
  const originalPaths = new Set(originalFiles.map((f) => f.path));

  const cleaned = text.replace(/^```(?:json)?\s*/m, "").replace(/\s*```\s*$/m, "").trim();

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    const arrayMatch = cleaned.match(/\[\s*\{[\s\S]*\}\s*\]/);
    if (!arrayMatch) {
      console.warn(`⚠️ [retry] parseFilesFromResponse: no JSON array found`);
      return null;
    }
    try {
      parsed = JSON.parse(arrayMatch[0]);
    } catch {
      console.warn(`⚠️ [retry] parseFilesFromResponse: salvage parse failed`);
      return null;
    }
  }

  if (!Array.isArray(parsed)) {
    console.warn(`⚠️ [retry] parseFilesFromResponse: parsed value is not an array`);
    return null;
  }

  const files: AIFile[] = [];
  let unexpectedPaths  = 0;
  let invalidItems     = 0;
  let contentFailures  = 0;

  for (const item of parsed) {
    if (
      typeof item !== "object" || item === null ||
      typeof (item as Record<string, unknown>).path    !== "string" ||
      typeof (item as Record<string, unknown>).content !== "string"
    ) {
      invalidItems++;
      continue;
    }

    const file = item as AIFile;

    if (!originalPaths.has(file.path)) {
      console.warn(`⚠️ [retry] Unexpected path "${file.path}" in response — REJECTING`);
      unexpectedPaths++;
      continue;
    }

    const cv = validateFileContent(file);
    if (!cv.valid) {
      console.warn(`⚠️ [retry] Content invalid for "${file.path}": ${cv.reason}`);
      contentFailures++;
      continue;
    }

    files.push(file);
  }

  if (invalidItems > 0)    console.warn(`⚠️ [retry] Discarded ${invalidItems} malformed item(s)`);
  if (unexpectedPaths > 0) { console.warn(`❌ [retry] ${unexpectedPaths} unexpected path(s) — REJECTING response`); return null; }
  if (contentFailures > 0) { console.warn(`❌ [retry] ${contentFailures} content failure(s) — REJECTING response`); return null; }

  if (files.length !== expectedCount) {
    console.warn(
      `❌ [retry] File count mismatch: expected ${expectedCount}, got ${files.length} — REJECTING response`
    );
    return null;
  }

  return files;
}

// ─── Main export ──────────────────────────────────────────────────────────────

export async function retryGate(
  files:   AIFile[],
  errors:  CriticError[],
  attempt: number = 0
): Promise<AIFile[]> {
  if (errors.length === 0 || attempt >= 2) return files;

  const brokenPaths = new Set(errors.map((e) => e.file));
  const errorSummary = errors
    .map((e) => `  • [${e.file}] ${e.errorType}: ${e.description} → ${e.suggestedFix}`)
    .join("\n");

  console.log(
    `🔄 [retry] Pass ${attempt + 1}/2 — ` +
    `${errors.length} error(s) across ${brokenPaths.size} file(s): ${[...brokenPaths].join(", ")}\n` +
    `   Sending full project context (${files.length} files)`
  );

  try {
    const response = await client.chat.completions.create({
      model:       PATCH_MODEL,
      temperature: 0.05,
      max_tokens:  16000,
      messages: [
        {
          role:    "system",
          content: buildSystemPrompt(files.length, files.map((f) => f.path)),
        },
        {
          role:    "user",
          content: buildUserPrompt(files, errorSummary),
        },
      ],
    });

    const raw   = response.choices[0]?.message?.content ?? "";
    if (!raw.trim()) {
      console.warn("⚠️ [retry] Empty response from model — keeping current state");
      return files;
    }

    const fixed = parseFilesFromResponse(raw, files);

    if (!fixed) {
      console.warn(
        `⚠️ [retry] Pass ${attempt + 1} response failed strict validation — keeping current state`
      );
      return files;
    }

    console.log(`✅ [retry] Pass ${attempt + 1} produced ${fixed.length}/${files.length} valid files`);

    // Recurse: pass the fixed state + same errors to the next attempt
    // This builds on progress rather than restarting from scratch
    return retryGate(fixed, errors, attempt + 1);

  } catch (err) {
    console.error(
      `❌ [retry] Pass ${attempt + 1} threw: ${err instanceof Error ? err.message : String(err)}`
    );
    return files; // non-fatal — return current best state
  }
}