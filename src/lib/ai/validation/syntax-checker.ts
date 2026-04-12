// src/lib/ai/validation/syntax-checker.ts
// v18.0 — Pure syntax checker. No semantics, no imports, no hooks, no React.

import type { StreamFile } from "@/lib/ai/stream/stream-pipeline";

export interface SyntaxError {
  path: string;
  message: string;
}

export function checkSyntax(files: StreamFile[]): SyntaxError[] {
  const errors: SyntaxError[] = [];

  for (const file of files) {
    const content = file.content;

    // 1. Empty / too short file
    if (!content || content.trim().length < 10) {
      errors.push({ path: file.path, message: "File empty or too short" });
      continue;
    }

    // Only apply further checks to JS/JSX files
    if (!file.path.endsWith(".jsx") && !file.path.endsWith(".js") && !file.path.endsWith(".tsx") && !file.path.endsWith(".ts")) {
      continue;
    }

    // 2. Multiple export default
    const exportCount = (content.match(/\bexport\s+default\b/g) ?? []).length;
    if (exportCount > 1) {
      errors.push({ path: file.path, message: "Multiple export default statements" });
    }

    // 3. Broken arrow artifact
    if (/=\s*\/\s*>/.test(content)) {
      errors.push({ path: file.path, message: "Corrupted arrow => operator" });
    }

    // 4. Unbalanced braces
    const openBraces = (content.match(/\{/g) ?? []).length;
    const closeBraces = (content.match(/\}/g) ?? []).length;
    if (Math.abs(openBraces - closeBraces) > 2) {
      errors.push({ path: file.path, message: "Unbalanced braces" });
    }

    // 5. Unbalanced parentheses
    const openParens = (content.match(/\(/g) ?? []).length;
    const closeParens = (content.match(/\)/g) ?? []).length;
    if (Math.abs(openParens - closeParens) > 2) {
      errors.push({ path: file.path, message: "Unbalanced parentheses" });
    }

    // 6. Basic JSX tag imbalance
    const openTags = (content.match(/<[A-Za-z][^>]*?>/g) ?? []).filter(t => !t.startsWith("</") && !t.endsWith("/>")).length;
    const closeTags = (content.match(/<\/[A-Za-z][^>]*?>/g) ?? []).length;
    if (Math.abs(openTags - closeTags) > 3) {
      errors.push({ path: file.path, message: "JSX tag imbalance" });
    }

    // 7. Redacted / corrupted token
    if (/<REDACTED/.test(content)) {
      errors.push({ path: file.path, message: "Redacted token detected" });
    }

    // 8. Truncated file (too many open parens)
    if (openParens - closeParens > 4) {
      errors.push({ path: file.path, message: "Likely truncated file" });
    }
  }

  return errors;
}