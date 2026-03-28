// src/lib/ai/llm/phi-fixer.ts
//
// Stage 4 — phi-3.5-mini-instruct (NVIDIA catalog)
// Fast and cheap. Only called on JSX files that fail local syntax checks.
// Fixes: unclosed tags, missing export default, missing imports, brace imbalance.
// Does NOT rewrite logic or change design.
//

import OpenAI from "openai";
import { AIFileNode } from "../types/ai-project.types";

const client = new OpenAI({
  apiKey: process.env.NVIDIA_API_KEY!,
  baseURL: "https://integrate.api.nvidia.com/v1",
});

// ─────────────────────────────────────────────
// LOCAL CHECK — fast heuristics before any API call
// Returns true if the file looks valid (skip phi)
// ─────────────────────────────────────────────

function looksValid(file: AIFileNode): boolean {
  const c = file.content;

  // Non-JSX files don't need React syntax validation
  if (!file.path.endsWith(".jsx")) return true;

  const hasExportDefault = c.includes("export default");
  const hasReturn =
    c.includes("return (") ||
    c.includes("return(") ||
    c.includes("return <");
  const hasReactImport =
    c.includes("from 'react'") || c.includes('from "react"');

  const openBraces = (c.match(/\{/g) || []).length;
  const closeBraces = (c.match(/\}/g) || []).length;
  const braceBalance = Math.abs(openBraces - closeBraces);

  return hasExportDefault && hasReturn && hasReactImport && braceBalance <= 2;
}

// ─────────────────────────────────────────────
// SINGLE FILE VALIDATOR
// Skips API call if local check passes.
// ─────────────────────────────────────────────

export async function validateAndFix(file: AIFileNode): Promise<AIFileNode> {
  if (looksValid(file)) {
    return file; // ✅ Passes local check — no API call
  }

  console.log(`  🔧 [STAGE 4] phi-3.5-mini-instruct — fixing ${file.path}`);

  try {
    const completion = await client.chat.completions.create({
      model: "microsoft/phi-3.5-mini-instruct",
      temperature: 0.1,
      max_tokens: 4000,
      messages: [
        {
          role: "system",
          content: `You are a JSX syntax fixer. Return ONLY the corrected file — no markdown, no backticks, no explanation.

Fix ONLY syntax errors:
- Unclosed JSX tags
- Missing export default
- Missing React import
- Unbalanced braces or parentheses
- Broken import statements

Do NOT change logic, component names, styling, or functionality.
Preserve every line that is already valid.`,
        },
        {
          role: "user",
          content: `Fix this React file (${file.path}):\n\n${file.content}`,
        },
      ],
    });

    let fixed = completion.choices[0]?.message?.content || file.content;

    // Strip stray markdown fences
    fixed = fixed
      .replace(/^```(?:jsx?|javascript)?\s*/gim, "")
      .replace(/^```\s*$/gim, "")
      .trim();

    console.log(`  ✅ [STAGE 4] Fixed ${file.path}`);
    return { ...file, content: fixed };
  } catch (err) {
    console.warn(
      `  ⚠️ [STAGE 4] phi call failed — keeping original for ${file.path}:`,
      err
    );
    return file; // Degrade gracefully — keep original
  }
}

// ─────────────────────────────────────────────
// BATCH VALIDATOR — Stage 4 entry point
// Runs all files through validate-and-fix in parallel.
// Phi is only called on broken files, so most calls are no-ops.
// ─────────────────────────────────────────────

export async function validateFilesWithPhi(
  files: AIFileNode[]
): Promise<AIFileNode[]> {
  console.log(`🔧 [STAGE 4] Validating ${files.length} files with phi-3.5-mini...`);

  const results = await Promise.all(files.map(validateAndFix));

  const fixedCount = results.filter(
    (r, i) => r.content !== files[i].content
  ).length;

  if (fixedCount > 0) {
    console.log(`  🔧 [STAGE 4] phi fixed ${fixedCount} file(s)`);
  } else {
    console.log(`  ✅ [STAGE 4] All files passed local checks — phi not called`);
  }

  return results;
}