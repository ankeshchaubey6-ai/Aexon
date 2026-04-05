//==================== FILE: src/lib/ai/engine/pre-processor.ts ====================

// src/lib/ai/engine/pre-processor.ts
// Stage 2 — Deterministic pre-processor
// Runs on raw LLM output BEFORE autoFixFiles().
// Zero AI cost, 100% reliable, catches the most common structural failures.

export type AIFile = { path: string; content: string };

export function deterministicPreProcess(files: AIFile[]): AIFile[] {
  return files.map((f) => ({
    path: f.path,
    content: [
      stripAINoise,
      fixRedactedTokens,
      fixBraceBalance,
      fixParenBalance,
      fixJSONStrict,
      dedupeImports,
      ensureExportDefault,
    ].reduce((code, fn) => fn(code, f.path), f.content),
  }));
}

// ── 1. Strip LLM prose (leading AND trailing) ────────────────────────────────

const PROSE_LINE_RE = [
  /^(Here'?s?|This (file|component|code)|Note that|Let me|I (will|'ll|have|added)|Sure,|Certainly|Below is|In this)/i,
  /^(The above|The following|Finally[,\s]|Additionally[,\s]|Also[,\s]|Please note)/i,
  /^(You (can|should|need|may)|To (use|run|install|fix)|Hope this|Feel free)/i,
  /^#{1,6}\s+\w/,
  /^\d+\.\s+[A-Z]/,
];

function stripAINoise(code: string, _path: string): string {
  const lines = code.split("\n");

  // Pass A: strip leading prose lines
  let start = 0;
  for (let i = 0; i < lines.length; i++) {
    const t = lines[i].trim();
    if (!t) continue;
    if (PROSE_LINE_RE.some((p) => p.test(t))) { start = i + 1; continue; }
    break;
  }

  // Pass B: strip trailing prose block after last export default
  let end = lines.length;
  const lastExportIdx = lines.map((l, i) => ({ l, i }))
    .filter(({ l }) => /^\s*export\s+default\b/.test(l))
    .pop()?.i ?? -1;

  if (lastExportIdx > -1) {
    // Find first prose line after the export
    for (let i = lastExportIdx + 1; i < lines.length; i++) {
      const t = lines[i].trim();
      if (!t || t === ";") continue;
      if (PROSE_LINE_RE.some((p) => p.test(t))) { end = i; break; }
    }
  }

  return lines.slice(start, end).join("\n");
}

// ── 2. Undo NVIDIA proxy redactions ──────────────────────────────────────────
// The NVIDIA gateway sometimes corrupts: => becomes = />
// and email-like strings become <REDACTED_EMAIL>

function fixRedactedTokens(code: string, _path: string): string {
  let f = code;
  // Fix arrow operator corrupted by proxy: (e) = /> fn  →  (e) => fn
  f = f.replace(/(\))\s*=\s*\/\s*>/g, "$1 =>");
  f = f.replace(/(?<!=\s*)=\s*\/\s*>(?!=)/g, "=>");

  // Fix <REDACTED_EMAIL> placeholder tokens
  f = f.replace(/\b(useState|useReducer)\s*\(\s*<REDACTED_EMAIL>\s*\)/g, "$1('')");
  f = f.replace(/\b(useState|useReducer)\s*\(\s*<REDACTED_EMAIL>\s*,/g, "$1(null,");
  f = f.replace(/=\s*\{\s*<REDACTED_EMAIL>\s*\}/g, "={''}");
  f = f.replace(/\b(\w+)\s*\(\s*<REDACTED_EMAIL>\s*\)/g, "$1('')");
  f = f.replace(/=\s*<REDACTED_EMAIL>\b/g, "= ''");
  f = f.replace(/\[REDACTED(?:_EMAIL)?\]/g, "''");
  f = f.replace(/"<REDACTED_EMAIL>"/g, "''");
  f = f.replace(/'<REDACTED_EMAIL>'/g, "''");
  return f;
}

// ── 3. Balance braces (safe: only repairs 1-3 missing) ───────────────────────

function fixBraceBalance(code: string, path: string): string {
  if (!isJS(path)) return code;
  const open  = (code.match(/\{/g) ?? []).length;
  const close = (code.match(/\}/g) ?? []).length;
  const diff  = open - close;
  if (diff > 0 && diff <= 3) return code.trimEnd() + "\n" + "}".repeat(diff) + "\n";
  return code;
}

// ── 4. Balance parentheses (catches truncated return() blocks) ────────────────

function fixParenBalance(code: string, path: string): string {
  if (!isJS(path)) return code;
  const open  = (code.match(/\(/g) ?? []).length;
  const close = (code.match(/\)/g) ?? []).length;
  const diff  = open - close;
  // Only auto-close if small diff AND file has an open return(
  if (diff > 0 && diff <= 3 && code.includes("return (")) {
    return code.trimEnd() + "\n" + ")".repeat(diff) + "\n";
  }
  return code;
}

// ── 5. Fix JSON structural errors ─────────────────────────────────────────────

function fixJSONStrict(code: string, path: string): string {
  if (!path.endsWith(".json")) return code;
  let f = code;
  // Trailing commas before ] or }
  f = f.replace(/,(\s*[}\]])/g, "$1");
  // Unquoted semver: "react": ^18.2.0 → "react": "^18.2.0"
  f = f.replace(/:\s*(\^?~?\d+\.\d+[\d.]*)/g, ': "$1"');
  return f;
}

// ── 6. Deduplicate import lines ───────────────────────────────────────────────

function dedupeImports(code: string, path: string): string {
  if (!isJS(path)) return code;
  const lines = code.split("\n");
  const seen = new Set<string>();
  return lines.filter((line) => {
    const t = line.trim();
    if (!t.startsWith("import ")) return true;
    if (seen.has(t)) return false;
    seen.add(t);
    return true;
  }).join("\n");
}

// ── 7. Ensure exactly one export default per .jsx file ───────────────────────

function ensureExportDefault(code: string, path: string): string {
  if (!path.endsWith(".jsx")) return code;

  const matches = [...code.matchAll(/\bexport\s+default\b/g)];

  // Remove duplicate export defaults (keep first)
  if (matches.length > 1) {
    let count = 0;
    code = code.replace(/\bexport\s+default\s+(\w+)\s*;/g, (match) => {
      count++;
      return count === 1 ? match : "";
    });
  }

  // Add missing export default
  if (matches.length === 0) {
    const name = path.split("/").pop()?.replace(".jsx", "") ?? "Component";
    // Try to find a function with that name
    const fnMatch = code.match(new RegExp(`^function\\s+(${name})\\b`, "m"));
    if (fnMatch) {
      code = code.replace(
        new RegExp(`^function\\s+${name}\\b`, "m"),
        `export default function ${name}`
      );
    } else {
      code = code.trimEnd() + `\n\nexport default ${name};\n`;
    }
  }

  return code;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function isJS(path: string): boolean {
  return /\.(js|jsx|ts|tsx)$/.test(path);
}


