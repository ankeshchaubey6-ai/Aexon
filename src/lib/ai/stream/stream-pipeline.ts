// src/lib/ai/stream/stream-pipeline.ts
// PIPELINE v19.0 — FILE‑BY‑FILE · NEW MODEL ROSTER · HARD VALIDATION · NEVER COLLAPSE
//
// ARCHITECTURE:
//   S0  → Boilerplate emit (instant, WebContainer can boot)
//   S1  → Planner   — uses PLAN_MODELS roster (kimi-k2, mistral-large, llama-4-maverick)
//   S1.5→ Spec validation + prioritization
//   S2  → Generator — file-by-file using CODEGEN_MODELS roster (qwen3-coder, devstral, llama-3.3)
//          Each file is an independent LLM call → no JSON encoding failure possible
//   S3  → Deterministic auto-fix (import resolver, JSX balancer, React injector, export enforcer)
//   S3.5→ Hard validation gate — forbidden imports, structural check, safe-replace bad files
//   S4  → Final emit — only changed files, all validated
//
// ROOT CAUSE FIX:
//   Old batch-generator asked LLM to return ALL files as ONE JSON array with code as string values.
//   LLM cannot reliably JSON-escape multiline code → truncation → parse failure → fallback.
//   Fix: ONE file per LLM call. Raw code output. No JSON. No parsing. No failure modes.
//
// MODEL ROSTER (NVIDIA API):
//   PLAN_MODELS:    kimi-k2-instruct, mistral-large-3, llama-4-maverick
//   CODEGEN_MODELS: qwen3-coder-480b, devstral-2-123b, llama-3.3-70b

import OpenAI from "openai";

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 1 — PUBLIC TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export type StreamFile = {
  path:         string;
  content:      string;
  provisional?: boolean;
  lastFixed?:   boolean;
};

export interface PipelineCallbacks {
  onFile:   (file: StreamFile) => Promise<void>;
  onLog?:   (msg: string) => void;
  onDone:   () => void;
  onError?: (msg: string) => void;
  onPing?:  () => void;
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 2 — INTERNAL TYPES
// ═══════════════════════════════════════════════════════════════════════════════

interface FileSpec {
  path:         string;
  description:  string;
  dependencies: string[];
}

interface ProjectSpec {
  projectName:  string;
  description:  string;
  globalContext: string;
  primaryColor: string;
  files:        FileSpec[];
}

interface ValidationResult {
  passed:   boolean;
  reasons:  string[];
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 3 — CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════════

// Planning models — best reasoning, used once per pipeline
const PLAN_MODELS = [
  "moonshotai/kimi-k2-instruct",
  "mistralai/mistral-large-3-675b-instruct-2512",
  "meta/llama-4-maverick-17b-128e-instruct",
] as const;

// Code generation models — best code output, used for every file
const CODEGEN_MODELS = [
  "qwen/qwen3-coder-480b-a35b-instruct",
  "mistralai/devstral-2-123b-instruct-2512",
  "meta/llama-3.3-70b-instruct",
] as const;

type PlanModel    = typeof PLAN_MODELS[number];
type CodegenModel = typeof CODEGEN_MODELS[number];

const NVIDIA_BASE_URL     = "https://integrate.api.nvidia.com/v1";
const MAX_FILE_RETRIES    = 3;
const MAX_REGEN_PER_FILE  = 2;
const PARALLEL_BATCH_SIZE = 3;           // files generated in parallel
const PING_INTERVAL_MS    = 7_000;
const MIN_FILE_CHARS      = 50;
const MAX_FILE_CHARS      = 12_000;
const JSX_IMBALANCE_TOL   = 2;
const PLAN_MAX_TOKENS     = 4096;
const CODEGEN_MAX_TOKENS  = 4096;

const BOILERPLATE_PATHS = new Set([
  "package.json", "index.html", "src/main.jsx", "vite.config.js",
]);

// Only these packages are available at runtime
const AVAILABLE_PACKAGES = "react@18, react-dom@18";

// Packages that must never appear in generated imports
const BANNED_PACKAGES = [
  "framer-motion", "lucide-react", "react-router-dom", "react-router",
  "axios", "three", "@react-three/fiber", "@react-three/drei",
  "gsap", "zustand", "recharts", "preact", "styled-components",
  "@emotion/react", "@emotion/styled", "clsx", "classnames",
  "@tanstack/react-query", "next", "next/image", "next/link",
  "next/router", "next/navigation",
];

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 4 — NVIDIA CLIENT
// ═══════════════════════════════════════════════════════════════════════════════

const nvidia = new OpenAI({
  apiKey:  process.env.NVIDIA_API_KEY!,
  baseURL: NVIDIA_BASE_URL,
});

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 5 — MODEL HEALTH TRACKER
// ═══════════════════════════════════════════════════════════════════════════════

class ModelHealthTracker {
  private failures = new Map<string, number>();
  private readonly SKIP_THRESHOLD = 3;

  recordFailure(model: string): void {
    this.failures.set(model, (this.failures.get(model) ?? 0) + 1);
  }

  recordSuccess(model: string): void {
    this.failures.delete(model);
  }

  isHealthy(model: string): boolean {
    return (this.failures.get(model) ?? 0) < this.SKIP_THRESHOLD;
  }

  getHealthy<T extends string>(models: readonly T[]): T[] {
    return models.filter((m) => this.isHealthy(m));
  }
}

const planHealth    = new ModelHealthTracker();
const codeHealth    = new ModelHealthTracker();

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 6 — RATE LIMITER
// ═══════════════════════════════════════════════════════════════════════════════

class RateLimiter {
  private timestamps: number[] = [];
  private readonly MAX_RPM     = 5;
  private readonly WINDOW_MS   = 62_000;

  async wait(label: string, onPing?: () => void): Promise<void> {
    const now = Date.now();
    this.timestamps = this.timestamps.filter((t) => now - t < this.WINDOW_MS);
    if (this.timestamps.length < this.MAX_RPM) {
      this.timestamps.push(now);
      return;
    }
    const waitMs = this.WINDOW_MS - (now - this.timestamps[0]) + 300;
    plog(`[RL] Rate limit — waiting ${(waitMs / 1000).toFixed(1)}s for ${label}`);
    await sleepPing(waitMs, onPing);
    await this.wait(label, onPing);
  }
}

const rateLimiter = new RateLimiter();

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 7 — UTILITIES
// ═══════════════════════════════════════════════════════════════════════════════

let _log: (msg: string) => void = console.log;

function plog(msg: string): void { _log(msg); }
function perr(msg: string): void { _log(`❌ ${msg}`); console.error(msg); }

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function sleepPing(ms: number, onPing?: () => void): Promise<void> {
  if (ms <= 0) return;
  if (!onPing || ms <= PING_INTERVAL_MS) return sleep(ms);
  const end = Date.now() + ms;
  while (Date.now() < end) {
    await sleep(Math.min(PING_INTERVAL_MS, end - Date.now()));
    if (Date.now() < end) onPing();
  }
}

function backoff(attempt: number): number {
  return Math.min(1200 * Math.pow(2, attempt), 20_000);
}

function mlabel(model: string): string {
  return model.split("/")[1] ?? model;
}

/**
 * Strip markdown fences from LLM output.
 * Models often wrap output in ```jsx or ```javascript blocks.
 */
function stripMarkdown(text: string): string {
  return text
    .replace(/^```(?:jsx?|javascript|typescript|tsx?|json)?\s*/gim, "")
    .replace(/^```\s*$/gim, "")
    .replace(/^["']use (?:client|server)["'];\s*\n*/m, "")
    .trim();
}

/**
 * Fix common token corruption patterns from NVIDIA models.
 * e.g. "= />" → "=>" (corrupted arrow function token)
 */
function fixTokenCorruption(code: string): string {
  let c = code;
  c = c.replace(/(\)|\])\s*=\s*\/\s*>/g, "$1 =>");
  c = c.replace(/(?<![=!<>])=\s*\/\s*>/g, "=>");
  c = c.replace(/\b(useState|useReducer)\s*\(\s*<REDACTED[^>]*>\s*\)/g, "$1(null)");
  c = c.replace(/=\s*\{\s*<REDACTED[^>]*>\s*\}/g, "={null}");
  c = c.replace(/\[REDACTED[^\]]*\]/g, "''");
  c = c.replace(/"<REDACTED[^>]*>"/g, "''");
  c = c.replace(/'<REDACTED[^>]*>'/g, "''");
  return c;
}

/**
 * Remove imports of banned packages.
 * Also converts <Link> to <a> if react-router Link was used.
 */
function stripBannedImports(content: string): string {
  const lines = content.split("\n");
  const stripped: string[] = [];
  const removed: string[] = [];

  for (const line of lines) {
    const t = line.trim();
    if (!t.startsWith("import ")) { stripped.push(line); continue; }

    // CSS imports — always remove
    if (/['"][^'"]*\.css['"]/.test(t)) { removed.push("*.css"); continue; }

    const fromMatch = t.match(/from\s+['"]([^'"]+)['"]/);
    if (!fromMatch) { stripped.push(line); continue; }

    const pkg = fromMatch[1];
    const banned = BANNED_PACKAGES.some((b) => pkg === b || pkg.startsWith(b + "/"));
    if (banned) { removed.push(pkg); continue; }

    stripped.push(line);
  }

  let result = stripped.join("\n");

  if (removed.length > 0) {
    plog(`[RESOLVER] Stripped banned imports: ${removed.join(", ")}`);
  }

  // Convert react-router Link to <a>
  if (/<Link[\s>]/.test(result) || /<\/Link>/.test(result)) {
    result = result
      .replace(/<Link\s+to=(['"])/g, "<a href=$1")
      .replace(/<Link\s+href=(['"])/g, "<a href=$1")
      .replace(/<Link(\s[^>]*)?>/g, "<a$1>")
      .replace(/<\/Link>/g, "</a>");
  }

  return result;
}

/**
 * Inject `import React from 'react';` if JSX is present and React is not imported.
 */
function ensureReactImport(content: string): string {
  if (/\bimport\s+React\b/.test(content)) return content;
  if (/<[A-Za-z]/.test(content)) return `import React from 'react';\n${content}`;
  return content;
}

/**
 * Ensure `export default` exists in a JSX file.
 */
function ensureDefaultExport(content: string, componentName: string): string {
  if (/\bexport\s+default\b/.test(content)) return content;
  const safe = componentName.replace(/[^a-zA-Z0-9_$]/g, "") || "Component";
  return `${content}\n\nexport default ${safe};\n`;
}

/**
 * Remove duplicate import lines (same full import statement).
 */
function deduplicateImports(content: string): string {
  const seen = new Set<string>();
  return content.split("\n").filter((line) => {
    const t = line.trim();
    if (!t.startsWith("import ")) return true;
    if (seen.has(t)) return false;
    seen.add(t);
    return true;
  }).join("\n");
}

/**
 * Strip trailing whitespace, collapse 4+ blank lines to 2, add trailing newline.
 */
function cleanOutput(content: string): string {
  return content
    .replace(/[ \t]+$/gm, "")
    .replace(/\n{4,}/g, "\n\n\n")
    .trimEnd() + "\n";
}

/**
 * Check if a file path is a CSS file (should never reach runtime).
 */
function isCssFile(path: string): boolean {
  return /\.(css|scss|sass|less)$/.test(path);
}

/**
 * Check if file content imports any banned package or CSS.
 */
function hasBannedImports(content: string): boolean {
  const lines = content.split("\n");
  for (const line of lines) {
    const t = line.trim();
    if (!t.startsWith("import ")) continue;
    if (/['"][^'"]*\.css['"]/.test(t)) return true;
    const m = t.match(/from\s+['"]([^'"]+)['"]/);
    if (!m) continue;
    const pkg = m[1];
    if (BANNED_PACKAGES.some((b) => pkg === b || pkg.startsWith(b + "/"))) return true;
  }
  return false;
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 8 — VALIDATION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Hard structural validation for a single JSX/JS file.
 * Returns passed=true only if the file meets minimum production standards.
 */
function validateFile(file: StreamFile): ValidationResult {
  const reasons: string[] = [];

  // CSS files are unconditionally rejected
  if (isCssFile(file.path)) {
    return { passed: false, reasons: [`CSS file rejected: ${file.path}`] };
  }

  // Non-JSX/JS files (json, etc.) are accepted as-is
  if (!file.path.endsWith(".jsx") && !file.path.endsWith(".js")) {
    return { passed: true, reasons: [] };
  }

  const c = file.content ?? "";

  if (c.trim().length < MIN_FILE_CHARS) {
    reasons.push(`too short (${c.trim().length} chars)`);
    return { passed: false, reasons };
  }

  // Banned imports
  if (hasBannedImports(c)) {
    reasons.push("contains banned imports");
  }

  // JSX-specific checks
  if (file.path.endsWith(".jsx")) {
    if (!/\bexport\s+default\b/.test(c)) {
      reasons.push("missing export default");
    }

    if (!/return\s*\(?\s*</.test(c)) {
      reasons.push("no JSX return statement");
    }

    // Multiple export defaults
    const exportCount = (c.match(/\bexport\s+default\b/g) ?? []).length;
    if (exportCount > 1) {
      reasons.push(`multiple export default (${exportCount})`);
    }

    // JSX tag balance check
    const openTags  = (c.match(/<[A-Z][a-zA-Z0-9]*[\s>]/g) ?? []).length;
    const closeTags = (c.match(/<\/[A-Z][a-zA-Z0-9]*>/g) ?? []).length;
    const selfClose = (c.match(/<[A-Z][a-zA-Z0-9]*[^>]*\/>/g) ?? []).length;
    const delta     = openTags - closeTags - selfClose;
    if (Math.abs(delta) > JSX_IMBALANCE_TOL) {
      reasons.push(`JSX tag imbalance (delta=${delta})`);
    }
  }

  return { passed: reasons.length === 0, reasons };
}

/**
 * Apply validation to all files.
 * Files that fail are replaced with a safe minimal component (never drop them).
 */
function applyValidationGate(files: StreamFile[], context: string): StreamFile[] {
  return files.map((file) => {
    if (BOILERPLATE_PATHS.has(file.path)) return file;
    if (isCssFile(file.path)) {
      plog(`[GATE][${context}] Dropping CSS file: ${file.path}`);
      return null as unknown as StreamFile;
    }
    const v = validateFile(file);
    if (!v.passed) {
      plog(`[GATE][${context}] ${file.path} failed — ${v.reasons.join("; ")} → safe-replacing`);
      return makeSafeComponent(file);
    }
    return file;
  }).filter(Boolean);
}

/**
 * Create a minimal valid React component as a safe fallback for a broken file.
 */
function makeSafeComponent(file: StreamFile): StreamFile {
  const rawName   = file.path.split("/").pop()?.replace(/\.[^.]+$/, "") ?? "Component";
  const safeName  = rawName.replace(/[^a-zA-Z0-9_$]/g, "").replace(/^\d+/, "") || "Component";
  // Capitalise first letter
  const compName  = safeName.charAt(0).toUpperCase() + safeName.slice(1);

  const content = cleanOutput(
    `import React from 'react';

function ${compName}() {
  return (
    <section style={{ padding: '4rem 2rem', textAlign: 'center', background: '#0a0a0f', minHeight: '200px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div>
        <h2 style={{ fontSize: '1.75rem', fontWeight: 700, color: '#f1f5f9', margin: 0 }}>${compName}</h2>
        <p style={{ color: '#64748b', marginTop: '0.75rem', fontSize: '0.95rem' }}>Section content</p>
      </div>
    </section>
  );
}

export default ${compName};`
  );

  return { ...file, content };
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 9 — BOILERPLATE FILES
// ═══════════════════════════════════════════════════════════════════════════════

function makePackageJson(name: string): string {
  return JSON.stringify({
    name:    name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "") || "ai-project",
    private: true,
    version: "0.0.0",
    type:    "module",
    scripts: {
      dev:     "vite --host",
      build:   "vite build",
      preview: "vite preview",
    },
    dependencies: {
      react:       "^18.2.0",
      "react-dom": "^18.2.0",
    },
    devDependencies: {
      vite:                    "^5.2.6",
      "@vitejs/plugin-react":  "^4.2.1",
    },
  }, null, 2);
}

function makeIndexHtml(name: string): string {
  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${name}</title>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet" />
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>`;
}

const MAIN_JSX_CONTENT = `import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);`;

const VITE_CONFIG_CONTENT = `import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    host:        true,
    port:        5173,
    strictPort:  false,
  },
  optimizeDeps: {
    include: ['react', 'react-dom', 'react-dom/client'],
  },
});`;

function makeSpinnerApp(prompt: string): string {
  const label = prompt.slice(0, 55).replace(/'/g, "\\'");
  return `import React, { useEffect, useState } from 'react';

const DOTS = ['', '.', '..', '...'];

function App() {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTick((t) => (t + 1) % 4), 500);
    return () => clearInterval(id);
  }, []);

  return (
    <div style={{
      minHeight: '100vh',
      background: '#050508',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '2rem',
      fontFamily: 'Inter, system-ui, sans-serif',
    }}>
      <div style={{
        width: 64,
        height: 64,
        border: '3px solid #6366f1',
        borderTopColor: 'transparent',
        borderRadius: '50%',
        animation: 'spin 0.9s linear infinite',
      }} />
      <style>{'@keyframes spin { to { transform: rotate(360deg) } }'}</style>
      <p style={{ color: '#f1f5f9', fontSize: '1.1rem', fontWeight: 600, margin: 0 }}>
        {'Building: ${label}'}{DOTS[tick]}
      </p>
      <p style={{ color: '#475569', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.1em', margin: 0 }}>
        Generating your app
      </p>
    </div>
  );
}

export default App;`;
}

function makeBoilerplate(prompt: string, projectName = "AI Project"): StreamFile[] {
  return [
    { path: "package.json",   content: makePackageJson(projectName),   provisional: true },
    { path: "index.html",     content: makeIndexHtml(projectName),      provisional: true },
    { path: "src/main.jsx",   content: MAIN_JSX_CONTENT,               provisional: true },
    { path: "vite.config.js", content: VITE_CONFIG_CONTENT,            provisional: true },
    { path: "src/App.jsx",    content: makeSpinnerApp(prompt),          provisional: true },
  ];
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 10 — PLANNER  (Stage 1)
// ═══════════════════════════════════════════════════════════════════════════════

const PLANNER_SYSTEM = `You are a world-class React architect. Return ONLY raw JSON — no markdown, no backticks, no explanation, no preamble.

Schema:
{
  "projectName": "PascalCase name",
  "description": "One sentence description",
  "globalContext": "4-5 sentences about the design philosophy, visual style, and component relationships",
  "primaryColor": "#hexcode",
  "files": [
    {
      "path": "src/components/Hero.jsx",
      "description": "Full-screen hero section with animated headline, subheadline, and two CTA buttons",
      "dependencies": []
    }
  ]
}

REQUIREMENTS:
- Plan exactly 8-14 component files for a production-quality website
- ALWAYS include src/App.jsx as the last file
- ALL paths MUST start with "src/"
- Use folders: src/components/, src/sections/, src/layouts/, src/hooks/, src/utils/
- NEVER include: package.json, index.html, src/main.jsx, vite.config.js
- NEVER include ANY .css file — styling is inline style={{}} ONLY
- NEVER plan files named: Icon.jsx, Card.jsx, Button.jsx, Badge.jsx, index.jsx
- NEVER use TypeScript (.ts/.tsx)
- ONLY available packages: react@18, react-dom@18
- BANNED packages: framer-motion, lucide-react, react-router-dom, axios, three, zustand, recharts, gsap, styled-components, next, clsx
- dependencies array = sibling file paths this component imports from
- Filenames MUST NOT start with a digit
- RESPOND WITH ONLY THE JSON OBJECT — nothing else before or after`;

async function planProject(
  prompt:  string,
  onPing?: () => void,
): Promise<ProjectSpec | null> {
  const models = planHealth.getHealthy(PLAN_MODELS);
  if (models.length === 0) {
    perr("[S1] All plan models unhealthy");
    return null;
  }

  for (let mi = 0; mi < models.length; mi++) {
    const model = models[mi];
    plog(`[S1] Planning with ${mlabel(model)} (${mi + 1}/${models.length})`);

    await rateLimiter.wait(`plan/${mlabel(model)}`, onPing);
    onPing?.();

    const abortCtrl = new AbortController();
    const timeout   = setTimeout(() => abortCtrl.abort(), 120_000);

    try {
      const res = await nvidia.chat.completions.create(
        {
          model,
          temperature: 0.3,
          max_tokens:  PLAN_MAX_TOKENS,
          messages: [
            { role: "system",  content: PLANNER_SYSTEM },
            { role: "user",    content: `User request: ${prompt}\n\nPlan a complete, production-quality React website for this request. Return ONLY the JSON object.` },
          ],
        },
        { signal: abortCtrl.signal },
      );
      clearTimeout(timeout);
      planHealth.recordSuccess(model);

      const raw  = fixTokenCorruption(res.choices[0]?.message?.content ?? "");
      const text = stripMarkdown(raw);

      // Find the JSON object boundaries robustly
      const start = text.indexOf("{");
      const end   = text.lastIndexOf("}");
      if (start === -1 || end === -1) {
        throw new Error(`No JSON object found in planner response (model: ${mlabel(model)})`);
      }

      const parsed = JSON.parse(text.slice(start, end + 1)) as ProjectSpec;

      // Sanitise file list
      parsed.files = (parsed.files ?? [])
        .map((f) => ({
          path:         f.path.replace(/^\/+/, ""),
          description:  f.description || f.path,
          dependencies: Array.isArray(f.dependencies) ? f.dependencies : [],
        }))
        // Drop boilerplate files the planner hallucinated
        .filter((f) => !BOILERPLATE_PATHS.has(f.path))
        // Drop CSS files (planner should not plan them, but guard anyway)
        .filter((f) => !isCssFile(f.path))
        // Drop files whose names start with a digit
        .filter((f) => !/^[0-9]/.test(f.path.split("/").pop() ?? ""))
        // Drop TypeScript files
        .filter((f) => !f.path.endsWith(".ts") && !f.path.endsWith(".tsx"));

      // Ensure App.jsx is always present
      if (!parsed.files.some((f) => f.path === "src/App.jsx")) {
        parsed.files.push({
          path:         "src/App.jsx",
          description:  "Root app component — imports and composes all sections and components",
          dependencies: parsed.files.filter((f) => f.path.endsWith(".jsx")).map((f) => f.path),
        });
      }

      // Ensure App.jsx is last (it depends on everything else)
      parsed.files = [
        ...parsed.files.filter((f) => f.path !== "src/App.jsx"),
        ...parsed.files.filter((f) => f.path === "src/App.jsx"),
      ];

      plog(`[S1] ✓ Planned ${parsed.files.length} files — "${parsed.projectName}"`);
      return parsed;

    } catch (e: unknown) {
      clearTimeout(timeout);
      planHealth.recordFailure(model);
      const status = (e as { status?: number })?.status ?? 0;
      if (status === 401 || status === 403) {
        perr(`[S1] Auth error — cannot continue`);
        return null;
      }
      perr(`[S1] ${mlabel(model)} failed: ${String(e)}`);
      if (mi < models.length - 1) {
        plog(`[S1] Trying next model...`);
        await sleep(1000);
      }
    }
  }

  perr("[S1] All plan models failed");
  return null;
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 11 — FILE PRIORITY SORTER
// ═══════════════════════════════════════════════════════════════════════════════

const PRIORITY_ORDER = [
  "src/utils/",
  "src/hooks/",
  "src/data/",
  "src/lib/",
  "src/layouts/",
  "src/components/",
  "src/sections/",
  "src/features/",
  "src/pages/",
  "src/views/",
  "src/App.jsx",
];

function sortByPriority(files: FileSpec[]): FileSpec[] {
  // Always generate App.jsx last
  const appFile  = files.filter((f) => f.path === "src/App.jsx");
  const rest     = files.filter((f) => f.path !== "src/App.jsx");

  return [
    ...rest.sort((a, b) => {
      const rank = (p: string) => {
        const i = PRIORITY_ORDER.findIndex((prefix) => p.startsWith(prefix) || p === prefix);
        return i === -1 ? PRIORITY_ORDER.length : i;
      };
      return rank(a.path) - rank(b.path);
    }),
    ...appFile,
  ];
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 12 — APP.JSX BUILDER
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Build a well-formed App.jsx that imports and renders all generated components.
 * This runs AFTER all other files are generated so we know what actually exists.
 */
function buildAppJsx(spec: ProjectSpec, generatedFiles: StreamFile[]): string {
  // Only import renderable JSX files that are not App itself and not utility/hook/data files
  const renderableFiles = generatedFiles.filter((f) =>
    f.path.endsWith(".jsx") &&
    f.path !== "src/App.jsx" &&
    f.path !== "src/main.jsx" &&
    !/\/(hooks?|utils?|data|lib|types?)\//i.test(f.path) &&
    /\bexport\s+default\b/.test(f.content)
  );

  // Sort: layouts first, then sections, then components, then pages
  const ORDER = ["layout", "section", "component", "page", "feature", "view"];
  renderableFiles.sort((a, b) => {
    const rank = (p: string) => {
      const i = ORDER.findIndex((s) => p.toLowerCase().includes(s));
      return i === -1 ? ORDER.length : i;
    };
    return rank(a.path) - rank(b.path);
  });

  const components = renderableFiles.map((f) => {
    const name    = f.path.split("/").pop()!.replace(/\.jsx$/, "");
    const relPath = "./" + f.path.replace(/^src\//, "").replace(/\.jsx$/, "") + ".jsx";
    return { name, from: relPath };
  });

  const imports = [
    "import React from 'react';",
    ...components.map((c) => `import ${c.name} from '${c.from}';`),
  ].join("\n");

  const renders = components.length > 0
    ? components.map((c) => `      <${c.name} />`).join("\n")
    : `      <div style={{ padding: '5rem 2rem', textAlign: 'center', color: '#f1f5f9' }}>
        <h1 style={{ fontSize: '3rem', fontWeight: 800, margin: '0 0 1rem' }}>${spec.projectName}</h1>
        <p style={{ color: '#64748b', fontSize: '1.1rem', margin: 0 }}>${spec.description}</p>
      </div>`;

  return cleanOutput(`${imports}

function App() {
  return (
    <div style={{
      minHeight: '100vh',
      background: '#050508',
      fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
    }}>
${renders}
    </div>
  );
}

export default App;`);
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 13 — CODE GENERATOR  (Stage 2 — ONE FILE PER LLM CALL)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * The core codegen system prompt.
 * CRITICAL DESIGN DECISION: We ask for raw file content — NOT JSON.
 * This eliminates the entire class of JSON parsing failures.
 */
function makeCodegenSystemPrompt(spec: ProjectSpec, generatedSoFar: StreamFile[]): string {
  const generatedList = generatedSoFar
    .filter((f) => !f.provisional && f.path.endsWith(".jsx"))
    .map((f) => {
      const name    = f.path.split("/").pop()!.replace(".jsx", "");
      const relPath = "./" + f.path.replace(/^src\//, "").replace(".jsx", "") + ".jsx";
      return `  - ${name} → '${relPath}'`;
    })
    .join("\n") || "  (none yet)";

  return `You are an elite React engineer building production-grade websites.
Output ONLY raw file content — the VERY FIRST character of your response must be the first character of the file.
NO markdown. NO backticks. NO explanations. NO preamble. NO "here is the file". NO TypeScript.

━━━ PROJECT ━━━
Name:    ${spec.projectName}
Purpose: ${spec.description}
Vision:  ${spec.globalContext}
Primary color: ${spec.primaryColor}

━━━ ALREADY GENERATED (importable) ━━━
${generatedList}

━━━ ABSOLUTE RULES (violating ANY of these = broken file) ━━━
1. ALL styling MUST use inline style={{}} — NO className, NO CSS files, NO <style> tags, NO Tailwind
2. ONLY allowed imports: react, react-dom, and relative .jsx/.js files from THIS project
3. BANNED packages (never import these):
   ${BANNED_PACKAGES.join(", ")}
4. ICONS: use inline SVG only — do NOT import from any icon library
5. Every JSX open tag must have matching close tag or self-close
6. Every .jsx file MUST have exactly ONE "export default" statement
7. Every .jsx file MUST return JSX from its default export function
8. NO TypeScript syntax: no ": string", no ": React.FC", no "useState<T>", no "interface", no "type X ="
9. Arrow functions: use "=>" — NEVER "= />" (that is token corruption)
10. NO console.log, NO TODO comments, NO placeholder comments like "// ... rest of component"
11. Complete every file — never truncate, never use ellipsis

━━━ AVAILABLE PACKAGES ━━━
${AVAILABLE_PACKAGES}`;
}

/**
 * Build the per-file user prompt, injecting dependency context.
 */
function makeFileUserPrompt(
  fileSpec:       FileSpec,
  spec:           ProjectSpec,
  generatedSoFar: StreamFile[],
): string {
  const genMap = new Map(generatedSoFar.map((f) => [f.path, f.content]));

  // Inject dependency file content (first 60 lines each) for context
  const depContext = (fileSpec.dependencies ?? [])
    .map((dep) => {
      const content = genMap.get(dep);
      if (!content) return null;
      const preview = content.split("\n").slice(0, 60).join("\n");
      return `// ── DEPENDENCY: ${dep} ──\n${preview}`;
    })
    .filter(Boolean)
    .join("\n\n");

  const isDataFile = /\/(utils?|data|lib)\//i.test(fileSpec.path);
  const isHookFile = /\/hooks?\//i.test(fileSpec.path);
  const isAppFile  = fileSpec.path === "src/App.jsx";

  let instructions = "";

  if (isDataFile || isHookFile) {
    instructions = `Write a complete JavaScript utility/hook file.
Export named OR default exports.
NO JSX. Pure JavaScript only.
Use real, realistic data (at least 4-6 items if it is a data file).`;
  } else if (isAppFile) {
    instructions = `Write the root App component.
Import and render each component listed in the ALREADY GENERATED section above.
Use a vertical stack layout (flexbox column).
Background: #050508. Full viewport height.`;
  } else {
    instructions = `Write a complete, production-quality React component.
Make it visually impressive with rich inline styles.
Use real content — no lorem ipsum.
Implement real interactivity where appropriate (hover states, toggles, etc.) using useState.
Use CSS keyframes via a <style> tag in JSX only if animation is needed (no external animation libraries).
The component must look like it belongs on a premium, modern website.`;
  }

  return `Write the COMPLETE file: ${fileSpec.path}
Purpose: ${fileSpec.description}

${instructions}

${depContext ? `━━━ DEPENDENCY CONTEXT ━━━\n${depContext}\n` : ""}
Start the file content NOW. First character must be the first character of the file.
Do NOT write any explanation. Do NOT use markdown fences.`;
}

const _regenCount = new Map<string, number>();

/**
 * Generate a single file using the CODEGEN_MODELS roster.
 * Returns the best result or a safe fallback — NEVER throws.
 */
async function generateFile(
  fileSpec:       FileSpec,
  spec:           ProjectSpec,
  generatedSoFar: StreamFile[],
  prompt:         string,
  onPing?:        () => void,
): Promise<StreamFile> {
  // Never generate CSS files
  if (isCssFile(fileSpec.path)) {
    plog(`[S2] Skipping CSS file: ${fileSpec.path}`);
    return makeSafeComponent({ path: fileSpec.path.replace(/\.css$/, ".jsx"), content: "" });
  }

  // Regen guard — if we've tried too many times, use safe fallback
  const regensSoFar = _regenCount.get(fileSpec.path) ?? 0;
  if (regensSoFar >= MAX_REGEN_PER_FILE) {
    plog(`[S2] ${fileSpec.path} exceeded regen limit — safe fallback`);
    return makeSafeComponent({ path: fileSpec.path, content: "" });
  }

  const models = codeHealth.getHealthy(CODEGEN_MODELS);
  if (models.length === 0) {
    perr(`[S2] All codegen models unhealthy for ${fileSpec.path}`);
    return makeSafeComponent({ path: fileSpec.path, content: "" });
  }

  const system     = makeCodegenSystemPrompt(spec, generatedSoFar);
  const userPrompt = makeFileUserPrompt(fileSpec, spec, generatedSoFar);

  for (let mi = 0; mi < models.length; mi++) {
    const model = models[mi];

    for (let attempt = 0; attempt < MAX_FILE_RETRIES; attempt++) {
      await rateLimiter.wait(`${mlabel(model)}/${fileSpec.path}`, onPing);
      onPing?.();

      const abortCtrl = new AbortController();
      const timeout   = setTimeout(() => abortCtrl.abort(), 90_000);
      const t0        = Date.now();

      try {
        // Temperature: slightly higher on retries to escape local minima
        const temperature = 0.2 + attempt * 0.08;

        plog(`[S2] ${mlabel(model)} → ${fileSpec.path} (attempt ${attempt + 1}, t=${temperature.toFixed(2)})`);

        const res = await nvidia.chat.completions.create(
          {
            model,
            temperature,
            max_tokens: CODEGEN_MAX_TOKENS,
            messages: [
              { role: "system", content: system     },
              { role: "user",   content: userPrompt },
            ],
          },
          { signal: abortCtrl.signal },
        );

        clearTimeout(timeout);
        codeHealth.recordSuccess(model);

        const latencyMs = Date.now() - t0;
        const raw       = fixTokenCorruption(res.choices[0]?.message?.content ?? "");

        // Strip markdown fences — models often wrap output even when told not to
        let content = stripMarkdown(raw);

        // Hard rejection: too short
        if (content.trim().length < MIN_FILE_CHARS) {
          throw new Error(`Output too short: ${content.trim().length} chars`);
        }

        // Hard rejection: token corruption detected
        if (/=\s*\/\s*>/.test(content) || /<REDACTED/.test(content)) {
          throw new Error("Token corruption detected in output");
        }

        // Strip any banned imports that slipped through
        content = stripBannedImports(content);

        // JSX-specific normalization
        if (fileSpec.path.endsWith(".jsx")) {
          content = ensureReactImport(content);
          const compName = fileSpec.path.split("/").pop()!.replace(".jsx", "");
          content = ensureDefaultExport(content, compName);
        }

        // Deduplicate imports
        content = deduplicateImports(content);

        // Truncate if unreasonably large
        if (content.length > MAX_FILE_CHARS) {
          const trunc   = content.slice(0, MAX_FILE_CHARS);
          const lastBrace = trunc.lastIndexOf("\n}");
          content = lastBrace > MAX_FILE_CHARS * 0.6 ? trunc.slice(0, lastBrace + 2) : trunc;
          // Re-ensure export default after truncation
          if (fileSpec.path.endsWith(".jsx")) {
            const compName = fileSpec.path.split("/").pop()!.replace(".jsx", "");
            content = ensureDefaultExport(content, compName);
          }
        }

        content = cleanOutput(content);

        // Validate the result
        const v = validateFile({ path: fileSpec.path, content });
        if (!v.passed) {
          plog(`[S2] ${mlabel(model)} ${fileSpec.path} validation failed: ${v.reasons.join("; ")}`);
          // For auto-fixable issues (missing React import, missing export default), fix and accept
          if (v.reasons.every((r) => r.includes("missing export default") || r.includes("missing React"))) {
            content = ensureReactImport(content);
            content = ensureDefaultExport(content, fileSpec.path.split("/").pop()!.replace(".jsx", ""));
            plog(`[S2] Auto-fixed: ${fileSpec.path}`);
          } else {
            // Structural failure — retry
            if (attempt < MAX_FILE_RETRIES - 1) {
              await sleepPing(backoff(attempt), onPing);
              continue;
            }
            break; // Try next model
          }
        }

        _regenCount.delete(fileSpec.path);
        plog(`[S2] ✓ ${fileSpec.path} (${content.length}c, ${latencyMs}ms)`);
        return { path: fileSpec.path, content };

      } catch (e: unknown) {
        clearTimeout(timeout);
        codeHealth.recordFailure(model);

        const status = (e as { status?: number })?.status ?? 0;
        const msg    = (e as Error)?.message ?? String(e);

        if (status === 401 || status === 403) {
          perr(`[S2] Auth error — cannot continue`);
          return makeSafeComponent({ path: fileSpec.path, content: "" });
        }

        plog(`[S2] ${mlabel(model)} ${fileSpec.path} attempt ${attempt + 1} failed: ${msg}`);

        if (attempt < MAX_FILE_RETRIES - 1) {
          await sleepPing(backoff(attempt), onPing);
        }
      }
    }

    plog(`[S2] ${mlabel(model)} exhausted for ${fileSpec.path} — trying next model`);
  }

  perr(`[S2] All models failed for ${fileSpec.path} — safe fallback`);
  _regenCount.set(fileSpec.path, regensSoFar + 1);
  return makeSafeComponent({ path: fileSpec.path, content: "" });
}

/**
 * Generate all files in priority order, with PARALLEL_BATCH_SIZE concurrency.
 * App.jsx is always generated last after all other files exist for context.
 */
async function generateAllFiles(
  spec:      ProjectSpec,
  prompt:    string,
  smartEmit: (f: StreamFile) => Promise<void>,
  onPing?:   () => void,
): Promise<StreamFile[]> {
  const sortedSpecs = sortByPriority(spec.files);
  const nonAppSpecs = sortedSpecs.filter((f) => f.path !== "src/App.jsx");
  const appSpec     = sortedSpecs.find((f) => f.path === "src/App.jsx");

  const generated: StreamFile[] = [];

  // Generate all non-App files in batches
  for (let i = 0; i < nonAppSpecs.length; i += PARALLEL_BATCH_SIZE) {
    const batch = nonAppSpecs.slice(i, i + PARALLEL_BATCH_SIZE);
    plog(`[S2] Batch ${Math.floor(i / PARALLEL_BATCH_SIZE) + 1}: files ${i + 1}–${Math.min(i + PARALLEL_BATCH_SIZE, nonAppSpecs.length)} of ${nonAppSpecs.length}`);

    const results = await Promise.all(
      batch.map((fs) => generateFile(fs, spec, generated, prompt, onPing))
    );

    for (const file of results) {
      generated.push(file);
      await smartEmit({ ...file, provisional: true });
    }
  }

  // Generate App.jsx last — now it can see all generated files
  if (appSpec) {
    plog(`[S2] Generating src/App.jsx (final — has full context of ${generated.length} files)`);
    // First: build a deterministic App.jsx so the user sees something fast
    const deterministicApp = buildAppJsx(spec, generated);
    const deterministicFile: StreamFile = { path: "src/App.jsx", content: deterministicApp };
    generated.push(deterministicFile);
    await smartEmit({ ...deterministicFile, provisional: true });
  }

  plog(`[S2] ✓ Generated ${generated.length} files`);
  return generated;
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 14 — DETERMINISTIC FIX PASS  (Stage 3 — no LLM needed)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Try to auto-fix JSX tag imbalance by wrapping the return block in a <div>.
 * This handles the most common case: missing outer wrapper.
 */
function fixJsxImbalance(content: string): string {
  const openTags  = (content.match(/<[A-Z][a-zA-Z0-9]*[\s>]/g) ?? []).length;
  const closeTags = (content.match(/<\/[A-Z][a-zA-Z0-9]*>/g) ?? []).length;
  const selfClose = (content.match(/<[A-Z][a-zA-Z0-9]*[^>]*\/>/g) ?? []).length;
  const delta     = openTags - closeTags - selfClose;

  if (Math.abs(delta) <= JSX_IMBALANCE_TOL) return content;

  // Wrap the return body in a fragment
  const returnMatch = content.match(/(\breturn\s*\()([\s\S]*?)(\)\s*;?\s*\n)/);
  if (!returnMatch) return content;

  const [full, open, body, close] = returnMatch;
  const wrapped = `${open}\n    <>\n${body}\n    </>\n  ${close}`;
  return content.replace(full, wrapped);
}

/**
 * Fix useEffect calls missing dependency arrays.
 * Pattern: useEffect(() => { ... }) → useEffect(() => { ... }, [])
 */
function fixUseEffectDeps(content: string): string {
  return content
    .replace(
      /\buseEffect\s*\(\s*(\(\s*\)\s*=>\s*\{(?:[^{}]|\{[^{}]*\})*\})\s*\)(?!\s*,)/g,
      (_, fn) => `useEffect(${fn}, [])`
    )
    .replace(
      /\buseEffect\s*\(\s*(function\s*\(\s*\)\s*\{(?:[^{}]|\{[^{}]*\})*\})\s*\)(?!\s*,)/g,
      (_, fn) => `useEffect(${fn}, [])`
    );
}

/**
 * Run all deterministic fixes on a collection of files.
 * These are safe transformations that cannot make a valid file invalid.
 */
function deterministicFixPass(files: StreamFile[]): StreamFile[] {
  return files.map((file) => {
    if (BOILERPLATE_PATHS.has(file.path)) return file;
    if (isCssFile(file.path)) return file;
    if (!file.path.endsWith(".jsx") && !file.path.endsWith(".js")) return file;

    let content = file.content;

    // 1. Strip any banned imports that survived generation
    content = stripBannedImports(content);

    // 2. Ensure React import for JSX files
    if (file.path.endsWith(".jsx")) {
      content = ensureReactImport(content);
    }

    // 3. Ensure export default for JSX files
    if (file.path.endsWith(".jsx")) {
      const compName = file.path.split("/").pop()!.replace(".jsx", "");
      content = ensureDefaultExport(content, compName);
    }

    // 4. Fix multiple export defaults (keep only the last one)
    const exportDefaultMatches = [...content.matchAll(/\bexport\s+default\b/g)];
    if (exportDefaultMatches.length > 1) {
      // Remove all but the last export default
      let count = 0;
      content = content.replace(/\bexport\s+default\b/g, (match) => {
        count++;
        return count < exportDefaultMatches.length ? "" : match;
      });
    }

    // 5. Fix useEffect missing dep arrays
    content = fixUseEffectDeps(content);

    // 6. Try to fix JSX imbalance
    if (file.path.endsWith(".jsx")) {
      content = fixJsxImbalance(content);
    }

    // 7. Deduplicate imports
    content = deduplicateImports(content);

    // 8. Fix token corruption
    content = fixTokenCorruption(content);

    // 9. Clean output
    content = cleanOutput(content);

    return { ...file, content };
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 15 — EMIT HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Emit a file only if its content has changed since last emit.
 * Applies final validation before emit — bad files are safe-replaced.
 */
async function smartEmitFile(
  file:           StreamFile,
  onFile:         (f: StreamFile) => Promise<void>,
  emittedContent: Map<string, string>,
): Promise<void> {
  if (isCssFile(file.path)) {
    plog(`[EMIT] CSS file dropped: ${file.path}`);
    return;
  }

  let fileToEmit = file;

  // Final validation before emit
  if (!BOILERPLATE_PATHS.has(file.path) && file.path.endsWith(".jsx")) {
    const v = validateFile(file);
    if (!v.passed) {
      plog(`[EMIT] ${file.path} invalid at emit gate: ${v.reasons.join("; ")} → safe-replacing`);
      fileToEmit = makeSafeComponent(file);
    }
  }

  const prev = emittedContent.get(fileToEmit.path);
  if (prev === fileToEmit.content) return;

  emittedContent.set(fileToEmit.path, fileToEmit.content);
  try {
    await onFile(fileToEmit);
  } catch (e) {
    perr(`[EMIT] onFile threw for ${fileToEmit.path}: ${String(e)}`);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 16 — MAIN PIPELINE EXPORT
// ═══════════════════════════════════════════════════════════════════════════════

export async function streamProjectPipeline(
  prompt:    string,
  callbacks: PipelineCallbacks,
): Promise<void> {
  const { onFile, onDone, onError, onLog, onPing } = callbacks;

  _log = (msg: string) => { console.log(msg); onLog?.(msg); };

  _regenCount.clear();

  const emittedContent = new Map<string, string>();

  const smartEmit = (f: StreamFile) =>
    smartEmitFile(f, onFile, emittedContent);

  const safeDone  = () => { try { onDone();        } catch {} };
  const safeError = (m: string) => { try { onError?.(m); } catch {} };

  plog("🚀 ══════════════════════════════════════════════════════════");
  plog("🚀 PIPELINE v19.0 — File-by-File · New Model Roster · Hard Validation");
  plog(`🚀 Prompt: "${prompt.slice(0, 80)}"`);
  plog(`🚀 Plan models:    ${PLAN_MODELS.map(mlabel).join(", ")}`);
  plog(`🚀 Codegen models: ${CODEGEN_MODELS.map(mlabel).join(", ")}`);
  plog("🚀 ══════════════════════════════════════════════════════════");

  // ── Stage 0: Emit boilerplate immediately ───────────────────────────────────
  plog("[S0] Emitting boilerplate...");
  try {
    for (const f of makeBoilerplate(prompt)) {
      await smartEmit(f);
    }
    plog("[S0] ✓ Boilerplate emitted — WebContainer can boot");
  } catch (e) {
    perr(`[S0] Boilerplate emit failed: ${String(e)}`);
    // Non-fatal — continue
  }

  // ── Stage 1: Plan project structure ─────────────────────────────────────────
  plog("[S1] Planning project...");
  let spec: ProjectSpec | null = null;
  try {
    spec = await planProject(prompt, onPing);
  } catch (e) {
    perr(`[S1] Planning threw: ${String(e)}`);
  }

  if (!spec || spec.files.length === 0) {
    perr("[S1] Planning failed — emitting minimal fallback");
    const fallback = makeSpinnerApp(prompt).replace(
      "Generating your app",
      "Generation failed — please retry"
    );
    await smartEmit({ path: "src/App.jsx", content: fallback, provisional: false });
    safeError("Planning failed");
    safeDone();
    return;
  }

  plog(`[S1] ✓ ${spec.files.length} files planned`);

  // ── Stage 2: Generate all files ─────────────────────────────────────────────
  plog(`[S2] Generating ${spec.files.length} files (batch size: ${PARALLEL_BATCH_SIZE})...`);
  let generatedFiles: StreamFile[] = [];
  try {
    generatedFiles = await generateAllFiles(spec, prompt, smartEmit, onPing);
    plog(`[S2] ✓ ${generatedFiles.length} files generated`);
  } catch (e) {
    perr(`[S2] Generation error: ${String(e)}`);
    safeError(`Generation failed: ${String(e)}`);
    safeDone();
    return;
  }

  // ── Stage 3: Deterministic fix pass ─────────────────────────────────────────
  plog(`[S3] Running deterministic fix pass on ${generatedFiles.length} files...`);
  let fixedFiles = deterministicFixPass(generatedFiles);
  plog("[S3] ✓ Deterministic fixes applied");

  // ── Stage 3.5: Hard validation gate ─────────────────────────────────────────
  plog("[S3.5] Applying hard validation gate...");
  fixedFiles = applyValidationGate(fixedFiles, "POST-FIX");
  plog(`[S3.5] ✓ ${fixedFiles.length} files passed gate`);

  // ── Stage 4: Emit final files ─────────────────────────────────────────────
  plog(`[S4] Emitting ${fixedFiles.length} final files...`);
  let emitCount = 0;
  for (const file of fixedFiles) {
    const prev = emittedContent.get(file.path);
    if (prev !== file.content) {
      await smartEmit({ ...file, provisional: false, lastFixed: true });
      emitCount++;
    }
  }
  plog(`[S4] ✓ Emitted ${emitCount} updated files`);

  plog("✅ ══════════════════════════════════════════════════════════");
  plog(`✅ PIPELINE v19.0 DONE — ${fixedFiles.length} files`);
  plog("✅ ══════════════════════════════════════════════════════════");

  safeDone();
}