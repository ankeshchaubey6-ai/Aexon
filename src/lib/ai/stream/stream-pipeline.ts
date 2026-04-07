// src/lib/ai/stream/stream-pipeline.ts
  import { buildComponentRegistry } from "@/lib/ai/engine/component-registry";
// PRODUCTION PIPELINE v8.5 — Network Suspension Fix
//
// KEY FIX — ERR_NETWORK_IO_SUSPENDED:
//   The browser suspends the TCP connection when it receives no bytes for ~45s.
//   The route's setInterval heartbeat only fires between awaits — but during a
//   long nvidia.chat.completions.create() call (which blocks the event loop for
//   the duration of the HTTP round-trip), the interval CANNOT fire.
//
//   Fix: Every sleep() in the pipeline now accepts an optional onPing callback.
//   The route passes a ping function that enqueues ": keep-alive\n\n" bytes.
//   This means pings fire WITHIN sleeps (rate-limiter waits, retry backoffs)
//   where the event loop is free. During active LLM calls, the NVIDIA SDK
//   streams the response token-by-token, so bytes flow naturally.
//
//   Additional hardening:
//   - Heartbeat interval reduced to 8s (was 15s) — below Vercel's 10s idle limit
//   - Route sends a ": ping\n\n" immediately before each LLM call starts
//   - Transfer-Encoding: chunked added to response headers

import OpenAI from "openai";
import { checkSyntax } from "@/lib/ai/validation/syntax-checker";
import { runSemanticValidation } from "@/lib/ai/validation/semantic-validator";
import { autoFixStreamFiles } from "@/lib/ai/engine/auto-fix";

// ─── Public types ──────────────────────────────────────────────────────────────
export type StreamFile = {
  path: string;
  content: string;
  provisional?: boolean;
  size?: number;
  lastFixed?: boolean;
};

export interface PipelineCallbacks {
  onFile:    (file: StreamFile) => Promise<void>;
  onLog?:    (msg: string) => void;
  onDone:    () => void;
  onError?:  (message: string) => void;
  onMetric?: (name: string, value: number) => void;
  /** Called periodically so the route can flush a keep-alive byte to the client. */
  onPing?:   () => void;
}

// ─── Internal types ────────────────────────────────────────────────────────────
interface FileSpec {
  path: string;
  description: string;
  dependencies: string[];
  is3D?: boolean;
  isAnimation?: boolean;
}

interface ProjectSpec {
  projectName: string;
  description: string;
  globalContext: string;
  designTokens: DesignTokens;
  files: FileSpec[];
}

interface DesignTokens {
  colors: {
    primary: string[];
    secondary: string[];
    accent: string[];
    background: string[];
    text: string[];
  };
  typography: {
    fontFamily: string;
    headingSizes: Record<string, string>;
    bodySize: string;
  };
  spacing: Record<string, string>;
  animations: {
    duration: Record<string, string>;
    easing: Record<string, string>;
  };
  breakpoints: Record<string, string>;
}

// ─── Models ────────────────────────────────────────────────────────────────────
const PLAN_MODELS = [
  "moonshotai/kimi-k2-instruct",
  "mistralai/mistral-large-3-675b-instruct-2512",
  "meta/llama-4-maverick-17b-128e-instruct",
] as const;

const CODEGEN_MODELS = [
  "qwen/qwen3-coder-480b-a35b-instruct",
  "mistralai/devstral-2-123b-instruct-2512",
  "meta/llama-3.3-70b-instruct",
] as const;

const CSS_MODELS = [
  "mistralai/devstral-2-123b-instruct-2512",
  "meta/llama-3.3-70b-instruct",
] as const;

const FIX_MODEL = "microsoft/phi-3.5-mini-instruct";

// ─── NVIDIA client ─────────────────────────────────────────────────────────────
const nvidia = new OpenAI({
  apiKey:  process.env.NVIDIA_API_KEY!,
  baseURL: "https://integrate.api.nvidia.com/v1",
});

// ─── Constants ─────────────────────────────────────────────────────────────────
const RATE_WINDOW_MS   = 62_000;
const MAX_RPM          = 5;
const PLAN_TIMEOUT_MS  = 180_000;
const FILE_TIMEOUT_MS  = 120_000;
const FIX_TIMEOUT_MS   = 60_000;
const MAX_FILE_RETRIES = 3;
const MAX_COMPONENTS   = 12;
const MAX_FILE_CHARS   = 10_000;

// How often to emit a ping during sleeps (must be < 8s to beat Vercel idle timeout)
const PING_INTERVAL_MS = 6_000;

const BOILERPLATE_PATHS = new Set([
  "package.json",
  "index.html",
  "src/main.jsx",
  "vite.config.js",
  "tailwind.config.js",
  "postcss.config.js",
  "src/index.css",
]);

// ─── Rate Limiter ──────────────────────────────────────────────────────────────
class AdvancedRateLimiter {
  private callTimestamps: number[] = [];
  private failures     = new Map<string, number>();
  private circuitOpenUntil = new Map<string, number>();
  private readonly FAILURE_THRESHOLD = 3;
  private readonly CIRCUIT_RESET_MS  = 60_000;

  async waitForSlot(model: string, label: string, onPing?: () => void): Promise<void> {
    const openUntil = this.circuitOpenUntil.get(model);
    if (openUntil && Date.now() < openUntil) {
      const wait = openUntil - Date.now();
      console.log(`⏸️ [CB] Circuit open for ${model}, waiting ${wait}ms`);
      await sleepWithPing(wait, onPing);
      this.circuitOpenUntil.delete(model);
    }
    const now = Date.now();
    this.callTimestamps = this.callTimestamps.filter((t) => now - t < RATE_WINDOW_MS);
    if (this.callTimestamps.length < MAX_RPM) {
      this.callTimestamps.push(now);
      return;
    }
    const oldest = this.callTimestamps[0];
    const waitMs = RATE_WINDOW_MS - (now - oldest) + 500;
    console.log(`⏳ [RL] Rate limit — waiting ${(waitMs / 1000).toFixed(1)}s before ${label}`);
    await sleepWithPing(waitMs, onPing);
    await this.waitForSlot(model, label, onPing);
  }

  recordSuccess(model: string): void {
    this.failures.delete(model);
    this.circuitOpenUntil.delete(model);
  }

  recordFailure(model: string): void {
    const fails = (this.failures.get(model) || 0) + 1;
    this.failures.set(model, fails);
    if (fails >= this.FAILURE_THRESHOLD) {
      this.circuitOpenUntil.set(model, Date.now() + this.CIRCUIT_RESET_MS);
      console.warn(`🔌 [CB] Circuit opened for ${model} for ${this.CIRCUIT_RESET_MS}ms`);
    }
  }
}

const rateLimiter = new AdvancedRateLimiter();

// ─── Utilities ─────────────────────────────────────────────────────────────────
function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Sleep for `ms` milliseconds, emitting onPing() every PING_INTERVAL_MS.
 * This ensures keep-alive bytes flow to the client even during long rate-limit
 * waits, preventing ERR_NETWORK_IO_SUSPENDED on Chrome/Safari.
 */
async function sleepWithPing(ms: number, onPing?: () => void): Promise<void> {
  if (!onPing || ms <= PING_INTERVAL_MS) {
    return sleep(ms);
  }
  const end = Date.now() + ms;
  while (Date.now() < end) {
    const remaining = end - Date.now();
    await sleep(Math.min(PING_INTERVAL_MS, remaining));
    if (Date.now() < end) onPing();
  }
}

function stripMarkdown(text: string): string {
  return text
    .replace(/^```(?:json|jsx?|javascript|css|html|ts|tsx)?\s*/gim, "")
    .replace(/^```\s*$/gim, "")
    .replace(/^["']use client["'];\s*\n*/m, "")
    .trim();
}

function fixRedactedTokens(code: string): string {
  let fixed = code;
  fixed = fixed.replace(/(\)|\])\s*=\s*\/\s*>/g, "$1 =>");
  fixed = fixed.replace(/(?<!=)=\s*\/\s*>/g, "=>");
  fixed = fixed.replace(
    /\b(useState|useReducer)\s*\(\s*<REDACTED_EMAIL>\s*\)/g,
    "$1('')"
  );
  fixed = fixed.replace(
    /\b(useState|useReducer)\s*\(\s*<REDACTED_EMAIL>\s*,/g,
    "$1(null,"
  );
  fixed = fixed.replace(/=\s*\{\s*<REDACTED_EMAIL>\s*\}/g, "={''}");
  fixed = fixed.replace(/\b(\w+)\s*\(\s*<REDACTED_EMAIL>\s*\)/g, "$1('')");
  fixed = fixed.replace(/=\s*<REDACTED_EMAIL>\b/g, "= ''");
  fixed = fixed.replace(/\[REDACTED(?:_EMAIL)?\]/g, "''");
  fixed = fixed.replace(/"<REDACTED_EMAIL>"/g, "''");
  fixed = fixed.replace(/'<REDACTED_EMAIL>'/g, "''");
  return fixed;
}

function cleanLLMOutput(code: string, filePath: string): string {
  let out = code;

  const PROSE_STARTERS = [
    /^I\s+(have|added|removed|updated|fixed|also)/i,
    /^Note\s+that\b/i,
    /^Here('s| is)\b/i,
    /^This\s+(component|file|code|implementation)\b/i,
    /^The\s+(above|following|component|file)\b/i,
    /^In\s+(this|the)\s+(component|file)\b/i,
    /^Finally[,\s]/i,
    /^Additionally[,\s]/i,
    /^Also[,\s]/i,
    /^Please\s+note\b/i,
    /^You\s+(can|should|need|may)\b/i,
    /^To\s+(use|run|install|fix)\b/i,
    /^Let\s+me\s+(know|explain)\b/i,
    /^Hope\s+(this|that)\b/i,
    /^Feel\s+free\b/i,
  ];

  const exportDefaultRe = /^export\s+default\b[^\n]*/gm;
  let lastExport: RegExpExecArray | null = null;
  let m: RegExpExecArray | null;
  while ((m = exportDefaultRe.exec(out)) !== null) lastExport = m;

  if (lastExport) {
    const endPos = lastExport.index + lastExport[0].length;
    const after  = out.slice(endPos).replace(/^[\s;]+/, "");
    if (PROSE_STARTERS.some((p) => p.test(after))) {
      out = out.slice(0, endPos).trimEnd() + "\n";
    }
  }

  const isJSXonly =
    filePath.endsWith(".jsx") ||
    (filePath.endsWith(".js") && !filePath.endsWith(".ts"));
  if (isJSXonly) {
    out = out.replace(/\):\s*React\.\w+\s*\{/g, ") {");
    out = out.replace(/\):\s*React\.\w+<[^>]+>\s*\{/g, ") {");
    out = out.replace(/:\s*React\.FC(?:<[^>]+>)?\s*=/g, " =");
    out = out.replace(/:\s*React\.ReactNode(?=\s*[,;)\]}])/g, "");
    out = out.replace(/:\s*React\.ReactElement(?=\s*[,;)\]}])/g, "");
    out = out.replace(/\buseState<[^>]+>\(/g, "useState(");
    out = out.replace(/\buseRef<[^>]+>\(/g, "useRef(");
    out = out.replace(/\buseCallback<[^>]+>\(/g, "useCallback(");
    out = out.replace(/\buseMemo<[^>]+>\(/g, "useMemo(");
  }

  out = out.replace(/(\)|\])\s*=\s*\/\s*>/g, "$1 =>");
  out = out.replace(/(?<!=)=\s*\/\s*>/g, "=>");
  out = fixRedactedTokens(out);

  return out;
}

function addJsxExtensions(content: string): string {
  return content.replace(
    /from\s+(['"])(\.\.?\/[^'"]+)(['"])/g,
    (match, q1, importPath: string, q2) =>
      /\.\w+$/.test(importPath) ? match : `from ${q1}${importPath}.jsx${q2}`
  );
}

function modelLabel(model: string): string {
  return model.split("/")[1] ?? model;
}

function ensureDefaultExport(content: string, componentName: string): string {
  if (content.includes("export default")) return content;
  return `${content}\n\nexport default ${componentName};\n`;
}

function injectReactImport(content: string): string {
  if (content.includes("import React") || content.includes("import React,")) return content;
  return `import React from 'react';\n${content}`;
}

// ─── Design Tokens ─────────────────────────────────────────────────────────────
function generateDesignTokens(_spec: Partial<ProjectSpec>): DesignTokens {
  return {
    colors: {
      primary:    ["#6366f1", "#4f46e5", "#4338ca"],
      secondary:  ["#a855f7", "#9333ea", "#7e22ce"],
      accent:     ["#06b6d4", "#0891b2", "#0e7490"],
      background: ["#050508", "#0d0d18", "#1a1a2e"],
      text:       ["#f8fafc", "#94a3b8", "#475569"],
    },
    typography: {
      fontFamily: "Inter, system-ui, -apple-system, sans-serif",
      headingSizes: {
        h1: "clamp(3rem, 8vw, 6rem)",
        h2: "clamp(2rem, 5vw, 3.5rem)",
        h3: "clamp(1.5rem, 4vw, 2rem)",
        h4: "clamp(1.25rem, 3vw, 1.5rem)",
      },
      bodySize: "1rem",
    },
    spacing: {
      xs: "0.5rem", sm: "1rem",  md: "1.5rem",
      lg: "2rem",   xl: "3rem",  "2xl": "4rem", "3xl": "6rem",
    },
    animations: {
      duration: { fast: "150ms", normal: "300ms", slow: "500ms", slower: "800ms" },
      easing: {
        ease:      "cubic-bezier(0.25, 0.1, 0.25, 1)",
        easeOut:   "cubic-bezier(0, 0, 0.58, 1)",
        easeInOut: "cubic-bezier(0.42, 0, 0.58, 1)",
        spring:    "cubic-bezier(0.175, 0.885, 0.32, 1.275)",
      },
    },
    breakpoints: {
      sm: "640px", md: "768px", lg: "1024px", xl: "1280px", "2xl": "1536px",
    },
  };
}

// ─── Boilerplate ───────────────────────────────────────────────────────────────
function makePkgJson(_name: string): string {
  return JSON.stringify(
    {
      name: "ai-project",
      private: true,
      version: "0.0.0",
      type: "module",
      scripts: {
        dev:     "vite --host",
        build:   "vite build",
        preview: "vite preview",
      },
      dependencies: {
        react:           "^18.2.0",
        "react-dom":     "^18.2.0",
        "framer-motion": "^11.0.8",
        "lucide-react":  "^0.363.0",
        clsx:            "^2.1.0",
      },
      devDependencies: {
        vite:                   "^5.2.6",
        "@vitejs/plugin-react": "^4.2.1",
      },
    },
    null,
    2
  );
}

function makeIndexHtml(name: string): string {
  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${name}</title>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@100..900&display=swap" rel="stylesheet" />
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>`;
}

const MAIN_JSX = `import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);`;

const VITE_CONFIG = `import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    open: false,
    port: 5173,
    strictPort: false,
  },
  optimizeDeps: {
    include: ['react', 'react-dom', 'react-dom/client'],
  },
});
`;

const TAILWIND_CONFIG = `/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: { sans: ['Inter', 'system-ui', 'sans-serif'] },
    },
  },
  plugins: [],
};`;

const POSTCSS_CONFIG = `export default { plugins: { tailwindcss: {}, autoprefixer: {} } };`;

const INDEX_CSS = `@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  :root {
    --bg-primary: #050508; --bg-secondary: #0d0d18; --bg-tertiary: #1a1a2e;
    --accent-1: #6366f1; --accent-2: #a855f7; --accent-3: #06b6d4;
    --text-primary: #f8fafc; --text-secondary: #94a3b8; --text-muted: #475569;
    color-scheme: dark;
  }
  html { scroll-behavior: smooth; -webkit-font-smoothing: antialiased; }
  body { font-family: 'Inter', system-ui, sans-serif; background: var(--bg-primary); color: var(--text-primary); overflow-x: hidden; }
}

@layer components {
  .glass { background: rgba(255,255,255,0.03); backdrop-filter: blur(12px); border: 1px solid rgba(255,255,255,0.08); }
  .gradient-text { background: linear-gradient(135deg, var(--accent-1), var(--accent-2)); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; }
  .glow-border { box-shadow: 0 0 0 1px rgba(99,102,241,0.3), 0 0 30px rgba(99,102,241,0.1); }
}`;

const BASE_APP_CSS = `
.app { min-height: 100vh; background: var(--bg-primary); }
`;

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
    <div style={{ minHeight: '100vh', background: '#050508', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '2rem', fontFamily: 'sans-serif' }}>
      <div style={{ width: 64, height: 64, border: '3px solid #6366f1', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
      <style>{'@keyframes spin { to { transform: rotate(360deg) } }'}</style>
      <p style={{ color: '#fff', fontSize: '1.25rem', fontWeight: 600 }}>Building: ${label}{DOTS[tick]}</p>
      <p style={{ color: '#475569', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Generating interface</p>
    </div>
  );
}

export default App;`;
}

function makeBoilerplate(prompt: string): StreamFile[] {
  return [
    { path: "package.json",       content: makePkgJson("ai-project"),  provisional: true },
    { path: "index.html",         content: makeIndexHtml("AI Project"), provisional: true },
    { path: "src/main.jsx",       content: MAIN_JSX,                   provisional: true },
    { path: "vite.config.js",     content: VITE_CONFIG,                provisional: true },
    { path: "tailwind.config.js", content: TAILWIND_CONFIG,            provisional: true },
    { path: "postcss.config.js",  content: POSTCSS_CONFIG,             provisional: true },
    { path: "src/index.css",      content: INDEX_CSS,                  provisional: true },
    { path: "src/App.css",        content: BASE_APP_CSS,               provisional: true },
    { path: "src/App.jsx",        content: makeSpinnerApp(prompt),     provisional: true },
  ];
}

function makeFallbackComponent(spec: FileSpec): string {
  if (spec.path.endsWith(".css")) return BASE_APP_CSS;
  if (spec.path.endsWith(".js") && !spec.path.endsWith(".jsx")) {
    return `// ${spec.path}\nexport const data = [];\nexport default {};\n`;
  }
  const name = spec.path.split("/").pop()?.replace(/\.[^.]+$/, "") ?? "Component";
  return `import React from 'react';

function ${name}() {
  return (
    <section style={{ padding: '5rem 1.5rem', textAlign: 'center', background: 'var(--bg-secondary)' }}>
      <h2 style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--text-primary)' }}>${name}</h2>
      <p style={{ color: 'var(--text-secondary)', marginTop: '1rem' }}>${spec.description}</p>
    </section>
  );
}

export default ${name};
`;
}

function buildAppJsx(spec: ProjectSpec, generatedFiles: StreamFile[]): string {
  const components = generatedFiles
    .filter((f) => f.path.startsWith("src/components/") && f.path.endsWith(".jsx"))
    .map((f) => ({
      name: f.path.split("/").pop()!.replace(".jsx", ""),
      from: `./components/${f.path.split("/").pop()}`,
    }));

  const imports = [
    `import React from 'react';`,
    `import './App.css';`,
    ...components.map((c) => `import ${c.name} from '${c.from}';`),
  ].join("\n");

  const renders = components.map((c) => `      <${c.name} />`).join("\n");

  return `${imports}

function App() {
  return (
    <div className="app">
${renders}
    </div>
  );
}

export default App;
`;
}

// ═══════════════════════════════════════════════════════════════════════════════
// STAGE 1 — PLANNER
// ═══════════════════════════════════════════════════════════════════════════════

const PLANNER_SYSTEM = `You are a world-class React architect. Return ONLY raw JSON — no markdown, no backticks, no explanation.

Schema:
{
  "projectName": "PascalCase",
  "description": "one sentence",
  "globalContext": "5-6 sentences about design philosophy",
  "files": [
    { "path": "src/components/Hero.jsx", "description": "...", "dependencies": [], "is3D": true, "isAnimation": true }
  ]
}

RULES:
- NEVER include: package.json, index.html, src/main.jsx, vite.config.js, tailwind.config.js, postcss.config.js, src/index.css
- ALWAYS include: src/App.jsx, src/App.css
- Plan 8-12 component files minimum
- FILENAME RULE: identifiers MUST NOT start with a digit. Wrong: "3DShowcase.jsx" Right: "Showcase3D.jsx"
- Available packages (installed via npm, NOT CDN): react@18, framer-motion, lucide-react, tailwindcss, clsx
- NO TypeScript, NO "use client", NO react-router-dom, NO three.js, NO gsap (not installed)
- Arrow functions use => NOT = /> (the API gateway may corrupt these; write them correctly)
- NEVER use url() with data: URIs in CSS — use named gradients instead`;

export async function planProject(
  prompt: string,
  onPing?: () => void
): Promise<ProjectSpec | null> {
  for (let mi = 0; mi < PLAN_MODELS.length; mi++) {
    const model = PLAN_MODELS[mi];
    console.log(`🧠 [S1] ${modelLabel(model)} — planning (${mi + 1}/${PLAN_MODELS.length})`);
    await rateLimiter.waitForSlot(model, `plan/${modelLabel(model)}`, onPing);

    // Ping before the LLM call so client knows we're alive
    onPing?.();

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), PLAN_TIMEOUT_MS);

    try {
      const res = await nvidia.chat.completions.create(
        {
          model,
          temperature: 0.3,
          max_tokens: 3500,
          messages: [
            { role: "system", content: PLANNER_SYSTEM },
            { role: "user",   content: prompt },
          ],
        },
        { signal: controller.signal }
      );
      clearTimeout(timer);
      rateLimiter.recordSuccess(model);

      let raw = res.choices[0]?.message?.content ?? "";
      raw = fixRedactedTokens(raw);
      const text = stripMarkdown(raw);

      const s = text.indexOf("{");
      const e = text.lastIndexOf("}");
      if (s === -1 || e === -1) throw new Error("No JSON object in response");

      const parsed = JSON.parse(text.slice(s, e + 1)) as ProjectSpec;

      parsed.files = parsed.files
        .map((f) => ({
          path: f.path.replace(/^\/+/, ""),
          description: f.description || f.path,
          dependencies: Array.isArray(f.dependencies) ? f.dependencies : [],
          is3D:        false,
          isAnimation: f.isAnimation === true,
        }))
        .filter((f) => !BOILERPLATE_PATHS.has(f.path));

      const compFiles    = parsed.files.filter((f) => f.path.startsWith("src/components/"));
      const nonCompFiles = parsed.files.filter((f) => !f.path.startsWith("src/components/"));
      if (compFiles.length > MAX_COMPONENTS) {
        parsed.files = [...compFiles.slice(0, MAX_COMPONENTS), ...nonCompFiles];
      }

      if (!parsed.files.some((f) => f.path === "src/App.css"))
        parsed.files.push({ path: "src/App.css", description: "Global CSS", dependencies: [], is3D: false, isAnimation: false });
      if (!parsed.files.some((f) => f.path === "src/App.jsx"))
        parsed.files.push({ path: "src/App.jsx", description: "Root component", dependencies: [], is3D: false, isAnimation: false });

      parsed.designTokens = generateDesignTokens(parsed);

      console.log(`✅ [S1] Planned ${parsed.files.length} files: ${parsed.files.map((f) => f.path).join(", ")}`);
      return parsed;
    } catch (err: unknown) {
      clearTimeout(timer);
      rateLimiter.recordFailure(model);
      const status: number = (err as { status?: number })?.status ?? 0;
      if (status === 401 || status === 403) { console.error(`❌ [S1] Auth error`); return null; }
      const isLast = mi === PLAN_MODELS.length - 1;
      console.warn(`⚠️ [S1] ${modelLabel(model)} failed — ${isLast ? "exhausted" : "trying next"}`);
    }
  }
  return null;
}

// ═══════════════════════════════════════════════════════════════════════════════
// STAGE 2 — CODE GENERATOR
// ═══════════════════════════════════════════════════════════════════════════════

const AVAILABLE_PACKAGES = `react@18, react-dom@18, framer-motion@11, lucide-react@0.363, clsx@2, tailwindcss`;

const CODEGEN_SYSTEM_BASE = `You are an elite React engineer building production-grade websites.
Output ONLY raw file content. No markdown. No backticks. No explanations. No "use client". No TypeScript.
The VERY FIRST character you output must be the first character of the file.

━━━ OUTPUT INTEGRITY (NON-NEGOTIABLE) ━━━
1. NEVER write explanation after the closing brace or export default statement.
2. NEVER truncate — complete every JSX tag, every function body, every file.
3. NO TypeScript in .jsx files — no ": string", ": React.FC", "useState<string>", interface, etc.
4. Arrow functions use "=>" — never "= />" (proxy artifact).
5. CSS url() — NEVER use data: URIs. Use named gradients instead:
   background: linear-gradient(135deg, #6366f1, #a855f7)  ← CORRECT
   background-image: url("data:image/svg...")              ← FORBIDDEN
6. Every JSX open tag must have a matching close tag or be self-closed.
7. Complete the ENTIRE file in one response — no "// TODO", no "// rest here".

━━━ AVAILABLE PACKAGES (installed via npm) ━━━
${AVAILABLE_PACKAGES}

━━━ BANNED (not installed, will cause runtime errors) ━━━
react-router-dom, axios, three, @react-three/fiber, @react-three/drei, gsap,
react-intersection-observer, @tanstack/react-query, zustand, recharts,
preact, styled-components, @emotion/*, next/*`;

function makeCodegenSystem(spec: ProjectSpec, generatedSoFar: StreamFile[]): string {
  const siblings = generatedSoFar
    .filter((f) => !f.provisional)
    .map((f) => {
      const name = f.path.split("/").pop()?.replace(/\.[^.]+$/, "") ?? f.path;
      const rel  = f.path.replace("src/", "./");
      return `  - ${name} → '${rel}'`;
    })
    .join("\n") || "  (none yet)";

  return `${CODEGEN_SYSTEM_BASE}

━━━ PROJECT ━━━
Name: ${spec.projectName}
Description: ${spec.description}
Design vision: ${spec.globalContext ?? "ultra-dark premium SaaS with glassmorphism, indigo/purple palette, scroll animations"}

━━━ ALREADY GENERATED (safe to import) ━━━
${siblings}`;
}

const CSS_SYSTEM = `You are a CSS architect. Output ONLY raw CSS. No markdown. No backticks.
CRITICAL: @import rules first, then :root, then base, then components.
NEVER use url() with data: URIs — use named gradients only.`;

async function generateOneFile(
  fileSpec: FileSpec,
  spec: ProjectSpec,
  generatedSoFar: StreamFile[],
  onPing?: () => void,
): Promise<StreamFile> {
  const isDataFile  = fileSpec.path.startsWith("src/data/")  || fileSpec.path.startsWith("src/utils/");
  const isHookFile  = fileSpec.path.startsWith("src/hooks/");
  const isCssFile   = fileSpec.path === "src/App.css";
  const isNonAppCss = fileSpec.path.endsWith(".css") && !isCssFile;

  if (isNonAppCss) {
    return { path: fileSpec.path, content: `/* ${fileSpec.path} handled by App.css */\n` };
  }

  let system: string;
  let models: readonly string[];

  if (isCssFile) {
    system = CSS_SYSTEM;
    models = CSS_MODELS;
  } else if (isDataFile || isHookFile) {
    system = `You are a JavaScript expert. Output ONLY raw JS. No markdown. No backticks. No TypeScript.
Export named exports OR a default export. Use REAL data — no lorem ipsum. At least 4-6 real items.`;
    models = CODEGEN_MODELS;
  } else {
    system = makeCodegenSystem(spec, generatedSoFar);
    models = CODEGEN_MODELS;
  }

  const userPrompt = `Write the COMPLETE file: ${fileSpec.path}
Purpose: ${fileSpec.description}
${fileSpec.isAnimation ? "REQUIRED: Include scroll-triggered animations with framer-motion." : ""}
No TypeScript annotations. No prose after export default. Start writing now.`;

  for (let mi = 0; mi < models.length; mi++) {
    const model = models[mi];

    for (let attempt = 0; attempt < MAX_FILE_RETRIES; attempt++) {
      await rateLimiter.waitForSlot(model, `${modelLabel(model)}/${fileSpec.path}`, onPing);

      // Ping right before the LLM call — client knows we're alive
      onPing?.();

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), FILE_TIMEOUT_MS);

      try {
        console.log(`  ⚡ [S2] ${modelLabel(model)} — ${fileSpec.path} (model ${mi + 1}/${models.length}, attempt ${attempt + 1}/${MAX_FILE_RETRIES})`);

        const res = await nvidia.chat.completions.create(
          {
            model,
            temperature: 0.3 + attempt * 0.05,
            max_tokens:  3500,
            messages: [
              { role: "system", content: system },
              { role: "user",   content: userPrompt },
            ],
          },
          { signal: controller.signal }
        );

        clearTimeout(timer);
        rateLimiter.recordSuccess(model);

        let raw = res.choices[0]?.message?.content ?? "";
        raw = fixRedactedTokens(raw);

        let content = stripMarkdown(raw);
        if (!content || content.length < 50) throw new Error(`Response too short: ${content.length} chars`);

        content = cleanLLMOutput(content, fileSpec.path);

        if (content.length > MAX_FILE_CHARS) {
          console.warn(`⚠️  [S2] ${fileSpec.path} oversized (${content.length} chars) — truncating to ${MAX_FILE_CHARS}`);
          const truncated      = content.slice(0, MAX_FILE_CHARS);
          const lastCleanBrace = truncated.lastIndexOf("\n}");
          content = lastCleanBrace > MAX_FILE_CHARS * 0.6
            ? truncated.slice(0, lastCleanBrace + 2)
            : truncated;
        }

        if (fileSpec.path.endsWith(".jsx")) {
          content = addJsxExtensions(content);
          content = injectReactImport(content);
          const componentName = fileSpec.path.split("/").pop()?.replace(".jsx", "") ?? "Component";
          content = ensureDefaultExport(content, componentName);
        }

        if (isDataFile && !content.includes("export default") && !content.includes("export const")) {
          content = `export default ${content};\n`;
        }

        console.log(`  ✅ [S2] ${fileSpec.path} (${content.length} chars)`);
        return { path: fileSpec.path, content };

      } catch (err: unknown) {
        clearTimeout(timer);
        rateLimiter.recordFailure(model);
        const status: number = (err as { status?: number })?.status ?? 0;
        if (status === 401 || status === 403) {
          return { path: fileSpec.path, content: makeFallbackComponent(fileSpec) };
        }
        if (status === 410 || status === 404) break;
        if (attempt === MAX_FILE_RETRIES - 1) break;
        console.warn(`  ⚠️ [S2] ${fileSpec.path} attempt ${attempt + 1} failed — retrying`);
        await sleepWithPing(1000 * (attempt + 1), onPing);
      }
    }
  }

  console.error(`  ❌ [S2] ${fileSpec.path} — all models failed, using fallback`);
  return { path: fileSpec.path, content: makeFallbackComponent(fileSpec) };
}

// ═══════════════════════════════════════════════════════════════════════════════
// STAGE 3 — FIX PASS
// ═══════════════════════════════════════════════════════════════════════════════

async function fixWithPhi(file: StreamFile, onPing?: () => void): Promise<StreamFile> {
  console.log(`  🔧 [S3-fix] phi — fixing ${file.path}`);
  await rateLimiter.waitForSlot(FIX_MODEL, `phi/${file.path}`, onPing);
  onPing?.();

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FIX_TIMEOUT_MS);

  try {
    const res = await nvidia.chat.completions.create(
      {
        model: FIX_MODEL,
        temperature: 0.1,
        max_tokens: 6000,
        messages: [
          {
            role: "system",
            content: `You are a JSX/JS syntax fixer. Return ONLY the corrected file — no markdown, no backticks, no "use client", no TypeScript.
Fix ONLY: unclosed JSX tags, missing export default, missing React import, unbalanced braces, duplicate declarations.
Preserve ALL logic, styling, and component names. NEVER add TypeScript annotations.`,
          },
          { role: "user", content: `Fix this file (${file.path}):\n\n${file.content}` },
        ],
      },
      { signal: controller.signal }
    );
    clearTimeout(timer);

    let raw = res.choices[0]?.message?.content ?? file.content;
    raw = fixRedactedTokens(raw);
    let fixed = stripMarkdown(raw);
    fixed = cleanLLMOutput(fixed, file.path);

    console.log(`  ✅ [S3-fix] Fixed ${file.path}`);
    return { ...file, content: fixed, lastFixed: true };
  } catch (err: unknown) {
    clearTimeout(timer);
    const name = (err as { name?: string })?.name;
    console.warn(`  ⚠️ [S3-fix] phi ${name === "AbortError" ? "timed out" : "failed"} for ${file.path} — keeping original`);
    return file;
  }
}

function injectMissingReactImports(files: StreamFile[]): StreamFile[] {
  return files.map((file) => {
    if (!file.path.endsWith(".jsx")) return file;
    if (file.content.includes("import React")) return file;
    if (file.content.includes("<") && file.content.includes(">")) {
      return { ...file, content: `import React from 'react';\n${file.content}` };
    }
    return file;
  });
}

async function runFixPass(
  files: StreamFile[],
  onPing?: () => void,
  registry?: Map<string, string>
): Promise<StreamFile[]> {

  let result: StreamFile[] = files;

  for (let pass = 1; pass <= 2; pass++) {
    console.log(`\n🔁 [S3-fix] Pass ${pass}/2`);

    result = autoFixStreamFiles(result, registry);
    result = runSemanticValidation(result);
    result = injectMissingReactImports(result);

    const errors = checkSyntax(result);

    if (errors.length === 0) {
      console.log(`✅ [S3-fix] All files passed on pass ${pass}`);
      return result;
    }

    const brokenPaths = new Set(errors.map((e) => e.path));
    console.log(
      `🔧 [S3-fix] ${brokenPaths.size} file(s) need phi (pass ${pass}): ${[
        ...brokenPaths,
      ].join(", ")}`
    );

    errors.forEach((e) =>
      console.warn(`  ⚠️  ${e.path}: ${e.message}`)
    );

    const fixed: StreamFile[] = [];

    for (const file of result) {
      if (brokenPaths.has(file.path)) {
        fixed.push(await fixWithPhi(file, onPing));
      } else {
        fixed.push(file);
      }
    }

    result = fixed;
  }

  const remaining = checkSyntax(result);

  if (remaining.length > 0) {
    console.warn(
      `⚠️ [S3-fix] ${remaining.length} error(s) remain after 2 passes — shipping best effort`
    );
    remaining.forEach((e) =>
      console.warn(`  ❌ ${e.path}: ${e.message}`)
    );
  }

  return result;
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN EXPORT — PIPELINE v8.5
// ═══════════════════════════════════════════════════════════════════════════════

export async function streamProjectPipeline(
  prompt: string,
  callbacks: PipelineCallbacks
): Promise<void> {
  const { onFile, onDone, onError, onLog, onMetric, onPing } = callbacks;

  const startTime = globalThis.performance.now();

  const log       = (msg: string) => { console.log(msg); onLog?.(msg); };
  const safeEmit  = async (f: StreamFile) => { try { await onFile(f); } catch {} };
  const safeDone  = () => { try { onDone(); } catch {} };
  const safeError = (msg: string) => { try { onError?.(msg); } catch {} };

  log("🚀 ════════════════════════════════════════════════════════════════");
  log(`🚀 PIPELINE v8.5 — "Production Ultra"`);
  log(`🚀 Prompt: "${prompt.slice(0, 80)}"`);
  log("🚀 ════════════════════════════════════════════════════════════════");

  try {
    // S0: Boilerplate
    log("📦 [S0] Sending boilerplate...");
    for (const f of makeBoilerplate(prompt)) await safeEmit(f);
    log("✅ [S0] Boilerplate emitted — WebContainer initializing");

    // S1: Plan
    log("🧠 [S1] Planning project architecture...");
    const spec = await planProject(prompt, onPing);
    if (!spec || spec.files.length === 0) {
      log("⚠️  [S1] Planning failed — emitting fallback app");
      await safeEmit({
        path: "src/App.jsx",
        content: makeFallbackComponent({
          path: "src/App.jsx", description: prompt,
          dependencies: [], is3D: false, isAnimation: false,
        }),
      });
      safeDone();
      return;
    }
    log(`✅ [S1] Planned ${spec.files.length} files: ${spec.files.map((f) => f.path).join(", ")}`);

    // S2: Generate (data → hooks → components)
    const dataSpecs      = spec.files.filter((f) => f.path.startsWith("src/data/") || f.path.startsWith("src/utils/"));
    const hookSpecs      = spec.files.filter((f) => f.path.startsWith("src/hooks/"));
    const componentSpecs = spec.files.filter((f) => f.path.startsWith("src/components/"));
    const appCssSpec     = spec.files.find((f) => f.path === "src/App.css");

    const orderedSpecs = [...dataSpecs, ...hookSpecs, ...componentSpecs];
    log(`\n📝 [S2] Generating ${orderedSpecs.length} files (data → hooks → components)`);

    const generated: StreamFile[] = [];

    for (let i = 0; i < orderedSpecs.length; i++) {
      const result = await generateOneFile(orderedSpecs[i], spec, generated, onPing);
      generated.push(result);
      log(`  📄 [S2] ${result.path} (${i + 1}/${orderedSpecs.length})`);
      await safeEmit({ path: result.path, content: result.content, provisional: false });
    }

    // App.css
    if (appCssSpec) {
      const r = await generateOneFile(appCssSpec, spec, generated, onPing);
      generated.push(r);
      await safeEmit({ path: "src/App.css", content: r.content, provisional: false });
      log("  📄 src/App.css");
    }

    // App.jsx — deterministic assembly
    log("  🔧 [S2] App.jsx — assembling deterministically");
    const appJsxContent = buildAppJsx(spec, generated);
    generated.push({ path: "src/App.jsx", content: appJsxContent });
    await safeEmit({ path: "src/App.jsx", content: appJsxContent, provisional: false });
    log("  📄 src/App.jsx ✓");

    // S3: Fix pass
    log(`\n🔧 [S3-fix] Validating and fixing ${generated.length} files...`);
    const registry = buildComponentRegistry(generated);

const fixedGenerated = await runFixPass(generated, onPing, registry);

    // Emit only changed files after fix pass
    for (const f of fixedGenerated) {
      const original = generated.find((g) => g.path === f.path);
      if (!original || original.content !== f.content) {
        await safeEmit({ path: f.path, content: f.content, provisional: false, lastFixed: true });
        log(`  🔁 [S3-fix] Updated ${f.path}`);
      }
    }

    const totalTime  = ((globalThis.performance.now() - startTime) / 1000).toFixed(1);
    const totalFiles = fixedGenerated.length + makeBoilerplate("").length;
    log("\n✅ ════════════════════════════════════════════════════════════════");
    log(`✅ PIPELINE v8.5 DONE — ${totalFiles} files in ${totalTime}s`);
    log("✅ ════════════════════════════════════════════════════════════════\n");

    onMetric?.("totalTime",  parseFloat(totalTime));
    onMetric?.("totalFiles", totalFiles);
    safeDone();
  } catch (err: unknown) {
    const msg = (err as Error)?.message ?? "Generation failed unexpectedly";
    console.error("❌ [Pipeline] Unhandled crash:", msg);
    safeError(msg);
  }
}