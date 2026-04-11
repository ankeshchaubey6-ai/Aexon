import { AIFile } from "@/lib/ai/types/ai-project.types";

const CRITICAL_FILES = new Set(["src/main.jsx", "src/App.jsx", "package.json"]);

function isCorrupted(content: string, path?: string): boolean {
  if (!content || !content.trim()) return true;
  if (/\);\s*=>/.test(content)) return true;
  if (/er-motion['"]/.test(content)) return true;
  if (/<REDACTED/.test(content)) return true;
  if ((content.match(/export\s+default/g) ?? []).length > 1) return true;
  if (path && /\.(js|jsx|ts|tsx)$/.test(path) && content.trim().length < 20) return true;
  return false;
}

function isJSX(path: string): boolean {
  return /\.(js|jsx|ts|tsx)$/.test(path);
}

function componentNameFromPath(filePath: string): string {
  const base = filePath.split("/").pop() ?? "Component";
  const name = base.replace(/\.[^.]+$/, "").replace(/[^a-zA-Z0-9_$]/g, "_");
  return /^[A-Z]/.test(name) ? name : name.charAt(0).toUpperCase() + name.slice(1);
}

function safeComponent(name: string): string {
  return `import React from 'react';\n\nexport default function ${name}() {\n  return <div>${name}</div>;\n}\n`;
}

function isReactValid(content: string): boolean {
  return /export\s+default/.test(content) && /return\s*\(/.test(content);
}

function ensureReactValid(file: AIFile): AIFile {
  if (!isJSX(file.path)) return file;
  if (isReactValid(file.content)) return file;
  return { path: file.path, content: safeComponent(componentNameFromPath(file.path)) };
}

export function mergeFiles(baseFiles: AIFile[], aiFiles: AIFile[]): AIFile[] {
  const map = new Map<string, AIFile>();

  for (const f of baseFiles) {
    map.set(f.path, { ...f });
  }

  for (const ai of aiFiles) {
    if (ai.path === "package.json") {
      const base = map.get("package.json");
      try {
        const basePkg = JSON.parse(base?.content || "{}");
        const aiPkg = JSON.parse(ai.content);

        const merged = {
          ...basePkg,
          ...aiPkg,
          name: basePkg.name,
          version: basePkg.version,
          type: basePkg.type,
          scripts: { ...aiPkg.scripts, ...basePkg.scripts },
          dependencies: { ...basePkg.dependencies, ...aiPkg.dependencies },
          devDependencies: { ...basePkg.devDependencies, ...aiPkg.devDependencies },
        };

        const mergedContent = JSON.stringify(merged, null, 2);

        if (!isCorrupted(mergedContent, "package.json")) {
          map.set("package.json", { path: "package.json", content: mergedContent });
        }
        // else: keep base package.json untouched
      } catch {
        // keep base package.json untouched
      }
      continue;
    }

    if (isCorrupted(ai.content, ai.path)) {
      const existing = map.get(ai.path);
      if (!existing) {
        const fallback: AIFile = isJSX(ai.path)
          ? { path: ai.path, content: safeComponent(componentNameFromPath(ai.path)) }
          : { path: ai.path, content: "export default {};\n" };
        map.set(ai.path, fallback);
      }
      // existing already in map — keep it untouched
      continue;
    }

    const existing = map.get(ai.path);

    if (existing && CRITICAL_FILES.has(ai.path)) {
      if (existing.content !== ai.content) {
        map.set(ai.path, ensureReactValid({ path: ai.path, content: ai.content }));
      }
      continue;
    }

    map.set(ai.path, ensureReactValid({ path: ai.path, content: ai.content }));
  }

  // ── FINAL OUTPUT GUARANTEE ──────────────────────────────────────────────

  // 1. Remove empty files
  for (const [key, file] of map.entries()) {
    if (!file.content || !file.content.trim()) {
      map.delete(key);
    }
  }

  // 2. Ensure all JS/JSX files have export default
  for (const [key, file] of map.entries()) {
    if (isJSX(file.path) && !/export\s+default/.test(file.content)) {
      map.set(key, { path: file.path, content: safeComponent(componentNameFromPath(file.path)) });
    }
  }

  // 3. Protect import graph — ensure every imported local file exists in output
  const outputPaths = new Set(map.keys());
  const localImportPattern = /import\s+[^'"]*from\s+['"](\.{1,2}\/[^'"]+)['"]/g;

  for (const file of map.values()) {
    if (!isJSX(file.path)) continue;

    const dir = file.path.includes("/") ? file.path.slice(0, file.path.lastIndexOf("/")) : "";
    let match: RegExpExecArray | null;

    while ((match = localImportPattern.exec(file.content)) !== null) {
      const raw = match[1];
      const resolved = resolveRelative(dir, raw);

      if (!resolved) continue;

      const candidate = findInOutput(outputPaths, resolved);
      if (!candidate) {
        const ext = /\.\w+$/.test(resolved) ? "" : ".jsx";
        const missingPath = resolved + ext;
        map.set(missingPath, {
          path: missingPath,
          content: safeComponent(componentNameFromPath(missingPath)),
        });
        outputPaths.add(missingPath);
      }
    }
  }

  return Array.from(map.values()).filter((f) => f.content && f.content.trim().length > 0);
}

function resolveRelative(dir: string, importPath: string): string | null {
  const parts = (dir ? dir + "/" + importPath : importPath).split("/");
  const resolved: string[] = [];
  for (const part of parts) {
    if (part === "..") resolved.pop();
    else if (part !== ".") resolved.push(part);
  }
  return resolved.join("/") || null;
}

function findInOutput(paths: Set<string>, resolved: string): string | null {
  if (paths.has(resolved)) return resolved;
  for (const ext of [".jsx", ".tsx", ".js", ".ts"]) {
    if (paths.has(resolved + ext)) return resolved + ext;
  }
  return null;
}