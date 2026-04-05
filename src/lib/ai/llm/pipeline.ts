//==================== FILE: src/lib/ai/llm/pipeline.ts ====================

// ════════════════════════════════════════════════════════════════════════════
// DIFF — src/lib/ai/llm/pipeline.ts
// Add these imports at the TOP of the file (after existing imports)
// ════════════════════════════════════════════════════════════════════════════

import { deterministicPreProcess } from "@/lib/ai/engine/pre-processor";
import { runAICritic } from "@/lib/ai/engine/ai-critic";
import { retryGate } from "@/lib/ai/engine/retry-gate";

// ════════════════════════════════════════════════════════════════════════════
// DIFF — src/lib/ai/llm/pipeline.ts
// Find your existing generateProjectWithPipeline function.
// It currently returns files directly. Wrap it like this:
// ════════════════════════════════════════════════════════════════════════════

// BEFORE (your current code, roughly):
// export async function generateProjectWithPipeline(prompt: string) {
//   const files = await someInternalGeneration(prompt);
//   return files;
// }

// AFTER — replace the return statement with this block:
export async function generateProjectWithPipeline_PATCHED(
  originalFiles: any[] // whatever type your pipeline returns
): Promise<any[]> {
  // Stage 2: deterministic pre-processor (zero AI cost)
  let files = deterministicPreProcess(originalFiles);
  console.log("✅ [pre-processor] Done");

  // (your existing autoFixFiles + runSemanticValidation stay here, unchanged)
  // files = autoFixStreamFiles(files);
  // files = runSemanticValidation(files);

  // Stage 4: AI critic (glm-4.7, fast, cheap)
  const errors = await runAICritic(files);

  // Stage 6: retry gate (devstral, only broken files)
  if (errors.length > 0) {
    files = await retryGate(files, errors, 0);
  }

  return files;
}

// ════════════════════════════════════════════════════════════════════════════
// DIFF — src/app/api/ai/generate/route.ts
// Replace the pipeline call block (lines ~80-95) with:
// ════════════════════════════════════════════════════════════════════════════

/*
import { deterministicPreProcess } from "@/lib/ai/engine/pre-processor";
import { runAICritic } from "@/lib/ai/engine/ai-critic";
import { retryGate } from "@/lib/ai/engine/retry-gate";

// Inside the POST handler, after generateProjectWithPipeline returns:
files = await generateProjectWithPipeline(prompt);

// ← INSERT THESE 4 LINES:
files = deterministicPreProcess(files);
const criticErrors = await runAICritic(files);
if (criticErrors.length > 0) {
  files = await retryGate(files, criticErrors, 0);
}
// END INSERT

AIOrchestrator.setProjectFiles(projectId, files);
*/

// ═══════════════════════════════════════════════════════════════════════════
// PERMANENT PIPELINE FIXES — drop these into your existing files
//
// File targets:
//   A) src/lib/ai/stream/stream-pipeline.ts  → replace stripMarkdown, stripLLMLeakage
//   B) src/lib/ai/engine/auto-fix.ts         → replace fixCSS, stripLLMLeakage, fixEscapeArtifacts
//   C) src/lib/ai/validation/syntax-checker.ts → add new checks
//
// Root causes fixed:
//   1. "= />" corruption     → proxy redacts "=>" as email-like token
//   2. <REDACTED_EMAIL>      → proxy treats useState('') arg as email token
//   3. Prose after JSX       → stripLLMLeakage only strips leading lines, not trailing blocks
//   4. url(none)')           → fixCSS kills url() content but orphans surrounding quotes
//   5. Truncated output      → no detection of incomplete JSX (missing closing tags)
//   6. Numeric identifiers   → fixNumericStartImports misses renamed usages in file body
//   7. Ghost data imports    → semantic validator doesn't check data/hooks files
// ═══════════════════════════════════════════════════════════════════════════


// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// A) src/lib/ai/stream/stream-pipeline.ts
//    Replace the existing stripMarkdown function with this one.
//    Add fixRedactedTokens as a new function and call it right after
//    stripMarkdown in EVERY place LLM output is processed.
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Strip markdown fences + "use client" from raw LLM output.
 * ONLY strips complete fence lines — never touches content inside strings.
 */
function stripMarkdown(text: string): string {
  return text
    .replace(/^```(?:json|jsx?|javascript|typescript|tsx?|css|html|scss)?\s*\r?\n?/gim, "")
    .replace(/^```\s*$/gim, "")
    .replace(/^["']use client["'];\s*\r?\n?/m, "")
    .trim();
}

/**
 * FIX 1 + FIX 2: Undo proxy-level redactions that corrupt valid JS/JSX.
 *
 * The NVIDIA API gateway (or an intermediate proxy) applies two transforms
 * that break generated code:
 *
 *   a) Arrow operator =>  inside JSX attribute strings gets split into
 *      "= />" because the proxy tokenises "=>" as a potential email
 *      address delimiter and inserts a space + slash.
 *      Pattern: onChange={(e) = /> fn}
 *
 *   b) String arguments that look like email addresses (or are empty strings
 *      adjacent to email-like tokens) get replaced wholesale with the string
 *      literal "<REDACTED_EMAIL>" or "[REDACTED]".
 *      Pattern: useState(<REDACTED_EMAIL>)  useCallback(<REDACTED_EMAIL>, [...])
 *
 * Call this function immediately after stripMarkdown() on EVERY LLM response
 * before any other processing.
 */
function fixRedactedTokens(code: string): string {
  let fixed = code;

  // ── Fix 1a: "= />" → "=>" inside JSX event handlers ────────────────────
  // Handles all whitespace variants the proxy might emit:
  //   (e) = /> fn        →  (e) => fn
  //   (e) = / > fn       →  (e) => fn
  //   (e)= />fn          →  (e) => fn
  //   (event)  =  />     →  (event) =>
  fixed = fixed.replace(/(\))\s*=\s*\/\s*>/g, "$1 =>");

  // ── Fix 1b: standalone "= />" at start of expression (no parens before) ─
  // Handles: onChange={val = /> setVal}
  fixed = fixed.replace(/(?<!=\s*)=\s*\/\s*>/g, "=>");

  // ── Fix 2a: <REDACTED_EMAIL> placeholder used as a value ────────────────
  // Replace with appropriate default based on surrounding context.
  // Pattern: useState(<REDACTED_EMAIL>) → useState('')
  // Pattern: useState(<REDACTED_EMAIL>, [...]) → useState(null, [...])
  fixed = fixed.replace(
    /\b(useState|useReducer)\s*\(\s*<REDACTED_EMAIL>\s*\)/g,
    "$1('')"
  );
  fixed = fixed.replace(
    /\b(useState|useReducer)\s*\(\s*<REDACTED_EMAIL>\s*,/g,
    "$1(null,"
  );

  // ── Fix 2b: <REDACTED_EMAIL> as a JSX prop value ─────────────────────────
  // <input value={<REDACTED_EMAIL>} → <input value={''}
  fixed = fixed.replace(
    /=\s*\{\s*<REDACTED_EMAIL>\s*\}/g,
    "={''}"
  );

  // ── Fix 2c: <REDACTED_EMAIL> as a function argument ──────────────────────
  // setEmail(<REDACTED_EMAIL>) → setEmail('')
  fixed = fixed.replace(
    /\b(\w+)\s*\(\s*<REDACTED_EMAIL>\s*\)/g,
    "$1('')"
  );

  // ── Fix 2d: <REDACTED_EMAIL> in variable initialisers ────────────────────
  // const x = <REDACTED_EMAIL>  →  const x = ''
  fixed = fixed.replace(
    /=\s*<REDACTED_EMAIL>\b/g,
    "= ''"
  );

  // ── Fix 2e: bracket variants [REDACTED] / [REDACTED_EMAIL] ───────────────
  fixed = fixed.replace(/\[REDACTED(?:_EMAIL)?\]/g, "''");

  // ── Fix 2f: the string literal "<REDACTED_EMAIL>" inside quotes ──────────
  // If the proxy wrapped it in quotes, replace with empty string
  fixed = fixed.replace(/"<REDACTED_EMAIL>"/g, "''");
  fixed = fixed.replace(/'<REDACTED_EMAIL>'/g, "''");

  return fixed;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// B-1) src/lib/ai/engine/auto-fix.ts
//      Replace the existing stripLLMLeakage function entirely.
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * FIX 3: Strip ALL LLM prose from generated code files.
 *
 * Previous version only stripped lines whose FIRST token matched a prose
 * pattern, so trailing explanation blocks (appended after the closing brace
 * of export default) slipped through untouched.
 *
 * Strategy (two passes):
 *   Pass A — Trailing-block truncation:
 *     Find the last valid code boundary (the line containing "export default"
 *     OR the last closing brace at column 0) and discard everything after it
 *     that looks like prose.
 *
 *   Pass B — Line-by-line prose removal:
 *     Remove any line (anywhere in the file) that matches a prose signature.
 *     This catches inline comments that are actually LLM commentary.
 */
function stripLLMLeakage(code: string, fixes: string[]): string {
  let fixed = code;
  let changed = false;

  // ── Pass A: Trailing prose block after the last export/closing brace ─────
  //
  // We look for the last occurrence of:
  //   export default <Identifier>;        (named re-export)
  //   export default function/class ...   (inline export)
  //   }  at column 0 (top-level closing brace)
  //
  // Everything after that position which starts with a capital letter followed
  // by prose-like continuation is stripped.

  // Find the end of the last export default statement
  const exportDefaultRe = /^export\s+default\b[^\n]*/gm;
  let lastExportMatch: RegExpExecArray | null = null;
  let m: RegExpExecArray | null;
  while ((m = exportDefaultRe.exec(fixed)) !== null) lastExportMatch = m;

  if (lastExportMatch) {
    const endOfExport = lastExportMatch.index + lastExportMatch[0].length;
    const after = fixed.slice(endOfExport);

    // Allow a semicolon and optional newlines, then check if prose follows
    const proseAfterExport = after.replace(/^[\s;]+/, "");

    const PROSE_STARTERS = [
      /^I\s+(have|added|removed|updated|fixed|also|changed)/i,
      /^Note\s+that\b/i,
      /^Here('s| is)\b/i,
      /^This\s+(component|file|code|hook|approach|implementation)\b/i,
      /^The\s+(above|following|component|file|code|function)\b/i,
      /^In\s+(this|the)\s+(component|file|code|implementation)\b/i,
      /^Finally[,\s]/i,
      /^Additionally[,\s]/i,
      /^Also[,\s]/i,
      /^Please\s+note\b/i,
      /^You\s+(can|should|need|may)\b/i,
      /^To\s+(use|run|install|fix|make)\b/i,
      /^Let\s+me\s+(know|explain)\b/i,
      /^Hope\s+(this|that)\b/i,
      /^Feel\s+free\b/i,
    ];

    if (PROSE_STARTERS.some((p) => p.test(proseAfterExport))) {
      // Keep only up to (and including) the export default line + its semicolon
      const keep = fixed.slice(0, endOfExport).replace(/\s*$/, "") + "\n";
      fixed = keep;
      changed = true;
      fixes.push("stripped-trailing-prose-block");
    }
  }

  // ── Pass B: Line-level prose removal ────────────────────────────────────
  //
  // Matches lines that start with LLM commentary patterns.
  // Runs AFTER Pass A so we also clean up any mid-file commentary.

  const PROSE_LINE_PATTERNS = [
    /^(In this |Here('s| is) |This (component|file|code)|Note that )/i,
    /^(I have |I've |I added |I removed |I updated |I fixed |I also )/i,
    /^(The above |The following |The component |The file )/i,
    /^(Finally[,\s]|Additionally[,\s]|Also[,\s]|Moreover[,\s])/i,
    /^(Please note|You can|You should|You need|You may)\b/i,
    /^(To use|To run|To install|To fix|To make)\b/i,
    /^(Let me know|Hope this|Feel free)\b/i,
    // Markdown headers that sneak through
    /^#{1,6}\s+\w/,
    // Numbered list items (LLM explanations)
    /^\d+\.\s+[A-Z]/,
    // Bullet prose
    /^[-*•]\s+[A-Z][a-z]{3,}/,
  ];

  const lines = fixed.split("\n");
  const filtered = lines.filter((line) => {
    const trimmed = line.trim();
    if (!trimmed) return true; // keep blank lines
    if (trimmed.startsWith("//") || trimmed.startsWith("/*") || trimmed.startsWith("*")) return true;
    if (PROSE_LINE_PATTERNS.some((p) => p.test(trimmed))) {
      fixes.push("removed-llm-prose-line");
      changed = true;
      return false;
    }
    return true;
  });

  if (changed) fixed = filtered.join("\n");
  return fixed;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// B-2) src/lib/ai/engine/auto-fix.ts
//      Replace the existing fixCSS function entirely.
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * FIX 4: CSS fixes — comprehensive url() handling + unclosed strings.
 *
 * Previous version replaced the url() inner content with "none" but left
 * surrounding quotes in place, producing url(none)') — a new parse error.
 *
 * This version replaces the ENTIRE url(...) expression (including any
 * surrounding quotes) with url() to produce a syntactically valid no-op.
 *
 * Also handles:
 *  - Truncated base64 data URLs
 *  - Unclosed string values in property declarations
 *  - @import ordering
 *  - Missing semicolons
 */
function fixCSS(code: string, fixes: string[]): string {
  let fixed = code;
  let changed = false;

  // ── Fix 4a: Broken url() expressions ─────────────────────────────────────
  //
  // Covers all these malformed patterns:
  //   url(none)')           ← old auto-fix left a dangling quote+paren
  //   url('data:...[cut]    ← truncated base64 (no closing quote or paren)
  //   url("data:...[cut]    ← same with double quotes
  //   url(none)             ← already "fixed" but still malformed value
  //   url('')')             ← double-closed
  //
  // Strategy: match any url(...) where the interior is:
  //   - a data: URI (always replace — these truncate unpredictably)
  //   - already "none" but followed by a stray quote or paren
  //   - an unclosed string (no matching closing quote before ) or newline)
  //
  // Replace the whole url(...) expression, including stray trailing
  // characters, with just: url()

  // Step 1: Kill all data: URIs — they're never safe to keep as-is after
  // an LLM truncates them.
  fixed = fixed.replace(/url\(\s*['"]?data:[^)]*\)?['"]?\s*\)?/g, "url()");

  // Step 2: Kill url(none)') and similar stray-quote variants.
  // Matches: url(anything) optionally followed by ', ", or ) characters
  fixed = fixed.replace(/url\([^)]*\)\s*['")\s]+(?=['"\s{};]|$)/gm, (match) => {
    // Only replace if there are trailing quote/paren chars after url(...)
    if (/url\([^)]*\)\s*['")]+/.test(match)) {
      changed = true;
      return "url()";
    }
    return match;
  });

  // Step 3: Fix unclosed url( strings — url(' with no closing ')
  fixed = fixed.replace(/url\(\s*'[^')\n]*$/gm, "url()");
  fixed = fixed.replace(/url\(\s*"[^")\n]*$/gm, "url()");

  if (fixed !== code) {
    changed = true;
    fixes.push("css-url-expressions-fixed");
  }

  // ── Fix 4b: Unclosed string values in property declarations ──────────────
  //
  // Pattern: background-image: 'unclosed...  (no closing quote before ; or })
  // Replace the value with 'none' to keep the property syntactically valid.
  const unclosedStringFixed = fixed.replace(
    /(:\s*')((?:[^'\n\\]|\\.)*?)$/gm,
    "$1none'"
  );
  const unclosedStringFixed2 = unclosedStringFixed.replace(
    /(:\s*")((?:[^"\n\\]|\\.)*?)$/gm,
    '$1none"'
  );
  if (unclosedStringFixed2 !== fixed) {
    fixed = unclosedStringFixed2;
    changed = true;
    fixes.push("css-unclosed-strings-fixed");
  }

  // ── Fix 4c: Move @import rules to the very top ───────────────────────────
  const importLines: string[] = [];
  const otherLines: string[] = [];
  for (const line of fixed.split("\n")) {
    if (/^\s*@import\s/.test(line)) importLines.push(line);
    else otherLines.push(line);
  }
  if (importLines.length > 0) {
    const reordered = [...importLines, "", ...otherLines].join("\n");
    if (reordered !== fixed) {
      fixed = reordered;
      changed = true;
      fixes.push("css-import-moved-to-top");
    }
  }

  // ── Fix 4d: Missing semicolons ───────────────────────────────────────────
  const withSemis = fixed.replace(
    /([a-zA-Z-]+\s*:\s*[^;{}]+)(\s*\n\s*[a-zA-Z-]+\s*:)/g,
    "$1;$2"
  );
  if (withSemis !== fixed) {
    fixed = withSemis;
    changed = true;
  }

  // ── Fix 4e: 0px → 0 ─────────────────────────────────────────────────────
  const zeroPx = fixed.replace(/:\s*0px\b/g, ": 0");
  if (zeroPx !== fixed) {
    fixed = zeroPx;
    changed = true;
  }

  if (changed) fixes.push("css-fixes");
  return fixed;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// B-3) src/lib/ai/engine/auto-fix.ts
//      Replace the existing fixEscapeArtifacts function.
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * FIX 5: Escape artifacts — extend to also catch proxy-mangled operators.
 */
function fixEscapeArtifacts(code: string, fixes: string[]): string {
  let fixed = code;

  // Original escape fixes
  fixed = fixed.replace(/\\\\n/g, "\n");
  fixed = fixed.replace(/\\\\t/g, "\t");
  fixed = fixed.replace(/\\\\r/g, "");
  fixed = fixed.replace(/(?<!\\)\\n(?!["\\])/g, "\n");
  fixed = fixed.replace(/(?<!\\)\\t(?!["\\])/g, "\t");
  fixed = fixed.replace(/\\"([^"]*)\\"(?=\s*[,;)\]}])/g, '"$1"');

  // Arrow operator variants produced by different proxy implementations:
  //   = />     (space-slash-gt — most common)
  //   =/ >     (slash before space)
  //   =/\>     (escaped gt)
  fixed = fixed.replace(/(\))\s*=\s*\/\s*>/g, "$1 =>");
  fixed = fixed.replace(/(\))\s*=\/\s*>/g, "$1 =>");

  // Broken ternary: "? /" → "? " (proxy treating ? as email boundary)
  // Only fix inside JSX attribute context to avoid breaking regex literals
  // This is conservative — only matches inside {} JSX expressions
  // fixed = fixed.replace(/\?\s*\/(?!\*|\/)(\s)/g, "? $1"); // disabled: too risky

  if (fixed !== code) fixes.push("escape-artifacts");
  return fixed;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// B-4) src/lib/ai/engine/auto-fix.ts
//      New function — add to the JS fix pipeline after fixEscapeArtifacts.
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * FIX 6: Truncation detection and repair.
 *
 * LLM output sometimes gets cut mid-file (token limit, network, timeout).
 * This leaves JSX/JS in a state where:
 *   - The return() statement is open but never closed
 *   - The component function body is open but never closed
 *   - The file ends mid-expression
 *
 * Detection heuristics (any one triggers repair):
 *   - Unbalanced parentheses (open > close by more than 1)
 *   - Unbalanced braces (open > close by more than 2)
 *   - Last non-empty line is NOT one of: };  }  );  />  ;
 *   - File contains "return (" but no matching closing ")"
 */
function fixTruncatedOutput(code: string, filePath: string, fixes: string[]): string {
  if (!filePath.endsWith(".jsx") && !filePath.endsWith(".js")) return code;
  if (!code || code.length < 50) return code;

  let fixed = code.trim();

  const openParens  = (fixed.match(/\(/g) ?? []).length;
  const closeParens = (fixed.match(/\)/g) ?? []).length;
  const openBraces  = (fixed.match(/\{/g) ?? []).length;
  const closeBraces = (fixed.match(/\}/g) ?? []).length;

  const parenDiff = openParens - closeParens;
  const braceDiff = openBraces - closeBraces;

  const lines = fixed.split("\n");
  const lastLine = lines.filter((l) => l.trim()).pop() ?? "";
  const properEnding = /^[\s})\];,]+$/.test(lastLine) || lastLine.trim().match(/^(};?|};|\/>;?|\);?|,)$/);

  const isTruncated =
    parenDiff > 1 ||
    braceDiff > 2 ||
    (!properEnding && (parenDiff > 0 || braceDiff > 0));

  if (!isTruncated) return fixed;

  // Attempt repair by closing open structures
  fixes.push(`truncation-repaired:parens+${parenDiff},braces+${braceDiff}`);

  // Close open JSX return statement if needed
  if (parenDiff > 0) {
    // If we have an open return (, add closing );
    if (fixed.includes("return (")) {
      fixed = fixed + "\n" + ")".repeat(Math.min(parenDiff, 3));
    } else {
      fixed = fixed + "\n" + ")".repeat(Math.min(parenDiff, 2));
    }
  }

  // Close open function bodies
  if (braceDiff > 0) {
    fixed = fixed + "\n" + "}".repeat(Math.min(braceDiff, 3));
  }

  // Ensure export default exists
  if (!fixed.includes("export default")) {
    const compName = filePath.split("/").pop()?.replace(/\.[^.]+$/, "") ?? "Component";
    const funcMatch = fixed.match(/^(?:export\s+default\s+)?function\s+([A-Z]\w*)/m);
    const name = funcMatch ? funcMatch[1] : compName;
    fixed += `\n\nexport default ${name};\n`;
    fixes.push("added-export-default-after-truncation-repair");
  }

  return fixed;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// B-5) src/lib/ai/engine/auto-fix.ts
//      New function — add to the JS fix pipeline.
//      Also update fixNumericStartImports to also rename usages in the body.
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * FIX 7: Fix numeric-start import identifiers AND rename all usages in body.
 *
 * Previous version only renamed the import statement itself, leaving the
 * identifier used in JSX/JS body still starting with a digit.
 */
function fixNumericStartImports(code: string, fixes: string[]): string {
  let fixed = code;

  const importRe = /import\s+(\d\w*)\s+from\s+(['"][^'"]+['"])/g;
  let m: RegExpExecArray | null;

  while ((m = importRe.exec(fixed)) !== null) {
    const badIdent = m[1];
    const safeIdent = `_${badIdent}`;
    fixes.push(`fixed-numeric-import-identifier:${badIdent}→${safeIdent}`);

    // Replace import declaration
    fixed = fixed.replace(
      new RegExp(`import\\s+${badIdent}\\s+from`, "g"),
      `import ${safeIdent} from`
    );

    // Replace all usages in the file body (JSX + JS expressions)
    // Use word boundary to avoid partial matches
    fixed = fixed.replace(
      new RegExp(`\\b${badIdent}\\b`, "g"),
      safeIdent
    );

    // Reset regex since we modified the string
    importRe.lastIndex = 0;
  }

  return fixed;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// C) src/lib/ai/validation/syntax-checker.ts
//    Add these new checks to the checkSyntax function.
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * FIX 8: New syntax checks to add to checkSyntax().
 *
 * Add these checks inside the per-file loop in syntax-checker.ts.
 * Each one pushes to the errors array on detection.
 */
function additionalSyntaxChecks(
  c: string,
  filePath: string,
  errors: Array<{ path: string; message: string }>
): void {
  // ── Check 1: Proxy arrow corruption (= />) ────────────────────────────────
  if (/=\s*\/\s*>/.test(c)) {
    errors.push({
      path: filePath,
      message: "Proxy-corrupted arrow operator: '= />' found (should be '=>')",
    });
  }

  // ── Check 2: Redacted email placeholder ──────────────────────────────────
  if (/<REDACTED_EMAIL>|\[REDACTED(?:_EMAIL)?\]/.test(c)) {
    errors.push({
      path: filePath,
      message: "Proxy redaction token found: <REDACTED_EMAIL> or [REDACTED]",
    });
  }

  // ── Check 3: Prose appended after export default ─────────────────────────
  const PROSE_AFTER_EXPORT = [
    /export\s+default\s+\w+\s*;\s*\n+\s*I\s+(have|added|removed)/i,
    /export\s+default\s+\w+\s*;\s*\n+\s*Note\s+that/i,
    /export\s+default\s+\w+\s*;\s*\n+\s*Here('s| is)/i,
    /export\s+default\s+\w+\s*;\s*\n+\s*This\s+(component|file)/i,
  ];
  if (PROSE_AFTER_EXPORT.some((p) => p.test(c))) {
    errors.push({
      path: filePath,
      message: "LLM prose block detected after export default statement",
    });
  }

  // ── Check 4: Broken CSS url() ────────────────────────────────────────────
  if (filePath.endsWith(".css")) {
    // url(none)') — the specific pattern from the bug report
    if (/url\([^)]*\)\s*['")]+/.test(c)) {
      errors.push({
        path: filePath,
        message: "Malformed CSS url() expression with trailing quote/paren",
      });
    }
    // Unclosed data URL
    if (/url\(\s*['"]?data:[^'")]*$/.test(c)) {
      errors.push({
        path: filePath,
        message: "Truncated CSS data URL in url() expression",
      });
    }
  }

  // ── Check 5: Truncated output ─────────────────────────────────────────────
  if (filePath.endsWith(".jsx")) {
    const openParens  = (c.match(/\(/g) ?? []).length;
    const closeParens = (c.match(/\)/g) ?? []).length;
    const openBraces  = (c.match(/\{/g) ?? []).length;
    const closeBraces = (c.match(/\}/g) ?? []).length;
    if (openParens - closeParens > 2) {
      errors.push({ path: filePath, message: `Likely truncated output: ${openParens - closeParens} unclosed parentheses` });
    }
    if (openBraces - closeBraces > 3) {
      errors.push({ path: filePath, message: `Likely truncated output: ${openBraces - closeBraces} unclosed braces` });
    }
  }

  // ── Check 6: Numeric-start identifier still present in body ──────────────
  if (/\b\d\w*\s*(?:\.|\[|=|\()/.test(c) && /import\s+\d\w*\s+from/.test(c)) {
    errors.push({
      path: filePath,
      message: "Numeric-start identifier used after import (fixNumericStartImports incomplete)",
    });
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// HOW TO WIRE EVERYTHING TOGETHER
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//
// 1. In stream-pipeline.ts, replace ALL LLM response processing with:
//
//      let content = stripMarkdown(res.choices[0]?.message?.content ?? "");
//      content = fixRedactedTokens(content);   // ← ADD THIS EVERYWHERE
//      // ...rest of processing...
//
//    This must go in EVERY place you call stripMarkdown:
//      - generateOneFile()
//      - planProject()
//      - fixWithPhi()
//      - refineComponent()
//      - rewriteFilesWithDeepseek()   (pipeline.ts)
//      - editProjectWithPipeline()    (pipeline.ts)
//
// 2. In auto-fix.ts, update the JS fix pipeline in fixFile():
//
//      if (isJS) {
//        code = stripUseClientDirective(code, fixes);
//        code = stripLLMLeakage(code, fixes);       // ← REPLACED above
//        code = fixNumericStartImports(code, fixes); // ← REPLACED above
//        code = fixTruncatedOutput(code, file.path, fixes); // ← NEW
//        code = fixDuplicateDeclarations(code, fixes);
//        // ...rest unchanged...
//        code = fixEscapeArtifacts(code, fixes);    // ← REPLACED above
//        // ...rest unchanged...
//      }
//
//      if (isCSS) {
//        code = fixCSS(code, fixes);                // ← REPLACED above
//      }
//
// 3. In syntax-checker.ts, call additionalSyntaxChecks() at the end
//    of the per-file loop:
//
//      additionalSyntaxChecks(c, file.path, errors);
//
// 4. In stream-pipeline.ts CODEGEN_SYSTEM / PLANNER_SYSTEM prompts,
//    add this to the CRITICAL rules section to reduce source errors:
//
//    CSS RULES (CRITICAL):
//    - NEVER write url() with a data: URI — use short named gradients instead
//    - All CSS strings must have matching opening AND closing quotes
//    - url() must be: url() or url(#id) or url('path') — never truncated
//
//    JS RULES (CRITICAL):
//    - Arrow functions must use => not = />
//    - Never leave explanation text after the closing brace of export default
//    - Complete the ENTIRE file — never truncate, never write "// rest here"
//
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// CODEGEN_SYSTEM ADDITIONS (paste into your existing CODEGEN_SYSTEM string)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export const CODEGEN_SYSTEM_ADDITIONS = `
━━━ OUTPUT INTEGRITY (ABSOLUTE RULES — violations crash the build) ━━━
- NEVER write explanation text after the final closing brace or export default
- NEVER truncate output — complete every JSX tag, every function, every file
- Arrow functions use => not = /> or =/ > (these are proxy artifacts, avoid them)
- In CSS: NEVER use url() with data: URIs — they truncate. Use gradients instead:
    background: linear-gradient(135deg, #6366f1, #a855f7)   ← CORRECT
    background-image: url("data:image/svg+xml,...")          ← FORBIDDEN
- In CSS: ALL url() must close with exactly one ) and no trailing quotes:
    url()         ← valid (empty)
    url('#id')    ← valid
    url(none)')   ← INVALID (trailing quote+paren)
- In JSX: NEVER leave a closing tag unmatched — every <div> needs </div>
- Complete the entire file in one response — no "// TODO", no "// rest here"
`;


