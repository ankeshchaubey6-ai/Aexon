//==================== FILE: src/lib/ai/validation/syntax-checker.ts ====================

import type { StreamFile } from "@/lib/ai/stream/stream-pipeline";

export interface SyntaxError {
  path: string;
  message: string;
}

export function checkSyntax(files: StreamFile[]): SyntaxError[] {
  const errors: SyntaxError[] = [];

  for (const file of files) {
    const c = file.content;

    if (!c || c.length < 20) {
      errors.push({ path: file.path, message: "File content empty or too short" });
      continue;
    }

    // ───────────────────────── JS / JSX CHECKS ─────────────────────────

    if (file.path.endsWith(".jsx") || file.path.endsWith(".js")) {

      // React import
      const hasReactImport = c.includes("from 'react'") || c.includes('from "react"');
      if (file.path.endsWith(".jsx") && !hasReactImport) {
        errors.push({ path: file.path, message: "Missing React import" });
      }

      // export default
      if (file.path.endsWith(".jsx")) {
        const count = (c.match(/\bexport\s+default\b/g) ?? []).length;
        if (count === 0) {
          errors.push({ path: file.path, message: "Missing export default" });
        }
        if (count > 1) {
          errors.push({ path: file.path, message: "Multiple export default" });
        }
      }

      // duplicate const
      const constMap = new Map<string, number>();
      for (const m of c.matchAll(/\bconst\s+(\w+)\s*=/g)) {
        constMap.set(m[1], (constMap.get(m[1]) ?? 0) + 1);
      }
      for (const [v, count] of constMap) {
        if (count > 1) {
          errors.push({ path: file.path, message: `Duplicate const: ${v}` });
        }
      }

      // JSX balance
      const openTags = (c.match(/<([a-zA-Z]+)/g) ?? []).length;
      const closeTags = (c.match(/<\/([a-zA-Z]+)/g) ?? []).length;
      if (Math.abs(openTags - closeTags) > 2) {
        errors.push({ path: file.path, message: "JSX tag imbalance" });
      }

      // braces
      const open = (c.match(/\{/g) ?? []).length;
      const close = (c.match(/\}/g) ?? []).length;
      if (Math.abs(open - close) > 2) {
        errors.push({ path: file.path, message: "Unbalanced braces" });
      }

      // ───────────────────────── NEW: HOOK VALIDATION ─────────────────────────

      if (/useMemo\s*\(\s*\(,/.test(c)) {
        errors.push({ path: file.path, message: "Invalid useMemo syntax" });
      }

      if (/useCallback\s*\(\s*\([^)]*,\s*\[\s*\]\s*\)\s*\)/.test(c)) {
        errors.push({ path: file.path, message: "Invalid useCallback syntax" });
      }

      if (/useMemo\s*\(\s*\(\)\s*=>[^)]*\)(?!\s*,\s*\[)/.test(c)) {
        errors.push({ path: file.path, message: "useMemo missing dependency array" });
      }

      if (/useEffect\s*\(\s*\(\)\s*=>[^)]*\)(?!\s*,\s*\[)/.test(c)) {
        errors.push({ path: file.path, message: "useEffect missing dependency array" });
      }

      // ───────────────────────── NEW: HOOK IMPORT CHECK ───────────────────────

      const hooks = ["useState", "useEffect", "useMemo", "useCallback"];

      for (const hook of hooks) {
        if (new RegExp(`\\b${hook}\\s*\\(`).test(c) && !c.includes(hook)) {
          errors.push({
            path: file.path,
            message: `Hook used but not imported: ${hook}`,
          });
        }
      }

      // ───────────────────────── NEW: INVALID JSX LOGIC ───────────────────────

      if (/\{\s*if\s*\(/.test(c)) {
        errors.push({
          path: file.path,
          message: "Invalid if inside JSX",
        });
      }

      // ───────────────────────── NEW: COMPONENT IMPORT CHECK ──────────────────

      const componentUsage = c.match(/<([A-Z][A-Za-z0-9]*)/g) || [];
      for (const comp of componentUsage) {
        const name = comp.replace("<", "");
        if (!c.includes(`import ${name}`)) {
          errors.push({
            path: file.path,
            message: `Component used but not imported: ${name}`,
          });
        }
      }

      // ───────────────────────── CORRUPTION CHECKS ───────────────────────────

      if (/=\s*\/\s*>/.test(c)) {
        errors.push({ path: file.path, message: "Corrupted arrow => operator" });
      }

      if (/<REDACTED/.test(c)) {
        errors.push({ path: file.path, message: "Redacted token detected" });
      }

      // truncation
      const openParens = (c.match(/\(/g) ?? []).length;
      const closeParens = (c.match(/\)/g) ?? []).length;

      if (openParens - closeParens > 4) {
        errors.push({ path: file.path, message: "Likely truncated file" });
      }
    }

    // ───────────────────────── CSS CHECKS ─────────────────────────

    if (file.path.endsWith(".css")) {
      if (/url\([^)]*\)['"]/.test(c)) {
        errors.push({ path: file.path, message: "Malformed CSS url()" });
      }

      if (/data:image/.test(c) && !c.includes(")")) {
        errors.push({ path: file.path, message: "Broken data URL" });
      }
    }
  }

  return errors;
}