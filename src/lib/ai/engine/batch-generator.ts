// src/lib/ai/engine/batch-generator.ts
// v19.0 — FILE‑BY‑FILE GENERATOR (replaces broken batch JSON approach)
//
// ROOT CAUSE OF OLD FAILURE:
//   Old approach: ask LLM to return ALL files as ONE JSON array with code as string values.
//   Problem:      LLM cannot reliably JSON-escape multiline code → truncation → parse failure → fallback.
//   Fix:          ONE LLM call per file. Raw code output. No JSON encoding. No parsing failure modes.
//
// This module is kept as a named export for backward compat with stream-pipeline.ts imports.
// The real generation logic is self-contained here, using the CODEGEN_MODELS roster.

import OpenAI from "openai";
import { ProjectPlan, ComponentSpec } from "./project-planner-v2";
import { DesignSystem } from "./design-system";
// ─── Types ────────────────────────────────────────────────────────────────────

export interface StreamFile {
  path:    string;
  content: string;
}


// ─── Constants ────────────────────────────────────────────────────────────────

const NVIDIA_BASE_URL = "https://integrate.api.nvidia.com/v1";

// Code generation model roster — ordered by preference
// qwen3-coder is the strongest, devstral as fallback, llama-3.3 as last resort
const CODEGEN_MODELS = [
  "qwen/qwen3-coder-480b-a35b-instruct",
  "mistralai/devstral-2-123b-instruct-2512",
  "meta/llama-3.3-70b-instruct",
] as const;

type CodegenModel = typeof CODEGEN_MODELS[number];

const MAX_FILE_RETRIES   = 3;
const MAX_FILE_CHARS     = 10_000;
const MIN_FILE_CHARS     = 50;
const CODEGEN_MAX_TOKENS = 4096;
const PING_INTERVAL_MS   = 7_000;
const PARALLEL_BATCH     = 3;      // how many files to generate concurrently

// Packages that must never appear in generated code
const BANNED_PACKAGES = [
  "framer-motion", "lucide-react", "react-router-dom", "react-router",
  "axios", "three", "@react-three/fiber", "@react-three/drei",
  "gsap", "zustand", "recharts", "preact", "styled-components",
  "@emotion/react", "@emotion/styled", "clsx", "classnames",
  "@tanstack/react-query", "next", "next/image", "next/link",
  "next/router", "next/navigation",
];

// ─── NVIDIA client ────────────────────────────────────────────────────────────

const client = new OpenAI({
  apiKey:  process.env.NVIDIA_API_KEY!,
  baseURL: NVIDIA_BASE_URL,
});

// ─── Model health tracking ────────────────────────────────────────────────────

const modelFailures = new Map<string, number>();
const FAILURE_THRESHOLD = 3;

function recordModelSuccess(model: string): void {
  modelFailures.delete(model);
}

function recordModelFailure(model: string): void {
  modelFailures.set(model, (modelFailures.get(model) ?? 0) + 1);
}

function isModelHealthy(model: string): boolean {
  return (modelFailures.get(model) ?? 0) < FAILURE_THRESHOLD;
}

function getHealthyModels(): CodegenModel[] {
  return CODEGEN_MODELS.filter(isModelHealthy);
}

// ─── Simple rate limiter ──────────────────────────────────────────────────────

const rlTimestamps: number[] = [];
const RL_MAX_RPM  = 5;
const RL_WINDOW   = 62_000;

async function waitForRateLimit(label: string, onPing?: () => void): Promise<void> {
  const now = Date.now();
  const trimmed = rlTimestamps.filter((t) => now - t < RL_WINDOW);
  rlTimestamps.length = 0;
  rlTimestamps.push(...trimmed);

  if (rlTimestamps.length < RL_MAX_RPM) {
    rlTimestamps.push(now);
    return;
  }

  const waitMs = RL_WINDOW - (now - rlTimestamps[0]) + 300;
  console.log(`[batch-generator][RL] Waiting ${(waitMs / 1000).toFixed(1)}s for ${label}`);
  await sleepWithPing(waitMs, onPing);
  await waitForRateLimit(label, onPing);
}

// ─── Utilities ────────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function sleepWithPing(ms: number, onPing?: () => void): Promise<void> {
  if (!onPing || ms <= PING_INTERVAL_MS) return sleep(ms);
  const end = Date.now() + ms;
  while (Date.now() < end) {
    await sleep(Math.min(PING_INTERVAL_MS, end - Date.now()));
    if (Date.now() < end) onPing();
  }
}

function backoffMs(attempt: number): number {
  return Math.min(1200 * Math.pow(2, attempt), 20_000);
}

function mlabel(model: string): string {
  return model.split("/")[1] ?? model;
}

/**
 * Strip markdown fences. Models often wrap output in ```jsx even when instructed not to.
 */
function stripMarkdown(text: string): string {
  return text
    .replace(/^```(?:jsx?|javascript|typescript|tsx?|json)?\s*/gim, "")
    .replace(/^```\s*$/gim, "")
    .replace(/^["']use (?:client|server)["'];\s*\n*/m, "")
    .trim();
}

/**
 * Fix common token corruption from NVIDIA models.
 * e.g. ") = />" → ") =>" (arrow function token mangled)
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
 * Remove imports of banned packages from generated code.
 */
function stripBannedImports(content: string): string {
  const lines: string[] = [];

  for (const line of content.split("\n")) {
    const t = line.trim();
    if (!t.startsWith("import ")) { lines.push(line); continue; }

    // Always remove CSS imports
    if (/['"][^'"]*\.css['"]/.test(t)) continue;

    const fromMatch = t.match(/from\s+['"]([^'"]+)['"]/);
    if (!fromMatch) { lines.push(line); continue; }

    const pkg    = fromMatch[1];
    const banned = BANNED_PACKAGES.some((b) => pkg === b || pkg.startsWith(b + "/"));
    if (banned) continue;

    lines.push(line);
  }

  let result = lines.join("\n");

  // Convert react-router <Link> to <a> if it slipped through
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
 * Inject React import if JSX is present but React is not imported.
 */
function ensureReactImport(content: string): string {
  if (/\bimport\s+React\b/.test(content)) return content;
  if (/<[A-Za-z]/.test(content)) return `import React from 'react';\n${content}`;
  return content;
}

/**
 * Ensure exactly one export default in a JSX file.
 */
function ensureDefaultExport(content: string, componentName: string): string {
  const matches = (content.match(/\bexport\s+default\b/g) ?? []).length;

  if (matches === 1) return content;

  if (matches === 0) {
    const safe = componentName.replace(/[^a-zA-Z0-9_$]/g, "").replace(/^\d+/, "") || "Component";
    return `${content}\n\nexport default ${safe};\n`;
  }

  // Multiple exports — remove all but last
  let count = 0;
  return content.replace(/\bexport\s+default\b/g, (match) => {
    count++;
    return count < matches ? "" : match;
  });
}

/**
 * Remove duplicate import statements (identical lines).
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
 * Normalize whitespace and add trailing newline.
 */
function cleanOutput(content: string): string {
  return content
    .replace(/[ \t]+$/gm, "")
    .replace(/\n{4,}/g, "\n\n\n")
    .trimEnd() + "\n";
}

/**
 * Create a minimal safe fallback component for a file that failed generation.
 */
function makeFallback(spec: ComponentSpec): StreamFile {
  const rawName  = spec.path.split("/").pop()?.replace(/\.[^.]+$/, "") ?? "Component";
  const safeName = rawName.replace(/[^a-zA-Z0-9_$]/g, "").replace(/^\d+/, "") || "Component";
  const compName = safeName.charAt(0).toUpperCase() + safeName.slice(1);

  const content = cleanOutput(
    `import React from 'react';

function ${compName}() {
  return (
    <section style={{
      padding: '4rem 2rem',
      textAlign: 'center',
      background: '#0a0a0f',
      minHeight: '200px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    }}>
      <div>
        <h2 style={{ fontSize: '1.75rem', fontWeight: 700, color: '#f1f5f9', margin: 0 }}>
          ${compName}
        </h2>
        <p style={{ color: '#64748b', marginTop: '0.75rem', fontSize: '0.95rem', margin: '0.75rem 0 0' }}>
          ${spec.description}
        </p>
      </div>
    </section>
  );
}

export default ${compName};`
  );

  return { path: spec.path, content };
}

// ─── Prompt builders ──────────────────────────────────────────────────────────

function buildSystemPrompt(plan: ProjectPlan, generatedSoFar: StreamFile[]): string {
  const ds = plan.designSystem;

  const generatedList = generatedSoFar
    .filter((f) => f.path.endsWith(".jsx") || f.path.endsWith(".js"))
    .map((f) => {
      const name    = f.path.split("/").pop()!.replace(/\.[^.]+$/, "");
      const relPath = "./" + f.path.replace(/^src\//, "").replace(/\.[^.]+$/, "") + ".jsx";
      return `  - ${name} → '${relPath}'`;
    })
    .join("\n") || "  (none yet)";

  return `You are an elite React engineer building production-grade websites.
Output ONLY raw file content — the VERY FIRST character of your response must be the first character of the file.
NO markdown. NO backticks. NO explanations. NO preamble. NO TypeScript.

━━━ PROJECT ━━━
Name:    ${plan.projectName}
Purpose: ${plan.description}
Colors:  primary=${ds.colors.primary}, bg=${ds.colors.bg}, text=${ds.colors.text}
Font:    ${ds.fonts}

━━━ ALREADY GENERATED (available to import) ━━━
${generatedList}

━━━ ABSOLUTE RULES (every single one is mandatory) ━━━
1. ALL styling MUST use inline style={{}} — NO className, NO CSS files, NO <style> tags, NO Tailwind
2. ONLY allowed imports: react, react-dom, and relative .jsx/.js paths within this project
3. BANNED packages (NEVER import these):
   ${BANNED_PACKAGES.join(", ")}
4. ICONS: use inline SVG <svg> elements ONLY — do NOT import from any icon library
5. Every JSX open tag must have matching close tag or self-close
6. Every .jsx file must have EXACTLY ONE "export default" statement
7. Every .jsx file must return valid JSX from its default export function
8. NO TypeScript: no ": string", no ": React.FC", no "useState<T>", no interface, no type alias
9. Arrow functions: "=>" only — NEVER write "= />" (that is corrupted output)
10. NO console.log, NO TODO comments, NO placeholder comments, NO truncation
11. Write COMPLETE files — never use "..." or "// rest of component" shortcuts
12. Use real content — no "lorem ipsum", no placeholder text

━━━ AVAILABLE PACKAGES ━━━
react@18, react-dom@18 (nothing else)`;
}

function buildFileUserPrompt(
  spec:           ComponentSpec,
  plan:           ProjectPlan,
  generatedSoFar: StreamFile[],
): string {
  const genMap      = new Map(generatedSoFar.map((f) => [f.path, f.content]));
  const isDataFile  = /\/(utils?|data|lib)\//i.test(spec.path);
  const isHookFile  = /\/hooks?\//i.test(spec.path);
  const isAppFile   = spec.path === "src/App.jsx";

  // Inject dependency snippets (first 50 lines each)
  const depContext = (spec.dependencies ?? [])
    .map((dep) => {
      const content = genMap.get(dep);
      if (!content) return null;
      return `// ── DEP: ${dep} ──\n${content.split("\n").slice(0, 50).join("\n")}`;
    })
    .filter(Boolean)
    .join("\n\n");

  let task = "";

  if (isAppFile) {
    const renderables = generatedSoFar
      .filter((f) => f.path.endsWith(".jsx") && f.path !== "src/App.jsx" && !isDataFile && !isHookFile)
      .map((f) => {
        const name    = f.path.split("/").pop()!.replace(".jsx", "");
        const relPath = "./" + f.path.replace(/^src\//, "").replace(".jsx", "") + ".jsx";
        return { name, relPath };
      });
    const imports = renderables.map((c) => `import ${c.name} from '${c.relPath}';`).join("\n");
    const renders = renderables.map((c) => `      <${c.name} />`).join("\n");
    task = `Write src/App.jsx that composes all components.
Imports to use:
${imports}

Render them in order:
${renders}

Wrap in a <div> with style={{ minHeight: '100vh', background: '${plan.designSystem.colors.bg}', fontFamily: '${plan.designSystem.fonts}' }}.`;
  } else if (isDataFile || isHookFile) {
    task = `Write a complete JavaScript ${isHookFile ? "custom hook" : "utility/data"} file.
Export named OR default exports. NO JSX. Pure JavaScript only.
${isDataFile ? "Use realistic data — at least 5-8 items." : ""}`;
  } else {
    task = `Write a complete, production-quality React component.
Make it visually impressive with rich inline styles.
Use the project's color palette: primary=${plan.designSystem.colors.primary}, bg=${plan.designSystem.colors.bg}.
Use real, specific content — not placeholder text.
Add real interactivity with useState where it makes sense (hover states, toggles, counters).
The component must look premium and polished.`;
  }

  return `Write the COMPLETE file: ${spec.path}
Component name: ${spec.name}
Purpose: ${spec.description}
Props interface: ${spec.props}

${task}

${depContext ? `━━━ DEPENDENCY FILES ━━━\n${depContext}\n` : ""}
Start the file content NOW. No explanation, no markdown, no backticks.`;
}

// ─── Core file generator ──────────────────────────────────────────────────────

/**
 * Generate a single file using the model roster.
 * Returns a StreamFile — either the generated content or a safe fallback.
 * NEVER throws.
 */
async function generateSingleFile(
  spec:           ComponentSpec,
  plan:           ProjectPlan,
  generatedSoFar: StreamFile[],
  onPing?:        () => void,
): Promise<StreamFile> {
  const models = getHealthyModels();
  if (models.length === 0) {
    console.warn("[batch-generator] All models unhealthy — using fallback");
    return makeFallback(spec);
  }

  const system     = buildSystemPrompt(plan, generatedSoFar);
  const userPrompt = buildFileUserPrompt(spec, plan, generatedSoFar);

  for (let mi = 0; mi < models.length; mi++) {
    const model = models[mi];

    for (let attempt = 0; attempt < MAX_FILE_RETRIES; attempt++) {
      await waitForRateLimit(`${mlabel(model)}/${spec.path}`, onPing);
      onPing?.();

      const abortCtrl = new AbortController();
      const timeout   = setTimeout(() => abortCtrl.abort(), 90_000);

      try {
        const temperature = 0.2 + attempt * 0.08; // Slightly higher temp on retries

        console.log(`[batch-generator] ${mlabel(model)} → ${spec.path} (attempt ${attempt + 1}, t=${temperature.toFixed(2)})`);

        const res = await client.chat.completions.create(
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
        recordModelSuccess(model);

        const raw     = fixTokenCorruption(res.choices[0]?.message?.content ?? "");
        let   content = stripMarkdown(raw);

        // Hard reject: too short
        if (content.trim().length < MIN_FILE_CHARS) {
          throw new Error(`Output too short: ${content.trim().length} chars`);
        }

        // Hard reject: token corruption survived fix
        if (/=\s*\/\s*>/.test(content) || /<REDACTED/.test(content)) {
          throw new Error("Token corruption detected");
        }

        // Strip banned imports
        content = stripBannedImports(content);

        // Normalize JSX files
        if (spec.path.endsWith(".jsx")) {
          content = ensureReactImport(content);
          content = ensureDefaultExport(content, spec.name);
        }

        // Deduplicate imports
        content = deduplicateImports(content);

        // Truncate oversized files (LLM sometimes generates huge files)
        if (content.length > MAX_FILE_CHARS) {
          const trunc     = content.slice(0, MAX_FILE_CHARS);
          const lastBrace = trunc.lastIndexOf("\n}");
          content = lastBrace > MAX_FILE_CHARS * 0.6 ? trunc.slice(0, lastBrace + 2) : trunc;
          if (spec.path.endsWith(".jsx")) {
            content = ensureDefaultExport(content, spec.name);
          }
        }

        content = cleanOutput(content);

        // Basic validation
        if (spec.path.endsWith(".jsx")) {
          if (!/\bexport\s+default\b/.test(content)) {
            throw new Error("No export default in output");
          }
          if (!/return\s*\(?\s*</.test(content)) {
            throw new Error("No JSX return in output");
          }
        }

        console.log(`[batch-generator] ✓ ${spec.path} (${content.length}c)`);
        return { path: spec.path, content };

      } catch (e: unknown) {
        clearTimeout(timeout);
        recordModelFailure(model);

        const status = (e as { status?: number })?.status ?? 0;
        const msg    = (e as Error)?.message ?? String(e);

        if (status === 401 || status === 403) {
          console.error("[batch-generator] Auth error — cannot continue");
          return makeFallback(spec);
        }

        console.warn(`[batch-generator] ${mlabel(model)} ${spec.path} attempt ${attempt + 1} failed: ${msg}`);

        if (attempt < MAX_FILE_RETRIES - 1) {
          await sleepWithPing(backoffMs(attempt), onPing);
        }
      }
    }

    console.warn(`[batch-generator] ${mlabel(model)} exhausted for ${spec.path}`);
  }

  console.error(`[batch-generator] All models failed for ${spec.path} — fallback`);
  return makeFallback(spec);
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Generate all files in the project plan.
 *
 * WHY FILE-BY-FILE (not batch JSON):
 *   The old batch approach returned ALL files as a single JSON array with code as string values.
 *   LLMs cannot reliably JSON-escape multiline code (newlines, quotes, backslashes).
 *   A single escape error makes the entire JSON unparseable → ALL files fall back → blank UI.
 *   File-by-file means each file is independent — one failure does not affect others.
 *
 * Files are generated in dependency order with PARALLEL_BATCH concurrency.
 * App.jsx is always generated last so it has full context of all other components.
 */
export async function generateAllFiles(
  plan:    ProjectPlan,
  _ds:     DesignSystem,   // kept for API compat — design system is inside plan
  onPing?: () => void,
): Promise<StreamFile[]> {
  // Reset model health for this run
  modelFailures.clear();

  const specs = plan.components;

  // Split: App.jsx last, everything else in priority order
  const appSpec    = specs.find((s) => s.path === "src/App.jsx");
  const nonAppSpecs = specs.filter((s) => s.path !== "src/App.jsx");

  const generated: StreamFile[] = [];

  console.log(`[batch-generator] Generating ${specs.length} files (batch=${PARALLEL_BATCH}, models=${getHealthyModels().map(mlabel).join(",")})`);

  // Generate non-App files in parallel batches
  for (let i = 0; i < nonAppSpecs.length; i += PARALLEL_BATCH) {
    const batch = nonAppSpecs.slice(i, i + PARALLEL_BATCH);
    console.log(`[batch-generator] Batch ${Math.floor(i / PARALLEL_BATCH) + 1}: ${batch.map((s) => s.path).join(", ")}`);

    const results = await Promise.all(
      batch.map((spec) => generateSingleFile(spec, plan, generated, onPing))
    );

    generated.push(...results);
  }

  // Generate App.jsx last — now it can reference all generated components
  if (appSpec) {
    console.log(`[batch-generator] Generating src/App.jsx (final, has context of ${generated.length} files)`);
    const appFile = await generateSingleFile(appSpec, plan, generated, onPing);
    generated.push(appFile);
  }

  console.log(`[batch-generator] ✓ Done — ${generated.length} files`);
  return generated;
}

// ─── Prompt fragment builders (kept for compat with design-system.ts) ─────────

/**
 * Build a batch system prompt — kept for backward compat only.
 * In v19, this is not used for actual generation (file-by-file is used instead).
 */
export function buildBatchSystemPrompt(plan: ProjectPlan): string {
  return `[batch-generator v19] System prompt for ${plan.projectName}. See generateAllFiles() for actual implementation.`;
}

/**
 * Build a batch user prompt — kept for backward compat only.
 */
export function buildBatchUserPrompt(plan: ProjectPlan): string {
  return `[batch-generator v19] User prompt for ${plan.projectName}. See generateAllFiles() for actual implementation.`;
}