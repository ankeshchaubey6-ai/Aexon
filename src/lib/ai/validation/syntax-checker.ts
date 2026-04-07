//==================== FILE: src/lib/ai/validation/syntax-checker.ts ====================

// src/lib/ai/validation/syntax-checker.ts
//
// v8.1 additions (marked NEW):
//  - Proxy arrow corruption check (= />)
//  - Redacted token check (<REDACTED_EMAIL>)
//  - TypeScript annotation leak check (for .jsx files)
//  - Truncation detection (severely unbalanced parens/braces)
//  - CSS url() corruption check
//  All existing checks are unchanged.

import type { StreamFile } from "@/lib/ai/stream/stream-pipeline";

export interface SyntaxError {
  path: string;
  message: string;
}

export function checkSyntax(files: StreamFile[]): SyntaxError[] {
  const errors: SyntaxError[] = [];

  for (const file of files) {
    if (!file.path.endsWith(".jsx") && !file.path.endsWith(".js")) continue;
    const c = file.content;

    if (!c || c.length < 20) {
      errors.push({ path: file.path, message: "File content empty or too short" });
      continue;
    }

    // ── React import ────────────────────────────────────────────────────────
    const hasAnyReactImport = c.includes("from 'react'") || c.includes('from "react"');
    if (!hasAnyReactImport && file.path.endsWith(".jsx")) {
      errors.push({ path: file.path, message: "Missing React import" });
    }

    const usesReactAPI = /\bReact\.(memo|forwardRef|createContext|lazy|Suspense|Children|cloneElement)/.test(c);
    const hasReactDefault = /import\s+React\b/.test(c);
    if (usesReactAPI && !hasReactDefault) {
      errors.push({ path: file.path, message: "Uses React.* API but missing default React import" });
    }

    // ── Export default ──────────────────────────────────────────────────────
    if (file.path.endsWith(".jsx")) {
      const exportDefaultCount = (c.match(/\bexport\s+default\b/g) ?? []).length;
      if (exportDefaultCount > 1) {
        errors.push({ path: file.path, message: `Multiple export default (${exportDefaultCount}x)` });
      }
      if (exportDefaultCount === 0) {
        errors.push({ path: file.path, message: "Missing export default" });
      }
    }

    // ── Duplicate named import specifiers ────────────────────────────────────
    for (const match of c.matchAll(/import\s+(?:\w+\s*,\s*)?\{([^}]+)\}\s+from\s+['"][^'"]+['"]/g)) {
      const specifiers = match[1].split(",").map((s) => s.trim()).filter(Boolean);
      const seen = new Set<string>();
      for (const s of specifiers) {
        if (seen.has(s)) {
          errors.push({ path: file.path, message: `Duplicate named import specifier: '${s}'` });
          break;
        }
        seen.add(s);
      }
    }

    // ── Invalid identifier (import starts with digit) ────────────────────────
    if (/import\s+\d\w*\s+from/.test(c)) {
      errors.push({ path: file.path, message: "Import identifier starts with a digit (invalid JS)" });
    }

    // ── Duplicate const declarations ─────────────────────────────────────────
    const constDeclarations = new Map<string, number>();
    for (const m of c.matchAll(/\bconst\s+(\w+)\s*=/g)) {
      const v = m[1];
      constDeclarations.set(v, (constDeclarations.get(v) ?? 0) + 1);
    }
    for (const [v, count] of constDeclarations) {
      if (count > 1) {
        errors.push({ path: file.path, message: `Duplicate const declaration: '${v}' declared ${count}x` });
      }
    }

    // ── Banned imports ───────────────────────────────────────────────────────
    for (const lib of ["react-responsive", "react-router-dom", "axios", "preact", "preact/hooks"]) {
      if (c.includes(`from '${lib}'`) || c.includes(`from "${lib}"`)) {
        errors.push({ path: file.path, message: `Banned import: ${lib}` });
      }
    }

    // ── JSX tag balance ──────────────────────────────────────────────────────
    const openTags  = (c.match(/<(?:motion\.\w+|div|section|main|nav|header|footer|ul|ol|li|span|p|h[1-6]|form|article|aside)[\s>]/g) ?? []).length;
    const closeTags = (c.match(/<\/(?:motion\.\w+|div|section|main|nav|header|footer|ul|ol|li|span|p|h[1-6]|form|article|aside)>/g) ?? []).length;
    if (Math.abs(openTags - closeTags) > 2) {
      errors.push({ path: file.path, message: `JSX tag imbalance: ${openTags} open, ${closeTags} close` });
    }

    // ── Brace balance ────────────────────────────────────────────────────────
    const open  = (c.match(/\{/g) ?? []).length;
    const close = (c.match(/\}/g) ?? []).length;
    if (Math.abs(open - close) > 2) {
      errors.push({ path: file.path, message: `Unbalanced braces: ${open} open, ${close} close` });
    }

    // ── Variable parameter shadowing ─────────────────────────────────────────
    if (/\((\w+)\)[^)]*=>\s*\{[^}]*\bconst\s+\1\b/.test(c)) {
      errors.push({ path: file.path, message: "Variable shadows its own parameter name" });
    }

    // ── NEW: Proxy arrow corruption ──────────────────────────────────────────
    // The NVIDIA gateway sometimes mangles "=>" into "= />" or "= / >"
    if (/=\s*\/\s*>/.test(c)) {
      errors.push({ path: file.path, message: "Proxy-corrupted arrow operator: '= />' found (should be '=>')" });
    }

    // ── NEW: Redacted placeholder tokens ────────────────────────────────────
    if (/<REDACTED_EMAIL>|\[REDACTED(?:_EMAIL)?\]/.test(c)) {
      errors.push({ path: file.path, message: "Proxy redaction token found: <REDACTED_EMAIL> or [REDACTED]" });
    }

    // ── NEW: TypeScript annotations leaking into .jsx files ─────────────────
    // Only check .jsx — .js data/hook files are fine, .ts/.tsx are correct
    if (file.path.endsWith(".jsx")) {
      if (/:\s*React\.(FC|ReactNode|ReactElement|ComponentType|CSSProperties)/.test(c)) {
        errors.push({ path: file.path, message: "TypeScript annotation leaked into .jsx file (React.FC / React.ReactNode etc.)" });
      }
      if (/\buseState<[A-Za-z]/.test(c) || /\buseRef<[A-Za-z]/.test(c)) {
        errors.push({ path: file.path, message: "TypeScript generic leaked into .jsx file (useState<T> / useRef<T>)" });
      }
      if (/\binterface\s+\w+\s*\{/.test(c)) {
        errors.push({ path: file.path, message: "TypeScript interface declaration in .jsx file" });
      }
    }

    // ── NEW: Truncation detection ────────────────────────────────────────────
    // Severely unbalanced parens indicate a file cut mid-expression
    const openParens  = (c.match(/\(/g) ?? []).length;
    const closeParens = (c.match(/\)/g) ?? []).length;
    if (openParens - closeParens > 4) {
      errors.push({ path: file.path, message: `Likely truncated output: ${openParens - closeParens} unclosed parentheses` });
    }
    if (open - close > 5) {
      errors.push({ path: file.path, message: `Likely truncated output: ${open - close} unclosed braces` });
    }

    // ── NEW: LLM prose after export default ─────────────────────────────────
    const PROSE_AFTER_EXPORT = [
      /export\s+default\s+\w+\s*;\s*\n+\s*I\s+(have|added|removed)/i,
      /export\s+default\s+\w+\s*;\s*\n+\s*Note\s+that/i,
      /export\s+default\s+\w+\s*;\s*\n+\s*Here('s| is)/i,
      /export\s+default\s+\w+\s*;\s*\n+\s*This\s+(component|file)/i,
    ];
    if (PROSE_AFTER_EXPORT.some((p) => p.test(c))) {
      errors.push({ path: file.path, message: "LLM prose block detected after export default statement" });
    }
  }

  // ── NEW: CSS-specific checks ─────────────────────────────────────────────
  for (const file of files) {
    if (!file.path.endsWith(".css")) continue;
    const c = file.content;
    if (!c) continue;

    // url(none)') — the specific corruption pattern from auto-fix leaving stray quotes
   if (/url\([^)]*\)['"]\s*[;,\s]/.test(c)) {
      errors.push({ path: file.path, message: "Malformed CSS url() expression with trailing quote/paren" });
    }
    // Unclosed data URL
    if (/url\(\s*['"]?data:[^'")]*$/.test(c)) {
      errors.push({ path: file.path, message: "Truncated CSS data URL in url() expression" });
    }
  }

  return errors;
}


