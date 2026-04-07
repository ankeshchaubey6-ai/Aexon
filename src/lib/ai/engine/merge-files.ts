import { AIFile } from "@/lib/ai/types/ai-project.types";
export function mergeFiles(baseFiles: AIFile[], aiFiles: AIFile[]): AIFile[] {
  const map = new Map<string, AIFile>();

  // Load base
  for (const f of baseFiles) {
    map.set(f.path, { ...f });
  }

  for (const ai of aiFiles) {
    if (ai.path === "package.json") {
      try {
        const basePkg = JSON.parse(map.get("package.json")?.content || "{}");
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

        map.set("package.json", {
          path: "package.json",
          content: JSON.stringify(merged, null, 2),
        });
      } catch {
        console.warn("⚠️ package.json merge failed");
      }
      continue;
    }

    const existing = map.get(ai.path);

    // ✅ SMART MERGE (not overwrite)
    if (existing && existing.content !== ai.content) {
      map.set(ai.path, {
        path: ai.path,
        content: ai.content, // AI wins but tracked
      });
    } else {
      map.set(ai.path, ai);
    }
  }

  return Array.from(map.values());
}