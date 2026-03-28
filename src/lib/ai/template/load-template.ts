import fs from "fs";
import path from "path";

export type AIFile = {
  path: string;
  content: string;
};

export function loadBaseTemplate(): AIFile[] {
  const templateDir = path.join(
    process.cwd(),
    "sandbox-templates",
    "vite-react-base"
  );

  const files: AIFile[] = [];

  function readDir(dir: string, basePath: string) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      const relativePath = path
        .join(basePath, entry.name)
        .replace(/\\/g, "/");

      if (entry.isDirectory()) {
        readDir(fullPath, relativePath);
      } else {
        const content = fs.readFileSync(fullPath, "utf-8");
        files.push({ path: relativePath, content });
      }
    }
  }

  try {
    readDir(templateDir, "");
    console.log(`📦 Loaded ${files.length} base template files`);
  } catch (err) {
    console.error("❌ Failed to load base template:", err);
  }

  return files;
}