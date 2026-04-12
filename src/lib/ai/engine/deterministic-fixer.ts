
// src/lib/ai/engine/deterministic-fixer.ts
// Stage 3: Deterministic fixer — pure mechanical corrections. NO LLM.

export interface StreamFile {
  path: string;
  content: string;
}

/**
 * Resolve a relative import path from a directory.
 */
function resolveRelative(dir: string, rel: string): string {
  const parts = (dir ? `${dir}/${rel}` : rel).split("/");
  const out: string[] = [];
  for (const p of parts) {
    if (p === "..") out.pop();
    else if (p !== ".") out.push(p);
  }
  return out.join("/");
}

/**
 * Extract component name from file path.
 */
function componentName(path: string): string {
  const base = path.split("/").pop() ?? "";
  return base.replace(/\.[^.]+$/, "");
}

/**
 * Apply deterministic fixes to all files.
 */
export function deterministicFix(files: StreamFile[]): StreamFile[] {
  const pathSet = new Set(files.map((f) => f.path));

  return files.map((file) => {
    // Only process JS/JSX files
    if (!file.path.endsWith(".jsx") && !file.path.endsWith(".js")) {
      return file;
    }

    let content = file.content;

    // ─── 1. Fix import paths — add .jsx extension where missing ─────────────────
    content = content.replace(
      /from\s+(['"])(\.\.?\/[^'"]+)(['"])/g,
      (match, quote1: string, importPath: string, quote2: string) => {
        // Already has an extension
        if (/\.(jsx?|tsx?|js|css|svg|png|json)$/.test(importPath)) {
          return match;
        }
        const withJsx = importPath + ".jsx";
        const dir = file.path.split("/").slice(0, -1).join("/");
        const resolved = resolveRelative(dir, withJsx);
        if (pathSet.has(resolved)) {
          return `from ${quote1}${importPath}.jsx${quote2}`;
        }
        // Keep as is if file not found
        return match;
      }
    );

    // ─── 2. Ensure React import ─────────────────────────────────────────────────
    if (/<[A-Za-z]/.test(content) && !/\bimport\s+React\b/.test(content)) {
      content = `import React from 'react';\n${content}`;
    }

    // ─── 3. Ensure export default ───────────────────────────────────────────────
    if (file.path.endsWith(".jsx") && !/\bexport\s+default\b/.test(content)) {
      const fnMatch = content.match(/^(?:function|const)\s+([A-Z][a-zA-Z0-9_]*)/m);
      if (fnMatch) {
        content = content.trimEnd() + `\n\nexport default ${fnMatch[1]};\n`;
      } else {
        const name = componentName(file.path);
        content += `\n\nexport default function ${name}() {\n  return <div>${name}</div>;\n}\n`;
      }
    }

    // ─── 4. Fix useEffect missing dependency arrays ────────────────────────────
    content = content.replace(
      /(\buseEffect\s*\(\s*(?:async\s*)?\(\s*\)\s*=>|useEffect\s*\(\s*function\s*\(\s*\))(\s*\{(?:[^{}]|\{[^{}]*\})*\})\s*\)(\s*;?)/g,
      (full) => {
        if (/,\s*\[/.test(full)) return full; // already has dep array
        return full.replace(/\}\s*\)(\s*;?)$/, `}, [])$1`);
      }
    );

    // ─── 5. Deduplicate imports ────────────────────────────────────────────────
    const seen = new Set<string>();
    content = content
      .split("\n")
      .filter((line) => {
        const trimmed = line.trim();
        if (!trimmed.startsWith("import ")) return true;
        if (seen.has(trimmed)) return false;
        seen.add(trimmed);
        return true;
      })
      .join("\n");

    // ─── 6. Balance JSX tags (heuristic) ───────────────────────────────────────
    const openCount = (content.match(/<[A-Z][a-zA-Z0-9]*[\s>]/g) ?? []).length;
    const closeCount = (content.match(/<\/[A-Z][a-zA-Z0-9]*>/g) ?? []).length;
    const selfCount = (content.match(/<[A-Z][a-zA-Z0-9]*[^>]*\/>/g) ?? []).length;
    const delta = openCount - closeCount - selfCount;

    if (Math.abs(delta) > 3) {
      // Wrap the return JSX in a fragment
      content = content.replace(
        /(\breturn\s*\(\s*)([\s\S]*?)(\s*\)\s*;)/,
        (_m, pre, jsx, post) => `${pre}<>${jsx}</>${post}`
      );
    }

    // ─── 7. Fix broken arrow function proxy artifact ───────────────────────────
    content = content.replace(/(\)|\])\s*=\s*\/\s*>/g, "$1 =>");
    content = content.replace(/(?<![=!<>])=\s*\/\s*>/g, "=>");

    return { ...file, content };
  });
}