// src/lib/ai/sanitize/auto-fix.ts
// v18.0 — Minimal safe non-destructive cleaning.
//
// Only performs:
//   - Duplicate import removal
//   - Fix "= />" proxy artifact → "=>"
//   - Ensure React import if JSX present
//   - Ensure export default in .jsx files
//   - Trim trailing whitespace
//   - Ensure final newline

export interface StreamFile {
  path: string;
  content: string;
}

/**
 * Apply safe, non-destructive fixes to all files.
 */
export function autoFixFiles(files: StreamFile[]): StreamFile[] {
  return files.map((file) => {
    // Only process JavaScript/JSX files
    if (!file.path.endsWith(".jsx") && !file.path.endsWith(".js")) {
      return file;
    }

    let content = file.content;

    // 1. Remove duplicate import lines (exact matches)
    const seenImports = new Set<string>();
    const lines = content.split("\n");
    const dedupedLines: string[] = [];
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith("import ")) {
        if (seenImports.has(trimmed)) continue;
        seenImports.add(trimmed);
      }
      dedupedLines.push(line);
    }
    content = dedupedLines.join("\n");

    // 2. Fix broken arrow function artifact "= />" → "=>"
    content = content.replace(/=\s*\/\s*>/g, "=>");

    // 3. Ensure React import if JSX is used
    const hasJSX = /<[A-Za-z]/.test(content);
    const hasReactImport = /\bimport\s+React\b/.test(content);
    if (hasJSX && !hasReactImport) {
      content = `import React from 'react';\n${content}`;
    }

    // 4. Ensure export default in .jsx files
    if (file.path.endsWith(".jsx") && !/\bexport\s+default\b/.test(content)) {
      const componentName = extractComponentName(content, file.path);
      if (componentName) {
        content = content.trimEnd() + `\n\nexport default ${componentName};\n`;
      }
    }

    // 5. Trim trailing whitespace per line
    content = content
      .split("\n")
      .map((line) => line.trimEnd())
      .join("\n");

    // 6. Ensure single trailing newline
    content = content.trimEnd() + "\n";

    return { ...file, content };
  });
}

/**
 * Try to extract the component name from content or fallback to path.
 */
function extractComponentName(content: string, path: string): string | null {
  // Look for function ComponentName() or const ComponentName = () =>
  const match = content.match(
    /(?:export\s+)?(?:function|const)\s+([A-Z][a-zA-Z0-9_]*)/,
  );
  if (match) return match[1];

  // Fallback to filename without extension
  const base = path.split("/").pop() ?? "";
  const name = base.replace(/\.[^.]+$/, "");
  if (/^[A-Z]/.test(name)) return name;

  return null;
}