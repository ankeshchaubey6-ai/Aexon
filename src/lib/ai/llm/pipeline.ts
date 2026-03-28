// src/lib/ai/llm/pipeline.ts
//
// Full multi-model pipeline — 5 stages for generation, 3 stages for editing.
//
//  Stage 1 — kimi-k2-instruct       → JSON project spec (planner)
//  Stage 2 — your code              → split spec into per-file tasks
//  Stage 3 — deepseek-v3.2          → parallel codegen (one call per file)
//  Stage 4 — phi-3.5-mini-instruct  → syntax fix on broken JSX only
//  Stage 5 — your code              → assemble + ensureBoilerplate
//
//  Edit path (only affected files):
//  kimi → identifies which files change
//  deepseek → rewrites them in parallel
//  phi → validates the edited files
//

import OpenAI from "openai";
import { AIFileNode } from "../types/ai-project.types";
import {
  generateFilesInParallel,
  rewriteFilesWithDeepseek,
  type ProjectSpec,
} from "./deepseek-generator";
import { validateFilesWithPhi } from "./phi-fixer";

const client = new OpenAI({
  apiKey: process.env.NVIDIA_API_KEY!,
  baseURL: "https://integrate.api.nvidia.com/v1",
});

// ─────────────────────────────────────────────
// STAGE 1 — PLANNER  (kimi-k2-instruct)
// Small output, pure JSON. kimi excels at structured planning.
// max_tokens: 2000  temp: 0.2
// ─────────────────────────────────────────────

export async function planProject(
  userPrompt: string
): Promise<ProjectSpec | null> {
  console.log("🧠 [STAGE 1] kimi-k2-instruct — planning");

  try {
    const completion = await client.chat.completions.create({
      model: "moonshotai/kimi-k2-instruct",
      temperature: 0.2,
      max_tokens: 2000,
      messages: [
        {
          role: "system",
          content: `You are a React architect. Return ONLY raw JSON — no markdown, no backticks, no explanation. Start with { and end with }.

{
  "projectName": "PascalCase no spaces",
  "description": "one sentence",
  "globalContext": "2-3 sentences: shared design system, color palette, font, spacing used across all files",
  "files": [
    {
      "path": "src/components/Header.jsx",
      "description": "sticky nav with logo, links, CTA button — glassmorphism style",
      "dependencies": []
    }
  ]
}

Rules:
- Always include: src/App.jsx, src/App.css, src/main.jsx, index.html, package.json, vite.config.js
- One component per file; break every visual section into its own component
- No react-router-dom; no libraries besides react and react-dom
- For a landing page: 8–15 component files. For a large site: up to 30 files
- Each description must be specific enough to code from on its own
- List ALL files you want generated`,
        },
        {
          role: "user",
          content: userPrompt,
        },
      ],
    });

    let text = completion.choices[0]?.message?.content || "";
    text = text.replace(/```json/gi, "").replace(/```/g, "").trim();

    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");

    if (start === -1 || end === -1) {
      console.error("❌ [STAGE 1] No JSON object found in planner response");
      return null;
    }

    try {
      const spec = JSON.parse(text.slice(start, end + 1)) as ProjectSpec;
      console.log(
        `✅ [STAGE 1] Plan: ${spec.files.length} files — ${spec.files.map((f) => f.path).join(", ")}`
      );
      return spec;
    } catch {
      // Attempt trailing-comma repair
      const fixed = text
        .slice(start, end + 1)
        .replace(/,(\s*[}\]])/g, "$1");
      const spec = JSON.parse(fixed) as ProjectSpec;
      console.log(`✅ [STAGE 1] Plan recovered: ${spec.files.length} files`);
      return spec;
    }
  } catch (err) {
    console.error("❌ [STAGE 1] Planner failed:", err);
    return null;
  }
}

// ─────────────────────────────────────────────
// STAGE 2 — COMPONENT SPLITTER  (your code)
// Splits the JSON spec into per-file task descriptors.
// No API call. Validates the spec and normalises paths.
// ─────────────────────────────────────────────

function splitPlanIntoTasks(spec: ProjectSpec): ProjectSpec {
  console.log(`📦 [STAGE 2] Splitting ${spec.files.length} file tasks`);

  const normalised: ProjectSpec = {
    ...spec,
    files: spec.files.map((f) => ({
      path: f.path.replace(/^\/+/, ""), // strip leading slashes
      description: f.description || `${f.path} component`,
      dependencies: Array.isArray(f.dependencies) ? f.dependencies : [],
    })),
  };

  console.log(
    `✅ [STAGE 2] Tasks ready: ${normalised.files.map((f) => f.path).join(", ")}`
  );
  return normalised;
}

// ─────────────────────────────────────────────
// STAGE 5 — ASSEMBLER  (your code)
// Merges generated files, writes package.json, vite.config,
// index.html, auto-builds App.jsx if missing, and — crucially —
// scans every JSX file for local CSS imports and stubs any that
// don't exist yet (prevents Vite "does the file exist?" crashes).
// ─────────────────────────────────────────────

/**
 * Parse all `import "./Foo.css"` and `import "../bar.css"` statements
 * from a JSX file and resolve them to project-relative paths.
 *
 * e.g. file at "src/components/Header.jsx" importing "./Header.css"
 *      → "src/components/Header.css"
 */
function extractLocalCssImports(file: AIFileNode): string[] {
  // Match: import "./Something.css"  or  import '../Something.css'
  const importRegex = /import\s+['"](\.[^'"]+\.css)['"]/g;
  const dir = file.path.split("/").slice(0, -1).join("/");
  const resolved: string[] = [];

  let match: RegExpExecArray | null;
  while ((match = importRegex.exec(file.content)) !== null) {
    const rel = match[1]; // e.g. "./Header.css"

    // Resolve relative to the file's directory
    const segments = `${dir}/${rel}`.split("/");
    const normalised: string[] = [];
    for (const seg of segments) {
      if (seg === "..") normalised.pop();
      else if (seg !== ".") normalised.push(seg);
    }
    resolved.push(normalised.join("/"));
  }
  return resolved;
}

/**
 * Generate a minimal stub CSS for a component based on its name.
 * Produces a scoped class reset + a couple of sensible defaults so
 * the component renders without layout breakage.
 */
function stubCss(cssPath: string): string {
  // Derive a BEM-style root class from the filename, e.g. "header"
  const name = cssPath
    .split("/")
    .pop()!
    .replace(".css", "")
    .toLowerCase();

  return `/* ${cssPath} — auto-generated stub */
.${name} {
  box-sizing: border-box;
}

.${name} * {
  box-sizing: border-box;
}
`;
}

function ensureBoilerplate(
  files: AIFileNode[],
  projectName: string
): AIFileNode[] {
  const map = new Map(files.map((f) => [f.path, f]));

  const ensure = (path: string, content: string) => {
    if (!map.has(path)) {
      map.set(path, { path, content, type: "file" });
      console.log(`➕ [STAGE 5] Ensured: ${path}`);
    }
  };

  ensure("package.json", makePackageJson(projectName));
  ensure("index.html", makeIndexHtml(projectName));
  ensure("src/main.jsx", makeMainJsx());
  ensure("vite.config.js", makeViteConfig());

  // Auto-build App.jsx from available components if missing
  if (!map.has("src/App.jsx")) {
    const components = Array.from(map.keys())
      .filter(
        (p) => p.startsWith("src/components/") && p.endsWith(".jsx")
      )
      .map((p) => ({
        name: p.split("/").pop()!.replace(".jsx", ""),
        importPath: "./" + p.replace("src/", "").replace(".jsx", ""),
      }));

    const imports = components
      .map((c) => `import ${c.name} from '${c.importPath}';`)
      .join("\n");
    const renders = components
      .map((c) => `      <${c.name} />`)
      .join("\n");

    map.set("src/App.jsx", {
      path: "src/App.jsx",
      content: `import React from 'react';\nimport './App.css';\n${imports}\n\nfunction App() {\n  return (\n    <div className="app">\n${renders}\n    </div>\n  );\n}\n\nexport default App;`,
      type: "file",
    });
    console.log("➕ [STAGE 5] Auto-built src/App.jsx");
  }

  if (!map.has("src/App.css")) {
    map.set("src/App.css", {
      path: "src/App.css",
      content: `* { margin: 0; padding: 0; box-sizing: border-box; }\nbody { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }\n.app { min-height: 100vh; }`,
      type: "file",
    });
  }

  // ── CSS stub pass ─────────────────────────────────────────────────────
  // deepseek freely writes  import "./Header.css"  inside components but
  // the planner never lists those CSS files in the spec, so they're never
  // generated → Vite crashes with "does the file exist?".
  //
  // Solution: scan every JSX file, resolve every local .css import, and
  // create a stub for any path that isn't already in the map.
  // Zero extra API calls — pure string processing.
  const jsxFiles = Array.from(map.values()).filter((f) =>
    f.path.endsWith(".jsx")
  );

  let stubbedCount = 0;
  for (const jsx of jsxFiles) {
    const cssPaths = extractLocalCssImports(jsx);
    for (const cssPath of cssPaths) {
      if (!map.has(cssPath)) {
        map.set(cssPath, {
          path: cssPath,
          content: stubCss(cssPath),
          type: "file",
        });
        stubbedCount++;
        console.log(`🎨 [STAGE 5] Stubbed missing CSS: ${cssPath}`);
      }
    }
  }

  if (stubbedCount > 0) {
    console.log(`🎨 [STAGE 5] Created ${stubbedCount} CSS stub(s) for missing imports`);
  }
  // ─────────────────────────────────────────────────────────────────────

  const result = Array.from(map.values());
  console.log(`✅ [STAGE 5] Final project: ${result.length} files`);
  return result;
}

// ─────────────────────────────────────────────
// MAIN EXPORT — full 5-stage generation pipeline
// ─────────────────────────────────────────────

export async function generateProjectWithPipeline(
  userPrompt: string
): Promise<AIFileNode[]> {
  console.log("🚀 ═══════════════════════════════");
  console.log("🚀 PIPELINE START — GENERATION");
  console.log("🚀 ═══════════════════════════════");

  // ── Stage 1: Plan ──────────────────────────
  const rawSpec = await planProject(userPrompt);
  if (!rawSpec) {
    console.error("❌ Planning failed — using minimal fallback");
    return minimalFallback(userPrompt);
  }

  // ── Stage 2: Split ─────────────────────────
  const spec = splitPlanIntoTasks(rawSpec);

  // ── Stage 3: Parallel codegen (deepseek) ───
  const generated = await generateFilesInParallel(spec);

  // ── Stage 4: Validate / fix (phi) ──────────
  const validated = await validateFilesWithPhi(generated);

  // ── Stage 5: Assemble ──────────────────────
  const result = ensureBoilerplate(validated, spec.projectName);

  console.log("✅ ═══════════════════════════════");
  console.log(`✅ PIPELINE DONE — ${result.length} files`);
  console.log("✅ ═══════════════════════════════");

  return result;
}

// ─────────────────────────────────────────────
// EDIT PIPELINE — 3-stage edit path
// kimi → identifies which files change
// deepseek → rewrites them in parallel
// phi → validates edited files
// ─────────────────────────────────────────────

export async function editProjectWithPipeline(
  instructions: string,
  existingFiles: AIFileNode[]
): Promise<AIFileNode[]> {
  console.log("✏️ ═══════════════════════════════");
  console.log("✏️ EDIT PIPELINE START");
  console.log("✏️ ═══════════════════════════════");

  const fileMap = new Map(existingFiles.map((f) => [f.path, f]));

  // ── Edit Stage 1: kimi identifies affected files ──
  console.log("🧠 [EDIT 1] kimi-k2-instruct — identifying files to change");

  let pathsToEdit: string[] = [];

  try {
    const fileList = existingFiles.map((f) => `  - ${f.path}`).join("\n");

    const planCompletion = await client.chat.completions.create({
      model: "moonshotai/kimi-k2-instruct",
      temperature: 0.2,
      max_tokens: 400,
      messages: [
        {
          role: "system",
          content: `You are a React architect. Return ONLY a raw JSON array of file paths that need to change.
Example: ["src/App.css", "src/components/Header.jsx"]
No markdown. No explanation. Start with [ and end with ].`,
        },
        {
          role: "user",
          content: `Edit request: "${instructions}"\n\nProject files:\n${fileList}`,
        },
      ],
    });

    let planText = planCompletion.choices[0]?.message?.content || "[]";
    planText = planText
      .replace(/```json/gi, "")
      .replace(/```/g, "")
      .trim();

    const s = planText.indexOf("[");
    const e = planText.lastIndexOf("]");
    if (s !== -1 && e !== -1) {
      pathsToEdit = JSON.parse(planText.slice(s, e + 1)) as string[];
    }

    console.log(`✅ [EDIT 1] kimi identified: ${pathsToEdit.join(", ")}`);
  } catch (err) {
    console.warn("⚠️ [EDIT 1] kimi failed — defaulting to App.jsx + App.css:", err);
    pathsToEdit = existingFiles.some((f) => f.path === "src/App.css")
      ? ["src/App.css", "src/App.jsx"]
      : ["src/App.jsx"];
  }

  if (pathsToEdit.length === 0) {
    console.warn("⚠️ [EDIT 1] Empty file list — defaulting to App.jsx + App.css");
    pathsToEdit = ["src/App.jsx", "src/App.css"];
  }

  // ── Edit Stage 2: deepseek rewrites affected files ──
  const filesToEdit = pathsToEdit
    .map((p) => fileMap.get(p))
    .filter((f): f is AIFileNode => !!f);

  const rewritten = await rewriteFilesWithDeepseek(instructions, filesToEdit);

  // ── Edit Stage 3: phi validates edited files ──
  const validated = await validateFilesWithPhi(rewritten);

  // Merge back into the full file list (unchanged files stay intact)
  validated.forEach((f) => fileMap.set(f.path, f));

  const result = Array.from(fileMap.values());

  console.log("✅ ═══════════════════════════════");
  console.log(`✅ EDIT DONE — ${validated.length} file(s) updated`);
  console.log("✅ ═══════════════════════════════");

  return result;
}

// ─────────────────────────────────────────────
// BOILERPLATE HELPERS
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
  return `import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
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

function minimalFallback(prompt: string): AIFileNode[] {
  const name = JSON.stringify(prompt.slice(0, 40) || "AI App");
  return [
    {
      path: "package.json",
      content: makePackageJson("ai-app"),
      type: "file",
    },
    { path: "index.html", content: makeIndexHtml("AI App"), type: "file" },
    { path: "src/main.jsx", content: makeMainJsx(), type: "file" },
    { path: "vite.config.js", content: makeViteConfig(), type: "file" },
    {
      path: "src/App.jsx",
      content: `import React from 'react';\nimport './App.css';\n\nconst TITLE = ${name};\n\nfunction App() {\n  return <div className="app"><h1>{TITLE}</h1></div>;\n}\n\nexport default App;`,
      type: "file",
    },
    {
      path: "src/App.css",
      content: `.app { text-align: center; padding: 40px; font-family: sans-serif; }`,
      type: "file",
    },
  ];
}