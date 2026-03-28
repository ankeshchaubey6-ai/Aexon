export type AIFile = {
  path: string;
  content: string;
};

export function mergeFiles(baseFiles: AIFile[], aiFiles: AIFile[]): AIFile[] {
  const fileMap = new Map<string, string>();

  // STEP 1: Load base template
  for (const file of baseFiles) {
    fileMap.set(file.path, file.content);
  }

  // STEP 2: Overlay AI files
  for (const file of aiFiles) {
    if (file.path === "package.json") {
      // Smart merge: keep base deps, add AI extra deps
      try {
        const basePkg = JSON.parse(fileMap.get("package.json") || "{}");
        const aiPkg = JSON.parse(file.content);

        const merged = {
          ...basePkg,
          ...aiPkg,
          // Always preserve name/version/type from base
          name: basePkg.name,
          version: basePkg.version,
          type: basePkg.type,
          // Merge scripts (base wins for dev/build)
          scripts: { ...aiPkg.scripts, ...basePkg.scripts },
          // AI deps extend base deps
          dependencies: { ...basePkg.dependencies, ...aiPkg.dependencies },
          devDependencies: { ...basePkg.devDependencies, ...aiPkg.devDependencies },
        };

        fileMap.set("package.json", JSON.stringify(merged, null, 2));
      } catch (err) {
        console.warn("⚠️ package.json merge failed, using base version");
        // Keep base package.json — safer than broken AI version
      }
      continue;
    }

    // For all other files: AI wins
    fileMap.set(file.path, file.content);
  }

  const result = Array.from(fileMap.entries()).map(([path, content]) => ({
    path,
    content,
  }));

  console.log(
    `🔀 Merged: ${baseFiles.length} base + ${aiFiles.length} AI = ${result.length} total files`
  );

  return result;
}