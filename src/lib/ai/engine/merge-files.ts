// src/lib/ai/merge/merge-files.ts
// v18.0 — Minimal safe merge of base and AI-generated files.
// No validation, no fallback generation, no React checks.

export interface StreamFile {
  path: string;
  content: string;
}

export function mergeFiles(baseFiles: StreamFile[], aiFiles: StreamFile[]): StreamFile[] {
  const fileMap = new Map<string, StreamFile>();

  // Start with base files
  for (const file of baseFiles) {
    fileMap.set(file.path, { ...file });
  }

  // Merge AI files
  for (const aiFile of aiFiles) {
    if (aiFile.path === "package.json") {
      const baseFile = fileMap.get("package.json");
      try {
        const basePkg = baseFile ? JSON.parse(baseFile.content) : {};
        const aiPkg = JSON.parse(aiFile.content);

        const merged = {
          ...basePkg,
          ...aiPkg,
          name: basePkg.name ?? aiPkg.name,
          version: basePkg.version ?? aiPkg.version,
          type: basePkg.type ?? aiPkg.type,
          scripts: { ...basePkg.scripts, ...aiPkg.scripts },
          dependencies: { ...basePkg.dependencies, ...aiPkg.dependencies },
          devDependencies: { ...basePkg.devDependencies, ...aiPkg.devDependencies },
        };

        fileMap.set("package.json", {
          path: "package.json",
          content: JSON.stringify(merged, null, 2),
        });
      } catch {
        // If parsing fails, keep the base package.json (if exists) unchanged
      }
      continue;
    }

    // For all other files, simply overwrite base with AI version
    fileMap.set(aiFile.path, { ...aiFile });
  }

  // Final cleanup: remove empty files and trim content
  const result: StreamFile[] = [];
  for (const file of fileMap.values()) {
    const trimmed = file.content?.trim();
    if (!trimmed) continue;
    result.push({
      path: file.path,
      content: trimmed + "\n",
    });
  }

  return result;
}