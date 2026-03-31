// src/lib/ai/llm/deepseek-generator.ts
//
// Stage 3 — deepseek-v3.2 (NVIDIA catalog)
//

import OpenAI from "openai";
import { AIFileNode } from "../types/ai-project.types";

const client = new OpenAI({
  apiKey: process.env.NVIDIA_API_KEY!,
  baseURL: "https://integrate.api.nvidia.com/v1",
});

export interface FileSpec {
  path: string;
  description: string;
  dependencies?: string[]; // optional — planner sometimes omits it
}

export interface ProjectSpec {
  projectName: string;
  description: string;
  globalContext: string;
  files: FileSpec[];
}

// ─────────────────────────────────────────────
// Generate a single file with deepseek-v3.2
// ─────────────────────────────────────────────

export async function generateOneFile(
  spec: ProjectSpec,
  fileSpec: FileSpec,
  allPaths: string[]
): Promise<AIFileNode> {
  console.log(`  ⚡ [STAGE 3] deepseek-v3.2 — ${fileSpec.path}`);

  // Normalise dependencies — planner sometimes omits the field
  const deps = Array.isArray(fileSpec.dependencies) ? fileSpec.dependencies : [];

  // ── Short-circuit boilerplate — no LLM needed ──────────────
  if (fileSpec.path === "src/main.jsx") {
    return { path: fileSpec.path, content: makeMainJsx(), type: "file" };
  }
  if (fileSpec.path === "vite.config.js") {
    return { path: fileSpec.path, content: makeViteConfig(), type: "file" };
  }
  if (fileSpec.path === "package.json") {
    return { path: fileSpec.path, content: makePackageJson(spec.projectName), type: "file" };
  }
  if (fileSpec.path === "index.html") {
    return { path: fileSpec.path, content: makeIndexHtml(spec.projectName), type: "file" };
  }
  // Tailwind/PostCSS configs — generated locally, no LLM
  if (fileSpec.path === "tailwind.config.js") {
    return { path: fileSpec.path, content: makeTailwindConfig(), type: "file" };
  }
  if (fileSpec.path === "postcss.config.js") {
    return { path: fileSpec.path, content: makePostcssConfig(), type: "file" };
  }

  // ── LLM generation ─────────────────────────────────────────
  const otherComponents = allPaths
    .filter((p) => p !== fileSpec.path && (p.endsWith(".jsx") || p.endsWith(".tsx")))
    .map((p) => `  - ${p}`)
    .join("\n");

  const systemPrompt = `You are a senior React engineer. Write ONLY the raw file content.
No markdown. No backticks. No explanation. Start with the first line of code.

PROJECT: ${spec.projectName}
DESIGN SYSTEM: ${spec.globalContext}

RULES:
- React functional components with hooks only
- No react-router-dom. No external libraries besides react and react-dom.
- Export default at the bottom of every .jsx file
- All imports use relative paths with FULL EXTENSION (e.g. import App from './App.jsx' NOT './App')
- No TypeScript; plain .jsx and .css files only
- Write complete, production-quality code — no placeholders or TODOs
- CSS: include media queries, hover effects, smooth transitions
- Components: use realistic copy, unicode/emoji icons, real content
- Available sibling files you may import from:\n${otherComponents || "  (none yet)"}`;

  const userPrompt = `File to write: ${fileSpec.path}
What it does: ${fileSpec.description}
Imports needed: ${deps.join(", ") || "none"}

Write the complete file now.`;

  try {
    const completion = await client.chat.completions.create({
      model: "deepseek-ai/deepseek-v3.2",
      temperature: 0.2,
      max_tokens: 4000,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    });

    let content = completion.choices[0]?.message?.content || "";

    content = content
      .replace(/^```(?:jsx?|javascript|css|html|json)?\s*/gim, "")
      .replace(/^```\s*$/gim, "")
      .trim();

    // ✅ Fix extensionless imports that Vite can't resolve in WebContainer
    // e.g. import App from './App'  →  import App from './App.jsx'
    content = fixExtensionlessImports(content, allPaths);

    console.log(`  ✅ [STAGE 3] ${fileSpec.path} (${content.length} chars)`);
    return { path: fileSpec.path, content, type: "file" };
  } catch (err) {
    console.error(`  ❌ [STAGE 3] ${fileSpec.path} failed:`, err);
    return { path: fileSpec.path, content: makeFallbackComponent(fileSpec), type: "file" };
  }
}

// ─────────────────────────────────────────────
// Fix extensionless relative imports
// Vite in WebContainer requires explicit .jsx extensions
// ─────────────────────────────────────────────

function fixExtensionlessImports(content: string, allPaths: string[]): string {
  // Build a set of all known jsx paths (without extension) for lookup
  const jsxPaths = new Set(
    allPaths
      .filter((p) => p.endsWith(".jsx"))
      .map((p) => p.replace(/\.jsx$/, ""))
  );

  // Match: import Something from './Something' or '../components/X'
  // Only fix if the path doesn't already have an extension
  return content.replace(
    /from\s+(['"])(\.\.?\/[^'"]+)(['"])/g,
    (match, q1, importPath, q2) => {
      // Already has extension — leave it alone
      if (/\.\w+$/.test(importPath)) return match;

      // Check if a .jsx file exists for this import
      // Strip leading ./ or ../ and compare against known paths
      const normalized = importPath.replace(/^\.\.?\//, "");
      const hasMatch = Array.from(jsxPaths).some((p) =>
        p.endsWith(normalized) || p.endsWith("/" + normalized)
      );

      if (hasMatch) {
        return `from ${q1}${importPath}.jsx${q2}`;
      }

      return match;
    }
  );
}

// ─────────────────────────────────────────────
// Parallel generation entry point
// ─────────────────────────────────────────────

export async function generateFilesInParallel(
  spec: ProjectSpec
): Promise<AIFileNode[]> {
  const allPaths = spec.files.map((f) => f.path);

  console.log(`⚡ [STAGE 3] Generating ${spec.files.length} files in parallel with deepseek-v3.2...`);

  const results = await Promise.all(
    spec.files.map((fileSpec) => generateOneFile(spec, fileSpec, allPaths))
  );

  console.log(`✅ [STAGE 3] All ${results.length} files generated`);
  return results;
}

// ─────────────────────────────────────────────
// Edit helper
// ─────────────────────────────────────────────

export async function rewriteFilesWithDeepseek(
  instructions: string,
  filesToEdit: AIFileNode[]
): Promise<AIFileNode[]> {
  console.log(`✏️ [STAGE 3 EDIT] deepseek-v3.2 rewriting ${filesToEdit.length} file(s)`);

  const results = await Promise.all(
    filesToEdit.map(async (file): Promise<AIFileNode> => {
      try {
        const completion = await client.chat.completions.create({
          model: "deepseek-ai/deepseek-v3.2",
          temperature: 0.2,
          max_tokens: 4000,
          messages: [
            {
              role: "system",
              content: `You are a React engineer. Apply the requested edit to the file.
Return ONLY the complete updated file — no markdown, no backticks, no explanation.
Preserve all unrelated logic. Change only what is needed.`,
            },
            {
              role: "user",
              content: `Edit instruction: "${instructions}"\n\nCurrent file (${file.path}):\n${file.content}`,
            },
          ],
        });

        let content = completion.choices[0]?.message?.content || file.content;
        content = content
          .replace(/^```(?:jsx?|javascript|css)?\s*/gim, "")
          .replace(/^```\s*$/gim, "")
          .trim();

        console.log(`  ✅ [STAGE 3 EDIT] Rewrote ${file.path}`);
        return { ...file, content };
      } catch (err) {
        console.error(`  ❌ [STAGE 3 EDIT] ${file.path} failed:`, err);
        return file;
      }
    })
  );

  return results;
}

// ─────────────────────────────────────────────
// Boilerplate generators (no LLM)
// ─────────────────────────────────────────────

function makePackageJson(projectName: string): string {
  return JSON.stringify(
    {
      name: projectName.toLowerCase().replace(/\s+/g, "-"),
      private: true,
      version: "0.0.0",
      type: "module",
      scripts: { dev: "vite" },
      dependencies: { react: "^18.2.0", "react-dom": "^18.2.0" },
      devDependencies: {
        vite: "^5.0.0",
        "@vitejs/plugin-react": "^4.0.0",
      },
    },
    null,
    2
  );
}

function makeIndexHtml(projectName: string): string {
  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${projectName}</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>`;
}

function makeMainJsx(): string {
  // ✅ FIXED: use ./App.jsx (with extension) so Vite resolves it in WebContainer
  return `import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './App.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);`;
}

function makeViteConfig(): string {
  return `import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
});`;
}

function makeTailwindConfig(): string {
  return `/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx,ts,tsx}"],
  theme: { extend: {} },
  plugins: [],
};`;
}

function makePostcssConfig(): string {
  return `export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};`;
}

function makeFallbackComponent(fileSpec: FileSpec): string {
  if (fileSpec.path.endsWith(".css")) {
    return `.container { max-width: 1200px; margin: 0 auto; padding: 20px; }`;
  }
  const name = fileSpec.path.split("/").pop()?.replace(".jsx", "") || "Component";
  return `import React from 'react';\n\nfunction ${name}() {\n  return (\n    <div className="container">\n      <h2>${name}</h2>\n    </div>\n  );\n}\n\nexport default ${name};`;
}