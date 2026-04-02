// src/lib/ai/llm/phi-fixer.ts
//
// Stage 4 — phi-3.5-mini-instruct (NVIDIA catalog)
//
// FIXES:
//  - Concurrency cap: max 3 phi calls at a time (was unlimited Promise.all)
//  - Per-call 45s timeout (phi is fast; if it hangs, skip it)
//  - Batch processing: only call phi on actually broken files
//  - "use client" stripping: phi sometimes re-adds it
//

import OpenAI from "openai";
import { AIFileNode } from "../types/ai-project.types";

const client = new OpenAI({
  apiKey: process.env.NVIDIA_API_KEY!,
  baseURL: "https://integrate.api.nvidia.com/v1",
});

const MAX_PHI_CONCURRENT = 3;
const PHI_TIMEOUT_MS = 45_000;

// ─── Semaphore ────────────────────────────────────────────────────────────────

class Semaphore {
  private queue: Array<() => void> = [];
  private running = 0;
  constructor(private limit: number) {}
  async acquire(): Promise<void> {
    if (this.running < this.limit) { this.running++; return; }
    await new Promise<void>((resolve) => this.queue.push(resolve));
    this.running++;
  }
  release(): void {
    this.running--;
    const next = this.queue.shift();
    if (next) next();
  }
}

const sem = new Semaphore(MAX_PHI_CONCURRENT);

// ─── Local validity check — skip API call if file looks fine ──────────────────

function looksValid(file: AIFileNode): boolean {
  const c = file.content;
  if (!file.path.endsWith(".jsx")) return true;

  const hasExportDefault = c.includes("export default");
  const hasReturn = c.includes("return (") || c.includes("return(") || c.includes("return <");
  const hasReactImport = c.includes("from 'react'") || c.includes('from "react"');

  const openBraces  = (c.match(/\{/g) ?? []).length;
  const closeBraces = (c.match(/\}/g) ?? []).length;
  const braceBalance = Math.abs(openBraces - closeBraces);

  return hasExportDefault && hasReturn && hasReactImport && braceBalance <= 2;
}

// ─── Single file validator ────────────────────────────────────────────────────

export async function validateAndFix(file: AIFileNode): Promise<AIFileNode> {
  if (looksValid(file)) return file; // ✅ No API call needed

  console.log(`  🔧 [S4] phi — fixing ${file.path}`);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), PHI_TIMEOUT_MS);

  await sem.acquire();

  try {
    const res = await client.chat.completions.create(
      {
        model: "microsoft/phi-3.5-mini-instruct",
        temperature: 0.1,
        max_tokens: 4000,
        messages: [
          {
            role: "system",
            content: `You are a JSX syntax fixer. Return ONLY the corrected file — no markdown, no backticks.
Do NOT add "use client" or "use server" directives.

Fix ONLY:
- Unclosed JSX tags
- Missing export default
- Missing React import
- Unbalanced braces/parentheses
- Broken import statements

Preserve all logic, styling, and component names.`,
          },
          {
            role: "user",
            content: `Fix this file (${file.path}):\n\n${file.content}`,
          },
        ],
      },
      { signal: controller.signal }
    );

    clearTimeout(timeoutId);

    let fixed = (res.choices[0]?.message?.content ?? file.content)
      .replace(/^```(?:jsx?|javascript)?\s*/gim, "")
      .replace(/^```\s*$/gim, "")
      // Strip "use client" — this is a Vite app, not Next.js
      .replace(/^["']use client["'];\s*\n*/m, "")
      .trim();

    console.log(`  ✅ [S4] Fixed ${file.path}`);
    return { ...file, content: fixed };

  } catch (err: any) {
    clearTimeout(timeoutId);
    const isTimeout = err?.name === "AbortError";
    console.warn(`  ⚠️ [S4] phi ${isTimeout ? "timed out" : "failed"} for ${file.path} — keeping original`);
    return file; // Degrade gracefully

  } finally {
    sem.release();
  }
}

// ─── Batch validator — Stage 4 entry point ───────────────────────────────────

export async function validateFilesWithPhi(
  files: AIFileNode[]
): Promise<AIFileNode[]> {
  // Only run phi on JSX files that fail the local check — saves many API calls
  const needsFix = files.filter((f) => f.path.endsWith(".jsx") && !looksValid(f));
  const passesLocal = files.filter((f) => !f.path.endsWith(".jsx") || looksValid(f));

  console.log(`🔧 [S4] ${files.length} files — ${needsFix.length} need phi fix, ${passesLocal.length} passed locally`);

  if (needsFix.length === 0) {
    console.log(`  ✅ [S4] All files passed local checks — phi not called`);
    return files;
  }

  const fixed = await Promise.all(needsFix.map(validateAndFix));

  const fixedCount = fixed.filter((f, i) => f.content !== needsFix[i].content).length;
  if (fixedCount > 0) {
    console.log(`  🔧 [S4] phi fixed ${fixedCount} file(s)`);
  }

  // Merge fixed files back — preserve original order
  const fixedMap = new Map(fixed.map((f) => [f.path, f]));
  return files.map((f) => fixedMap.get(f.path) ?? f);
}