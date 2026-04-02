// src/lib/ai/llm/deepseek-generator.ts
//
// Stage 3 — deepseek-v3.2 (NVIDIA catalog)
//
// FIXES:
//  - Per-request 90s AbortController timeout (prevents 30min hangs)
//  - Concurrency cap via semaphore (max 5 parallel, prevents NVIDIA queue saturation)
//  - System prompt aligned with stream-pipeline.ts (design system, prop contract, CSS stubs)
//  - Retry with backoff on timeout/5xx before falling back to stub
//  - CSS files short-circuited (no LLM call)
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
  dependencies?: string[];
}

export interface ProjectSpec {
  projectName: string;
  description: string;
  globalContext: string;
  files: FileSpec[];
}

// ─────────────────────────────────────────────
// SEMAPHORE — max concurrent LLM calls
// Prevents NVIDIA from queuing 20+ requests and
// causing cascade timeouts.
// ─────────────────────────────────────────────

const MAX_CONCURRENT = 5;
const PER_REQUEST_TIMEOUT_MS = 90_000; // 90s per file

class Semaphore {
  private queue: Array<() => void> = [];
  private running = 0;

  constructor(private limit: number) {}

  async acquire(): Promise<void> {
    if (this.running < this.limit) {
      this.running++;
      return;
    }
    await new Promise<void>((resolve) => this.queue.push(resolve));
    this.running++;
  }

  release(): void {
    this.running--;
    const next = this.queue.shift();
    if (next) next();
  }
}

const sem = new Semaphore(MAX_CONCURRENT);

// ─────────────────────────────────────────────
// DESIGN CONSTANTS (aligned with stream-pipeline.ts)
// ─────────────────────────────────────────────

const DESIGN_RULES = `MANDATORY DESIGN:
• Dark: bg-[#0f0f13] page, bg-[#1a1a24]/bg-white/5 cards
• Glass: bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6
• Gradient text: bg-gradient-to-r from-indigo-400 via-purple-400 to-cyan-400 bg-clip-text text-transparent
• Primary btn: bg-gradient-to-r from-indigo-600 to-purple-600 hover:opacity-90 rounded-xl px-6 py-3 font-semibold text-white hover:scale-105
• Ghost btn: border border-white/20 hover:border-white/40 rounded-xl px-6 py-3 text-white/80 hover:text-white
• Sections: py-24 px-6. Grid: grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8
• framer-motion: whileInView={{opacity:1,y:0}} initial={{opacity:0,y:30}} transition={{duration:0.6}} viewport={{once:true}}
• Hover: hover:scale-105 transition-all duration-200
• NO flat design. Premium, modern, polished.`;

const PROP_CONTRACT_RULES = `CRITICAL PROP CONTRACT:
List-item components (cards, rows, tiles) MUST use a single object prop:
  ✅ function TestimonialCard({ testimonial }) { const { name, role } = testimonial; }
     Parent: <TestimonialCard testimonial={item} key={i} />
  ❌ function TestimonialCard({ name, role, quote }) { ... }
Never spread individual props. Always add: if (!propName) return null; at top of function body.`;

// ─────────────────────────────────────────────
// BOILERPLATE SHORT-CIRCUITS (no LLM)
// ─────────────────────────────────────────────

const BOILERPLATE_GENERATORS: Record<string, (spec: ProjectSpec) => string> = {
  "src/main.jsx": () => makeMainJsx(),
  "vite.config.js": () => makeViteConfig(),
  "package.json": (spec) => makePackageJson(spec.projectName),
  "index.html": (spec) => makeIndexHtml(spec.projectName),
  "tailwind.config.js": () => makeTailwindConfig(),
  "postcss.config.js": () => makePostcssConfig(),
};

// ─────────────────────────────────────────────
// GENERATE ONE FILE — with timeout + retry
// ─────────────────────────────────────────────

export async function generateOneFile(
  spec: ProjectSpec,
  fileSpec: FileSpec,
  allPaths: string[],
  retries = 2
): Promise<AIFileNode> {
  // Short-circuit boilerplate
  const boilerplateFn = BOILERPLATE_GENERATORS[fileSpec.path];
  if (boilerplateFn) {
    return { path: fileSpec.path, content: boilerplateFn(spec), type: "file" };
  }

  // Short-circuit CSS (stub only — LLM wastes tokens on CSS)
  if (fileSpec.path.endsWith(".css") && fileSpec.path !== "src/App.css") {
    return { path: fileSpec.path, content: makeCssStub(fileSpec.path), type: "file" };
  }

  const deps = Array.isArray(fileSpec.dependencies) ? fileSpec.dependencies : [];

  const otherComponents = allPaths
    .filter((p) => p !== fileSpec.path && (p.endsWith(".jsx") || p.endsWith(".tsx")))
    .map((p) => `  - ${p}`)
    .join("\n");

  const systemPrompt = `=== ROLE ===
Senior React engineer. Output ONLY raw file content. No markdown. No backticks.
Start with the first line of code.

=== DESIGN SYSTEM ===
Project: ${spec.projectName} — ${spec.description}
${spec.globalContext}
${DESIGN_RULES}

=== LIBRARIES & RULES ===
Available: react@18, framer-motion, lucide-react, clsx, react-hot-toast, tailwindcss
Forbidden: react-router-dom, axios, fetch(), TypeScript, "use client" directive
• export default at the BOTTOM of every .jsx file
• All relative imports MUST include extension: ./Hero.jsx NOT ./Hero
• Tailwind for ALL styling. Realistic copy. No TODOs, no placeholders.
${PROP_CONTRACT_RULES}

=== IMPORTABLE SIBLINGS ===
${otherComponents || "  (none)"}`;

  const userPrompt = `File: ${fileSpec.path}
Purpose: ${fileSpec.description}
Imports needed: ${deps.join(", ") || "none"}

Write the complete file now.`;

  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), PER_REQUEST_TIMEOUT_MS);

    await sem.acquire();

    try {
      console.log(`  ⚡ [S3] deepseek-v3.2 — ${fileSpec.path} (attempt ${attempt + 1})`);

      const res = await client.chat.completions.create(
        {
          model: "deepseek-ai/deepseek-v3.2",
          temperature: attempt === 0 ? 0.2 : 0.35,
          max_tokens: 4500,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
        },
        { signal: controller.signal }
      );

      clearTimeout(timeoutId);

      let content = (res.choices[0]?.message?.content ?? "")
        .replace(/^```(?:jsx?|javascript|css|html|json)?\s*/gim, "")
        .replace(/^```\s*$/gim, "")
        // Strip "use client" — this is a Vite/WebContainer app, not Next.js
        .replace(/^["']use client["'];\s*\n*/m, "")
        .trim();

      if (!content || content.length < 40) {
        throw new Error(`Response too short (${content.length} chars)`);
      }

      content = fixExtensionlessImports(content, allPaths);

      // Ensure export default exists for JSX files
      if (fileSpec.path.endsWith(".jsx") && !content.includes("export default")) {
        const name = fileSpec.path.split("/").pop()?.replace(".jsx", "") ?? "Component";
        content += content.includes(`function ${name}`)
          ? `\n\nexport default ${name};\n`
          : `\n\nexport default function ${name}Fallback() {\n  return <div className="py-20 text-center text-white">${name}</div>;\n}\n`;
      }

      console.log(`  ✅ [S3] ${fileSpec.path} (${content.length} chars)`);
      return { path: fileSpec.path, content, type: "file" };

    } catch (err: any) {
      clearTimeout(timeoutId);

      const isTimeout = err?.name === "AbortError" || err?.message?.includes("abort");
      const isRetryable = isTimeout || err?.status === 429 || err?.status >= 500;

      if (attempt < retries && isRetryable) {
        const backoff = 1000 * Math.pow(2, attempt); // 1s, 2s
        console.warn(`  ⚠️ [S3] ${fileSpec.path} attempt ${attempt + 1} failed (${isTimeout ? "timeout" : err?.status}), retrying in ${backoff}ms`);
        await new Promise((r) => setTimeout(r, backoff));
        continue;
      }

      console.error(`  ❌ [S3] ${fileSpec.path} failed after ${attempt + 1} attempts:`, err?.message ?? err);
      return { path: fileSpec.path, content: makeFallbackComponent(fileSpec), type: "file" };

    } finally {
      sem.release();
    }
  }

  // Should never reach here
  return { path: fileSpec.path, content: makeFallbackComponent(fileSpec), type: "file" };
}

// ─────────────────────────────────────────────
// Fix extensionless relative imports
// ─────────────────────────────────────────────

function fixExtensionlessImports(content: string, allPaths: string[]): string {
  const jsxPaths = new Set(
    allPaths.filter((p) => p.endsWith(".jsx")).map((p) => p.replace(/\.jsx$/, ""))
  );

  return content.replace(
    /from\s+(['"])(\.\.?\/[^'"]+)(['"])/g,
    (match, q1, importPath: string, q2) => {
      if (/\.\w+$/.test(importPath)) return match;
      const normalized = importPath.replace(/^\.\.?\//, "");
      const hasMatch = Array.from(jsxPaths).some(
        (p) => p.endsWith(normalized) || p.endsWith("/" + normalized)
      );
      return hasMatch ? `from ${q1}${importPath}.jsx${q2}` : match;
    }
  );
}

// ─────────────────────────────────────────────
// Parallel generation entry point
// Uses semaphore internally — safe to call with large file lists
// ─────────────────────────────────────────────

export async function generateFilesInParallel(
  spec: ProjectSpec
): Promise<AIFileNode[]> {
  const allPaths = spec.files.map((f) => f.path);

  console.log(`⚡ [S3] Generating ${spec.files.length} files (max ${MAX_CONCURRENT} concurrent, ${PER_REQUEST_TIMEOUT_MS / 1000}s timeout each)`);

  const results = await Promise.all(
    spec.files.map((fileSpec) => generateOneFile(spec, fileSpec, allPaths))
  );

  console.log(`✅ [S3] All ${results.length} files generated`);
  return results;
}

// ─────────────────────────────────────────────
// Edit helper
// ─────────────────────────────────────────────

export async function rewriteFilesWithDeepseek(
  instructions: string,
  filesToEdit: AIFileNode[]
): Promise<AIFileNode[]> {
  console.log(`✏️ [S3 EDIT] Rewriting ${filesToEdit.length} file(s)`);

  const results = await Promise.all(
    filesToEdit.map(async (file): Promise<AIFileNode> => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), PER_REQUEST_TIMEOUT_MS);

      await sem.acquire();

      try {
        const res = await client.chat.completions.create(
          {
            model: "deepseek-ai/deepseek-v3.2",
            temperature: 0.2,
            max_tokens: 4500,
            messages: [
              {
                role: "system",
                content: `You are a React engineer. Apply the requested edit to the file.
Return ONLY the complete updated file — no markdown, no backticks, no explanation.
Do NOT add "use client" directives. Preserve all unrelated logic.`,
              },
              {
                role: "user",
                content: `Edit: "${instructions}"\n\nFile (${file.path}):\n${file.content}`,
              },
            ],
          },
          { signal: controller.signal }
        );

        clearTimeout(timeoutId);

        let content = (res.choices[0]?.message?.content ?? file.content)
          .replace(/^```(?:jsx?|javascript|css)?\s*/gim, "")
          .replace(/^```\s*$/gim, "")
          .replace(/^["']use client["'];\s*\n*/m, "")
          .trim();

        console.log(`  ✅ [S3 EDIT] Rewrote ${file.path}`);
        return { ...file, content };

      } catch (err) {
        clearTimeout(timeoutId);
        console.error(`  ❌ [S3 EDIT] ${file.path} failed:`, err);
        return file;
      } finally {
        sem.release();
      }
    })
  );

  return results;
}

// ─────────────────────────────────────────────
// Boilerplate generators
// ─────────────────────────────────────────────

function makePackageJson(projectName: string): string {
  return JSON.stringify(
    {
      name: projectName.toLowerCase().replace(/[^a-z0-9-]/g, "-") || "ai-app",
      private: true,
      version: "0.0.0",
      type: "module",
      scripts: { dev: "vite --host", build: "vite build", preview: "vite preview" },
      dependencies: {
        react: "^18.2.0",
        "react-dom": "^18.2.0",
        "framer-motion": "^11.0.8",
        "lucide-react": "^0.363.0",
        clsx: "^2.1.0",
        "react-hot-toast": "^2.4.1",
      },
      devDependencies: {
        vite: "^5.2.6",
        "@vitejs/plugin-react": "^4.2.1",
        tailwindcss: "^3.4.3",
        postcss: "^8.4.38",
        autoprefixer: "^10.4.19",
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

function makeMainJsx(): string {
  return `import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);`;
}

function makeViteConfig(): string {
  return `import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({ plugins: [react()], server: { host: true } });`;
}

function makeTailwindConfig(): string {
  return `/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      fontFamily: { sans: ['Inter', 'system-ui', 'sans-serif'] },
      colors: {
        primary: { DEFAULT: '#6366f1', dark: '#4f46e5', light: '#818cf8' },
        secondary: '#8b5cf6', accent: '#06b6d4',
      },
    },
  },
  plugins: [],
};`;
}

function makePostcssConfig(): string {
  return `export default { plugins: { tailwindcss: {}, autoprefixer: {} } };`;
}

function makeCssStub(cssPath: string): string {
  const name = cssPath.split("/").pop()!.replace(".css", "").toLowerCase();
  return `/* ${cssPath} — auto-stub */\n.${name} { box-sizing: border-box; }\n.${name} * { box-sizing: border-box; }\n`;
}

function makeFallbackComponent(fileSpec: FileSpec): string {
  if (fileSpec.path.endsWith(".css")) return makeCssStub(fileSpec.path);
  const name = fileSpec.path.split("/").pop()?.replace(".jsx", "") ?? "Component";
  return `import React from 'react';

function ${name}() {
  return (
    <section className="py-20 px-6">
      <div className="max-w-4xl mx-auto text-center">
        <h2 className="text-3xl font-bold text-white mb-4">${name}</h2>
        <p className="text-slate-400">${fileSpec.description || name}</p>
      </div>
    </section>
  );
}

export default ${name};
`;
}