// src/lib/ai/validation/build-simulator.ts
// v18.0 — Lightweight build validator. Checks required files and import resolution.

import type { StreamFile } from "@/lib/ai/stream/stream-pipeline";

export function simulateBuild(files: StreamFile[]): {
  success: boolean;
  logs: string[];
} {
  const logs: string[] = [];

  if (!files.length) {
    return { success: false, logs: ["No files to build"] };
  }

  const fileMap = new Map(files.map(f => [f.path, f.content]));
  const allPaths = new Set(fileMap.keys());

  // 1. Required files check
  const requiredFiles = ["src/App.jsx", "src/main.jsx"];
  const missingRequired = requiredFiles.filter(p => !fileMap.has(p));
  if (missingRequired.length > 0) {
    logs.push(`Missing required files: ${missingRequired.join(", ")}`);
    return { success: false, logs };
  }

  let hasImportErrors = false;

  // 2. Relative import resolution
  for (const file of files) {
    if (!file.path.endsWith(".jsx") && !file.path.endsWith(".js")) continue;

    const importRegex = /import\s+.*?\s+from\s+['"](\.\.?\/[^'"]+)['"]/g;
    let match;
    while ((match = importRegex.exec(file.content)) !== null) {
      const rawImport = match[1];
      const dir = file.path.split("/").slice(0, -1).join("/");
      const resolved = resolveRelativePath(dir, rawImport);

      // Check with possible extensions
      const possiblePaths = [
        resolved,
        `${resolved}.jsx`,
        `${resolved}.js`,
        `${resolved}/index.jsx`,
        `${resolved}/index.js`,
      ];

      const exists = possiblePaths.some(p => allPaths.has(p));
      if (!exists) {
        logs.push(`[${file.path}] Unresolved import: "${rawImport}" (resolved to ${resolved})`);
        hasImportErrors = true;
      }
    }
  }

  // 3. Basic JSX return check (warning only)
  for (const file of files) {
    if (!file.path.endsWith(".jsx")) continue;
    const content = file.content;
    const hasReturn = /return\s*\(?\s*</.test(content) || /return\s+</.test(content);
    if (!hasReturn) {
      logs.push(`[${file.path}] Warning: No JSX return statement found`);
    }
  }

  const success = !hasImportErrors && missingRequired.length === 0;
  if (success) logs.push("Build simulation passed");

  return { success, logs };
}

function resolveRelativePath(dir: string, relativePath: string): string {
  const parts = (dir ? `${dir}/${relativePath}` : relativePath).split("/");
  const resolved: string[] = [];
  for (const part of parts) {
    if (part === "..") resolved.pop();
    else if (part !== ".") resolved.push(part);
  }
  return resolved.join("/");
}