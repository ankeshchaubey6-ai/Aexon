// src/lib/ai/stream/stream-pipeline.ts
//
// UNIFIED GENERATION PIPELINE  v3.4
//
// TIMEOUT STRATEGY — v3.3 used a single 55s wall-clock Promise.race.
// Problem: S1 (kimi) takes 15-25s alone, leaving only 30s for S3+S4+S5+S6.
// Any retry blew the budget and the SSE closed mid-generation.
//
// v3.4 uses PER-STAGE timeouts instead:
//   S1  (plan)     → 35s   (kimi is slow but reliable)
//   S3  (codegen)  → 90s per file, already in deepseek-generator semaphore
//   S4  (phi)      → 45s per file, already in phi-fixer semaphore
//   S6  (autofix)  → sync, no timeout needed
//   Total pipeline → no hard wall-clock. Next.js route timeout handles the
//                    absolute ceiling (set via maxDuration in next.config).
//
// OTHER FIXES:
//  - isClosed flag: once onDone/onError is called, onFile is a no-op.
//    Prevents background S3 retries from writing to a closed SSE stream.
//  - S3 abort signal: when the pipeline errors/times out we broadcast an
//    AbortSignal to all in-flight LLM calls so they stop immediately.
//  - S3 sharedResults race fix preserved from v3.3.
//  - "use client" stripped at every stage.
//

import OpenAI from "openai";
import { autoFixFiles, type AIFile as AutoFixFile } from "@/lib/ai/engine/auto-fix";
import { validateAndFix } from "@/lib/ai/llm/phi-fixer";
import { runSemanticValidation } from "@/lib/ai/validation/semantic-validator";
import type { AIFileNode } from "@/lib/ai/types/ai-project.types";

// ─── Types ────────────────────────────────────────────────────────────────────

export type StreamFile = {
  path: string;
  content: string;
  provisional?: boolean;
};

export interface FileSpec {
  path: string;
  description: string;
  dependencies: string[];
}

export interface ProjectSpec {
  projectName: string;
  description: string;
  globalContext: string;
  files: FileSpec[];
}

// ─── Client ───────────────────────────────────────────────────────────────────

const nvidia = new OpenAI({
  apiKey: process.env.NVIDIA_API_KEY!,
  baseURL: "https://integrate.api.nvidia.com/v1",
});

// ─── Per-stage timeouts (ms) ──────────────────────────────────────────────────
const STAGE1_TIMEOUT_MS  = 35_000;  // kimi planner
const STAGE3_TIMEOUT_MS  = 90_000;  // per-file deepseek (also in deepseek-generator)
const STAGE4_TIMEOUT_MS  = 45_000;  // per-file phi (also in phi-fixer)

// ─── Timeout helper ───────────────────────────────────────────────────────────

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`Timeout:${label}`)), ms)
    ),
  ]);
}

// ─── isClosed guard ───────────────────────────────────────────────────────────
// Wraps the caller's onFile so that after onDone/onError fires, any
// background LLM retries that land can't write to the closed SSE stream.

function makeGuardedCallbacks(
  onFile: (f: StreamFile) => Promise<void>,
  onDone: () => void,
  onError?: (msg: string) => void,
) {
  let closed = false;

  return {
    safeOnFile: async (f: StreamFile) => {
      if (closed) return;
      await onFile(f);
    },
    safeOnDone: () => {
      if (closed) return;
      closed = true;
      onDone();
    },
    safeOnError: (msg: string) => {
      if (closed) return;
      closed = true;
      onError?.(msg);
    },
    isClosed: () => closed,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// STAGE 0 — BOILERPLATE (zero LLM, provisional)
// ═══════════════════════════════════════════════════════════════════════════

const BOILERPLATE_PATHS = new Set([
  "package.json", "index.html", "src/main.jsx",
  "vite.config.js", "tailwind.config.js", "postcss.config.js", "src/index.css",
]);

function bp_packageJson(name: string): string {
  return JSON.stringify({
    name: name.toLowerCase().replace(/[^a-z0-9-]/g, "-") || "ai-app",
    private: true, version: "0.0.0", type: "module",
    scripts: { dev: "vite --host", build: "vite build", preview: "vite preview" },
    dependencies: {
      react: "^18.2.0", "react-dom": "^18.2.0",
      "framer-motion": "^11.0.8", "lucide-react": "^0.363.0",
      clsx: "^2.1.0", "react-hot-toast": "^2.4.1",
    },
    devDependencies: {
      vite: "^5.2.6", "@vitejs/plugin-react": "^4.2.1",
      tailwindcss: "^3.4.3", postcss: "^8.4.38", autoprefixer: "^10.4.19",
    },
  }, null, 2);
}

function bp_indexHtml(name: string): string {
  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${name}</title>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet" />
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>`;
}

const bp_mainJsx = `import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode><App /></React.StrictMode>
);`;

const bp_viteConfig = `import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({ plugins: [react()], server: { host: true } });`;

const bp_tailwindConfig = `/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      fontFamily: { sans: ['Inter', 'system-ui', 'sans-serif'] },
      colors: {
        primary: { DEFAULT: '#6366f1', dark: '#4f46e5', light: '#818cf8' },
        secondary: '#8b5cf6', accent: '#06b6d4',
      },
      animation: {
        'fade-in': 'fadeIn 0.5s ease-out',
        'slide-up': 'slideUp 0.6s ease-out',
        float: 'float 6s ease-in-out infinite',
      },
      keyframes: {
        fadeIn:  { from: { opacity: '0' }, to: { opacity: '1' } },
        slideUp: { from: { opacity: '0', transform: 'translateY(20px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
        float:   { '0%,100%': { transform: 'translateY(0)' }, '50%': { transform: 'translateY(-10px)' } },
      },
    },
  },
  plugins: [],
};`;

const bp_postcssConfig = `export default { plugins: { tailwindcss: {}, autoprefixer: {} } };`;

const bp_indexCss = `@tailwind base;
@tailwind components;
@tailwind utilities;

*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
html { scroll-behavior: smooth; -webkit-font-smoothing: antialiased; }
body { font-family: 'Inter', system-ui, sans-serif; }

:root {
  --primary: #6366f1; --primary-dark: #4f46e5;
  --secondary: #8b5cf6; --accent: #06b6d4;
  --bg: #0f0f13; --bg-card: #1a1a24;
  --text: #f8fafc; --text-muted: #94a3b8;
  --border: rgba(255,255,255,0.08); --radius: 12px;
}`;

function bp_placeholderAppJsx(prompt: string): string {
  const label = prompt.slice(0, 60).replace(/'/g, "\\'");
  return `import React, { useEffect, useState } from 'react';

const dots = ['', '.', '..', '...'];

function App() {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick(t => (t + 1) % 4), 500);
    return () => clearInterval(id);
  }, []);

  return (
    <div style={{
      minHeight: '100vh', background: '#0f0f13',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      gap: '24px', fontFamily: 'Inter, system-ui, sans-serif',
    }}>
      <div style={{
        width: 48, height: 48,
        border: '3px solid #6366f1', borderTopColor: 'transparent',
        borderRadius: '50%', animation: 'spin 0.8s linear infinite',
      }} />
      <style>{'@keyframes spin { to { transform: rotate(360deg); } }'}</style>
      <div style={{ textAlign: 'center' }}>
        <p style={{ color: '#f8fafc', fontSize: '1.1rem', fontWeight: 600, marginBottom: 8 }}>
          Building: ${label}{dots[tick]}
        </p>
        <p style={{ color: '#64748b', fontSize: '0.875rem' }}>
          AI is generating your project — preview loads automatically
        </p>
      </div>
    </div>
  );
}

export default App;`;
}

const bp_appCss = `/* App.css */\n.app { min-height: 100vh; background: var(--bg); }\n`;

function makeBoilerplateFiles(prompt: string): StreamFile[] {
  return [
    { path: "package.json",       content: bp_packageJson("ai-project"),   provisional: true },
    { path: "index.html",         content: bp_indexHtml("AI Project"),      provisional: true },
    { path: "src/main.jsx",       content: bp_mainJsx,                      provisional: true },
    { path: "vite.config.js",     content: bp_viteConfig,                   provisional: true },
    { path: "tailwind.config.js", content: bp_tailwindConfig,               provisional: true },
    { path: "postcss.config.js",  content: bp_postcssConfig,                provisional: true },
    { path: "src/index.css",      content: bp_indexCss,                     provisional: true },
    { path: "src/App.jsx",        content: bp_placeholderAppJsx(prompt),    provisional: true },
    { path: "src/App.css",        content: bp_appCss,                       provisional: true },
  ];
}

// ═══════════════════════════════════════════════════════════════════════════
// STAGE 1 — PLANNER (kimi-k2-instruct)
// ═══════════════════════════════════════════════════════════════════════════

async function stage1_plan(prompt: string): Promise<ProjectSpec | null> {
  console.log("🧠 [S1] kimi-k2-instruct — planning");

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), STAGE1_TIMEOUT_MS);

  try {
    const res = await nvidia.chat.completions.create(
      {
        model: "moonshotai/kimi-k2-instruct",
        temperature: 0.2,
        max_tokens: 2500,
        messages: [
          {
            role: "system",
            content: `You are a React architect. Return ONLY raw JSON — no markdown, no backticks.

{
  "projectName": "PascalCase",
  "description": "one sentence",
  "globalContext": "4-5 sentences: (1) exact hex palette, (2) Inter font weights, (3) visual style, (4) framer-motion approach, (5) spacing rhythm.",
  "files": [
    {
      "path": "src/components/Hero.jsx",
      "description": "Specific visual description with named elements, animations, interactions",
      "dependencies": []
    }
  ]
}

CRITICAL PROP RULE: Components rendered via .map() MUST accept a SINGLE object prop.
Example: TestimonialCard accepts ({ testimonial }) — parent passes <TestimonialCard testimonial={item} key={i} />

RULES:
- Skip: package.json, index.html, src/main.jsx, vite.config.js, tailwind.config.js, postcss.config.js, src/index.css
- Always include: src/App.jsx, src/App.css
- Libraries: framer-motion, lucide-react, tailwindcss, clsx, react-hot-toast
- Landing page: 8-12 files. Dashboard: 12-18. Full app: up to 25
- dependencies[] = sibling .jsx paths this file imports
- Premium dark aesthetic by default
- NO "use client" directives — this is a Vite project, not Next.js`,
          },
          { role: "user", content: prompt },
        ],
      },
      { signal: controller.signal }
    );

    clearTimeout(timeoutId);

    let text = (res.choices[0]?.message?.content ?? "")
      .replace(/```json/gi, "").replace(/```/g, "").trim();

    const s = text.indexOf("{"), e = text.lastIndexOf("}");
    if (s === -1 || e === -1) throw new Error("No JSON in planner response");

    let parsed: ProjectSpec;
    try {
      parsed = JSON.parse(text.slice(s, e + 1)) as ProjectSpec;
    } catch {
      parsed = JSON.parse(text.slice(s, e + 1).replace(/,(\s*[}\]])/g, "$1")) as ProjectSpec;
    }

    parsed.files = parsed.files.map((f) => ({
      path: f.path.replace(/^\/+/, ""),
      description: f.description ?? f.path,
      dependencies: Array.isArray(f.dependencies) ? f.dependencies : [],
    }));

    console.log(`✅ [S1] ${parsed.files.length} files: ${parsed.files.map((f) => f.path).join(", ")}`);
    return parsed;

  } catch (err: any) {
    clearTimeout(timeoutId);
    const isTimeout = err?.name === "AbortError" || err?.message?.startsWith("Timeout:");
    console.error(`❌ [S1] Planner ${isTimeout ? "timed out" : "failed"}:`, err?.message ?? err);
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// STAGE 2 — DEPENDENCY RESOLVER (topological sort)
// ═══════════════════════════════════════════════════════════════════════════

function stage2_resolve(spec: ProjectSpec): FileSpec[] {
  const pathSet = new Set(spec.files.map((f) => f.path));
  const inDegree = new Map<string, number>();
  const graph = new Map<string, string[]>();

  for (const f of spec.files) { inDegree.set(f.path, 0); graph.set(f.path, []); }
  for (const f of spec.files) {
    for (const dep of f.dependencies) {
      if (!pathSet.has(dep)) continue;
      graph.get(dep)!.push(f.path);
      inDegree.set(f.path, (inDegree.get(f.path) ?? 0) + 1);
    }
  }

  const queue = [...inDegree.entries()].filter(([, d]) => d === 0).map(([p]) => p);
  const sorted: string[] = [];
  while (queue.length > 0) {
    const node = queue.shift()!;
    sorted.push(node);
    for (const dep of graph.get(node) ?? []) {
      const d = (inDegree.get(dep) ?? 1) - 1;
      inDegree.set(dep, d);
      if (d === 0) queue.push(dep);
    }
  }

  if (sorted.length !== spec.files.length) {
    console.warn("⚠️ [S2] Cycle detected — using original order");
    return spec.files;
  }

  const fileMap = new Map(spec.files.map((f) => [f.path, f]));
  const result = sorted.map((p) => fileMap.get(p)!);
  console.log(`✅ [S2] ${result.map((f) => f.path).join(" → ")}`);
  return result;
}

// ═══════════════════════════════════════════════════════════════════════════
// STAGE 3 — CODE GENERATOR (deepseek-v3.2)
// ═══════════════════════════════════════════════════════════════════════════

const DESIGN_RULES = `MANDATORY DESIGN:
• Dark: bg-[#0f0f13] page, bg-[#1a1a24]/bg-white/5 cards
• Glass: bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6
• Gradient text: bg-gradient-to-r from-indigo-400 via-purple-400 to-cyan-400 bg-clip-text text-transparent
• Primary btn: bg-gradient-to-r from-indigo-600 to-purple-600 hover:opacity-90 rounded-xl px-6 py-3 font-semibold text-white hover:scale-105
• Ghost btn: border border-white/20 hover:border-white/40 rounded-xl px-6 py-3 text-white/80 hover:text-white
• Sections: py-24 px-6. Grid: grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8
• framer-motion: whileInView={{opacity:1,y:0}} initial={{opacity:0,y:30}} transition={{duration:0.6}} viewport={{once:true}}
• Hover: hover:scale-105 transition-all duration-200`;

const PROP_CONTRACT_RULES = `CRITICAL PROP CONTRACT:
List-item components MUST use a single object prop:
  ✅ function TestimonialCard({ testimonial }) { const { name, role } = testimonial; }
     Parent: <TestimonialCard testimonial={item} key={i} />
Always add: if (!propName) return null; at top of function body.`;

function summarizeFile(f: StreamFile): string {
  const lines = f.content.split("\n");
  const exportLine = lines.find((l) => l.includes("export default"));
  const name = exportLine?.match(/export\s+default\s+(?:function\s+)?(\w+)/)?.[1]
    ?? f.path.split("/").pop()?.replace(".jsx", "") ?? "Component";
  return `  ${f.path} → ${name}`;
}

async function stage3_generateOne(
  spec: ProjectSpec,
  fileSpec: FileSpec,
  allPaths: string[],
  sharedResults: StreamFile[],
  pipelineAbort: AbortController,
  retries = 2
): Promise<StreamFile> {
  // If pipeline already errored/closed, skip immediately
  if (pipelineAbort.signal.aborted) {
    return { path: fileSpec.path, content: makeFallbackComponent(fileSpec) };
  }

  if (fileSpec.path.endsWith(".css") && fileSpec.path !== "src/App.css") {
    return { path: fileSpec.path, content: makeCssStub(fileSpec.path) };
  }

  const jsxSiblings = sharedResults.filter((f) => f.path.endsWith(".jsx") && !f.provisional);
  const siblingCtx = jsxSiblings.length > 0
    ? jsxSiblings.map(summarizeFile).join("\n")
    : "  (you are the first component)";

  const importPaths = allPaths
    .filter((p) => p !== fileSpec.path && p.endsWith(".jsx"))
    .map((p) => `  ${p}`)
    .join("\n");

  const systemPrompt = `=== BLOCK 1: ROLE ===
Senior React engineer. Output ONLY raw file content. No markdown. No backticks.
Start with the first line of code. Do NOT add "use client" directives.

=== BLOCK 2: DESIGN SYSTEM ===
Project: ${spec.projectName} — ${spec.description}
${spec.globalContext}
${DESIGN_RULES}

=== BLOCK 3: LIBRARIES & PROP CONTRACT ===
Available: react@18, framer-motion, lucide-react, clsx, react-hot-toast, tailwindcss
Forbidden: react-router-dom, axios, fetch(), TypeScript, "use client"
• export default at the BOTTOM of every .jsx file
• All relative imports MUST include extension: ./Hero.jsx NOT ./Hero
• Tailwind for ALL styling. Realistic copy.
${PROP_CONTRACT_RULES}

=== BLOCK 4: SIBLING CONTEXT ===
${siblingCtx}

Importable paths:
${importPaths || "  (none)"}

=== BLOCK 5: YOUR FILE ===
Path: ${fileSpec.path}
Purpose: ${fileSpec.description}
Import from: ${fileSpec.dependencies.join(", ") || "none"}

Write the complete file now.`;

  for (let attempt = 0; attempt <= retries; attempt++) {
    // Stop retrying if pipeline was aborted (closed SSE / upstream error)
    if (pipelineAbort.signal.aborted) {
      console.log(`  ⏹ [S3] ${fileSpec.path} — pipeline aborted, skipping`);
      return { path: fileSpec.path, content: makeFallbackComponent(fileSpec) };
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), STAGE3_TIMEOUT_MS);

    // Also abort if the pipeline-level signal fires
    const pipelineListener = () => controller.abort();
    pipelineAbort.signal.addEventListener("abort", pipelineListener, { once: true });

    try {
      const res = await nvidia.chat.completions.create(
        {
          model: "deepseek-ai/deepseek-v3.2",
          temperature: attempt === 0 ? 0.2 : 0.35,
          max_tokens: 5000,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: `Write ${fileSpec.path} now.` },
          ],
        },
        { signal: controller.signal }
      );

      clearTimeout(timeoutId);
      pipelineAbort.signal.removeEventListener("abort", pipelineListener);

      let content = (res.choices[0]?.message?.content ?? "")
        .replace(/^```(?:jsx?|javascript|css|html|json)?\s*/gim, "")
        .replace(/^```\s*$/gim, "")
        .replace(/^["']use client["'];\s*\n*/m, "")
        .trim();

      if (!content || content.length < 40) throw new Error(`Too short (${content.length})`);
      content = fixExtensionlessImports(content, allPaths);

      if (fileSpec.path.endsWith(".jsx") && !content.includes("export default")) {
        const n = fileSpec.path.split("/").pop()?.replace(".jsx", "") ?? "Component";
        content += content.includes(`function ${n}`)
          ? `\n\nexport default ${n};\n`
          : `\n\nexport default function ${n}Fallback() { return <div className="py-20 text-center text-white">${n}</div>; }\n`;
      }

      console.log(`  ✅ [S3] ${fileSpec.path} (${content.length} chars)`);
      return { path: fileSpec.path, content };

    } catch (err: any) {
      clearTimeout(timeoutId);
      pipelineAbort.signal.removeEventListener("abort", pipelineListener);

      // Pipeline aborted — stop immediately, no retry
      if (pipelineAbort.signal.aborted) {
        return { path: fileSpec.path, content: makeFallbackComponent(fileSpec) };
      }

      const isTimeout = err?.name === "AbortError";
      const isRetryable = isTimeout || (err?.status ?? 0) === 429 || (err?.status ?? 0) >= 500;

      if (attempt < retries && isRetryable) {
        const backoff = 800 * Math.pow(2, attempt);
        console.warn(`  ⚠️ [S3] ${fileSpec.path} attempt ${attempt + 1} ${isTimeout ? "timed out" : `failed (${err?.status})`}, retry in ${backoff}ms`);
        await new Promise((r) => setTimeout(r, backoff));
        continue;
      }

      console.error(`  ❌ [S3] ${fileSpec.path} failed after ${attempt + 1} attempts`);
      return { path: fileSpec.path, content: makeFallbackComponent(fileSpec) };
    }
  }

  return { path: fileSpec.path, content: makeFallbackComponent(fileSpec) };
}

// ─── Worker pool — sharedResults pushed immediately (race fix from v3.3) ──────

async function runWorkerPool(
  tasks: FileSpec[],
  spec: ProjectSpec,
  allPaths: string[],
  concurrency: number,
  sharedResults: StreamFile[],
  pipelineAbort: AbortController,
  onProgress: (f: StreamFile) => void
): Promise<StreamFile[]> {
  const localResults: StreamFile[] = [];
  let nextIndex = 0;

  const worker = async () => {
    while (true) {
      const idx = nextIndex++;
      if (idx >= tasks.length) break;
      if (pipelineAbort.signal.aborted) break;

      const file = await stage3_generateOne(
        spec, tasks[idx], allPaths, sharedResults, pipelineAbort
      );

      // Push immediately so next workers see this file as a sibling
      sharedResults.push(file);
      localResults.push(file);
      onProgress(file);
    }
  };

  await Promise.all(Array.from({ length: concurrency }, () => worker()));
  return localResults;
}

// ═══════════════════════════════════════════════════════════════════════════
// STAGE 3.5 — SEMANTIC VALIDATION
// ═══════════════════════════════════════════════════════════════════════════

function stage35_semantic(files: StreamFile[]): StreamFile[] {
  console.log(`🔍 [S3.5] Semantic validation on ${files.length} files...`);
  const provisional = files.filter((f) => f.provisional);
  const real = files.filter((f) => !f.provisional);
  const fixed = runSemanticValidation(real);
  const changed = fixed.filter((f, i) => f.content !== real[i]?.content).length;
  console.log(`✅ [S3.5] ${changed > 0 ? `${changed} patched` : "no issues"}`);
  return [...provisional, ...fixed];
}

// ═══════════════════════════════════════════════════════════════════════════
// STAGE 4 — PHI VALIDATION
// ═══════════════════════════════════════════════════════════════════════════

async function stage4_validate(files: StreamFile[]): Promise<StreamFile[]> {
  console.log(`🔧 [S4] Phi validation...`);
  const provisional = files.filter((f) => f.provisional);
  const real = files.filter((f) => !f.provisional);

  const nodes: AIFileNode[] = real.map((f) => ({
    path: f.path, content: f.content, type: "file" as const,
  }));

  const fixed = await Promise.all(nodes.map((n) => validateAndFix(n)));
  const changed = fixed.filter((f, i) => f.content !== nodes[i].content).length;
  console.log(changed > 0 ? `  🔧 [S4] phi fixed ${changed}` : `  ✅ [S4] all passed`);

  return [...provisional, ...fixed.map((f) => ({ path: f.path, content: f.content }))];
}

// ═══════════════════════════════════════════════════════════════════════════
// STAGE 5 — ENSURE BOILERPLATE
// ═══════════════════════════════════════════════════════════════════════════

function extractLocalCssImports(file: StreamFile): string[] {
  const dir = file.path.split("/").slice(0, -1).join("/");
  const regex = /import\s+['"](\.[^'"]+\.css)['"]/g;
  const resolved: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = regex.exec(file.content)) !== null) {
    const segs = `${dir}/${m[1]}`.split("/");
    const norm: string[] = [];
    for (const s of segs) { if (s === "..") norm.pop(); else if (s !== ".") norm.push(s); }
    resolved.push(norm.join("/"));
  }
  return resolved;
}

function makeCssStub(cssPath: string): string {
  const name = cssPath.split("/").pop()!.replace(".css", "").toLowerCase();
  return `/* ${cssPath} — auto-stub */\n.${name} { box-sizing: border-box; }\n.${name} * { box-sizing: border-box; }\n`;
}

function stage5_ensureBoilerplate(files: StreamFile[], spec: ProjectSpec): StreamFile[] {
  const map = new Map(files.filter((f) => !f.provisional).map((f) => [f.path, f]));

  const ensure = (path: string, content: string) => {
    if (!map.has(path)) { map.set(path, { path, content }); console.log(`➕ [S5] ${path}`); }
  };

  map.set("package.json", { path: "package.json", content: bp_packageJson(spec.projectName) });
  map.set("index.html",   { path: "index.html",   content: bp_indexHtml(spec.projectName) });
  ensure("src/main.jsx",       bp_mainJsx);
  ensure("vite.config.js",     bp_viteConfig);
  ensure("tailwind.config.js", bp_tailwindConfig);
  ensure("postcss.config.js",  bp_postcssConfig);
  ensure("src/index.css",      bp_indexCss);
  ensure("src/App.css",        bp_appCss);

  const appFile = map.get("src/App.jsx");
  if (!appFile || !appFile.content.includes("export default")) {
    const components = Array.from(map.keys())
      .filter((p) => p.startsWith("src/components/") && p.endsWith(".jsx"))
      .map((p) => ({ name: p.split("/").pop()!.replace(".jsx", ""), rel: `./components/${p.split("/").pop()}` }));

    map.set("src/App.jsx", {
      path: "src/App.jsx",
      content: `import React from 'react';
import './App.css';
${components.map((c) => `import ${c.name} from '${c.rel}';`).join("\n")}

function App() {
  return (
    <div className="app min-h-screen bg-[#0f0f13]">
${components.map((c) => `      <${c.name} />`).join("\n")}
    </div>
  );
}

export default App;`,
    });
    console.log("➕ [S5] Auto-built src/App.jsx");
  }

  let stubs = 0;
  for (const file of Array.from(map.values()).filter((f) => f.path.endsWith(".jsx"))) {
    for (const cssPath of extractLocalCssImports(file)) {
      if (!map.has(cssPath)) {
        map.set(cssPath, { path: cssPath, content: makeCssStub(cssPath) });
        stubs++;
      }
    }
  }
  if (stubs > 0) console.log(`🎨 [S5] ${stubs} CSS stubs`);

  return Array.from(map.values());
}

// ═══════════════════════════════════════════════════════════════════════════
// STAGE 6 — AUTO FIX
// ═══════════════════════════════════════════════════════════════════════════

function stage6_autoFix(files: StreamFile[]): StreamFile[] {
  console.log(`🔧 [S6] autoFix on ${files.length} files...`);
  const fixed = autoFixFiles(files.map((f) => ({ path: f.path, content: f.content } as AutoFixFile)));
  const changed = fixed.filter((f, i) => f.content !== files[i]?.content).length;
  console.log(`✅ [S6] ${changed} modified`);
  return fixed.map((f) => ({ path: f.path, content: f.content }));
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fixExtensionlessImports(content: string, allPaths: string[]): string {
  const jsxSet = new Set(allPaths.filter((p) => p.endsWith(".jsx")).map((p) => p.replace(/\.jsx$/, "")));
  return content.replace(/from\s+(['"])(\.\.?\/[^'"]+)(['"])/g, (match, q1, ip: string, q2) => {
    if (/\.\w+$/.test(ip)) return match;
    const norm = ip.replace(/^\.\.?\//, "");
    const has = Array.from(jsxSet).some((p) => p.endsWith(norm) || p.endsWith("/" + norm));
    return has ? `from ${q1}${ip}.jsx${q2}` : match;
  });
}

function makeFallbackComponent(fileSpec: FileSpec): string {
  if (fileSpec.path.endsWith(".css")) return makeCssStub(fileSpec.path);
  const name = fileSpec.path.split("/").pop()?.replace(/\.[^.]+$/, "") ?? "Component";
  return `import React from 'react';

function ${name}() {
  return (
    <section className="py-20 px-6">
      <div className="max-w-4xl mx-auto text-center">
        <h2 className="text-3xl font-bold text-white mb-4">${name}</h2>
        <p className="text-slate-400">${fileSpec.description}</p>
      </div>
    </section>
  );
}

export default ${name};
`;
}

function makeFallbackProject(prompt: string): StreamFile[] {
  const label = prompt.slice(0, 60) || "AI App";
  return [
    ...makeBoilerplateFiles(prompt).map((f) => ({ ...f, provisional: false })),
    {
      path: "src/App.jsx",
      content: `import React from 'react';

function App() {
  return (
    <div style={{ minHeight:'100vh', background:'#0f0f13', display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column', gap:'16px' }}>
      <h1 style={{ color:'white', fontSize:'2rem', fontWeight:700 }}>${label}</h1>
      <p style={{ color:'#94a3b8' }}>Generation failed — please try again</p>
    </div>
  );
}

export default App;
`,
    },
    { path: "src/App.css", content: bp_appCss },
  ];
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN EXPORT
// ═══════════════════════════════════════════════════════════════════════════

export async function streamProjectPipeline({
  prompt, onFile, onDone, onError,
}: {
  prompt: string;
  onFile: (file: StreamFile) => Promise<void>;
  onDone: () => void;
  onError?: (message: string) => void;
}) {
  console.log("🚀 ════════════════════════════");
  console.log(`🚀 PIPELINE v3.4 "${prompt.slice(0, 60)}"`);
  console.log("🚀 ════════════════════════════");

  // Guards: once done/error fires, onFile becomes a no-op
  const { safeOnFile, safeOnDone, safeOnError } = makeGuardedCallbacks(
    onFile, onDone, onError
  );

  // Pipeline-level abort controller — broadcast to all in-flight S3 calls
  // when the pipeline errors so they stop retrying immediately
  const pipelineAbort = new AbortController();

  const abort = (msg: string) => {
    pipelineAbort.abort();
    safeOnError(msg);
  };

  try {
    // ── S0: Provisional boilerplate ─────────────────────────────────────────
    const provisional = makeBoilerplateFiles(prompt);
    await Promise.all(provisional.map((f) => safeOnFile(f)));
    console.log(`✅ [S0] ${provisional.length} provisional files`);

    // ── S1: Plan (35s timeout) ───────────────────────────────────────────────
    const spec = await withTimeout(
      stage1_plan(prompt),
      STAGE1_TIMEOUT_MS + 5000, // 5s grace over the internal timeout
      "S1-plan"
    ).catch(() => null);

    if (!spec || !spec.files?.length) {
      console.error("❌ Planning failed");
      for (const f of makeFallbackProject(prompt)) await safeOnFile(f);
      safeOnDone();
      return;
    }

    // ── S2: Resolve ──────────────────────────────────────────────────────────
    const resolved = stage2_resolve(spec);
    const allPaths = resolved.map((f) => f.path);

    const tierA = resolved.filter(
      (f) => f.path === "src/App.jsx" || f.path === "src/App.css"
    );
    const tierB = resolved.filter(
      (f) => f.path !== "src/App.jsx" && f.path !== "src/App.css" && !BOILERPLATE_PATHS.has(f.path)
    );

    console.log(`📦 Tier A: ${tierA.map((f) => f.path).join(", ") || "none"}`);
    console.log(`📦 Tier B: ${tierB.length} files (5 workers)`);

    // ── S3: Generate ─────────────────────────────────────────────────────────
    const sharedResults: StreamFile[] = [];

    const tierAResults = tierA.length > 0
      ? await runWorkerPool(tierA, spec, allPaths, 2, sharedResults, pipelineAbort,
          (f) => console.log(`  📄 [S3/A] ${f.path}`))
      : [];

    const tierBResults = tierB.length > 0
      ? await runWorkerPool(tierB, spec, allPaths, 5, sharedResults, pipelineAbort,
          (f) => console.log(`  📄 [S3/B] ${f.path}`))
      : [];

    const allGenerated: StreamFile[] = [...tierAResults, ...tierBResults];
    console.log(`✅ [S3] ${allGenerated.length} files generated`);

    // ── S3.5: Semantic ───────────────────────────────────────────────────────
    const semanticFixed = stage35_semantic(allGenerated);

    // ── S4: Phi ──────────────────────────────────────────────────────────────
    const phiFixed = await stage4_validate(semanticFixed);

    // ── S5: ensureBoilerplate ────────────────────────────────────────────────
    const complete = stage5_ensureBoilerplate(phiFixed, spec);
    console.log(`✅ [S5] ${complete.length} files`);

    // ── S6: autoFix ──────────────────────────────────────────────────────────
    const fixed = stage6_autoFix(complete);

    // ── S7: Batch emit ───────────────────────────────────────────────────────
    console.log(`📡 [S7] Emitting ${fixed.length} final files...`);
    for (const file of fixed) {
      await safeOnFile({ path: file.path, content: file.content, provisional: false });
    }

    console.log("✅ ════════════════════════════");
    console.log(`✅ PIPELINE v3.4 DONE — ${fixed.length} files`);
    console.log("✅ ════════════════════════════");

    safeOnDone();

  } catch (err: any) {
    console.error("❌ Pipeline crashed:", err?.message ?? err);
    pipelineAbort.abort(); // stop all in-flight S3 retries
    for (const f of makeFallbackProject(prompt)) await safeOnFile(f);
    abort(err?.message ?? "Generation failed");
  }
}