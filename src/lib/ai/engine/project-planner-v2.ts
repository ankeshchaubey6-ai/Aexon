// src/lib/ai/engine/project-planner-v2.ts
// v21.0 — Mode-aware planner: prompt-driven file count, no hardcoded "10-15 files"
//
// ROOT CAUSE FIXES:
//   🔴 FIX 1: detectComplexityMode() — reads prompt intent BEFORE asking the LLM
//   🔴 FIX 2: Planner prompt no longer hardcodes file counts — mode drives target
//   🔴 FIX 3: validateAndTrimPlan() — enforces count AFTER plan returns
//   🔴 FIX 7: sanitizeFontString() — prevents runtime crashes from quote-in-quote font values
//
// CHANGES FROM v19:
//   - ComplexityMode type: "minimal" | "standard" | "complex"
//   - detectComplexityMode() parses prompt before any LLM call
//   - buildPlannerSystemPrompt() accepts ModeConfig — no hardcoded file counts
//   - validateAndTrimPlan() trims excess files, enforces min/max
//   - planProjectV2() accepts and propagates ModeConfig
//   - sanitizeFontString() utility added

import OpenAI from "openai";
import { DesignSystem } from "./design-system";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ComponentSpec {
  path:         string;
  name:         string;
  description:  string;
  props:        string;
  dependencies: string[];
  tier?:        "infrastructure" | "layout" | "page" | "feature" | "shared";
}

export interface ProjectPlan {
  projectName:  string;
  description:  string;
  designSystem: DesignSystem;
  components:   ComponentSpec[];
  appStructure: string;
  modules?: Array<{ name: string; description: string; files: string[] }>;
  qualityChecklist?: string[];
  domainData?: {
    entities: string[];
    sampleFields: Record<string, string[]>;
    uiPatterns: string[];
  };
}

// ─── Complexity Mode (ROOT FIX #1) ───────────────────────────────────────────

export type ComplexityMode = "minimal" | "standard" | "complex" | "large";

export interface ModeConfig {
  mode:            ComplexityMode;
  targetFileCount: number;   // what the planner is instructed to target
  minFileCount:    number;   // hard minimum — below this = planning failed
  maxFileCount:    number;   // hard cap — excess files are truncated
  description:     string;   // injected verbatim into the planner prompt
}

// ─── Constants ────────────────────────────────────────────────────────────────

const NVIDIA_BASE_URL = "https://integrate.api.nvidia.com/v1";

const PLAN_MODELS = [
  "moonshotai/kimi-k2-instruct",
  "mistralai/mistral-large-3-675b-instruct-2512",
  "meta/llama-4-maverick-17b-128e-instruct",
] as const;

type PlanModel = typeof PLAN_MODELS[number];

const PLAN_MAX_TOKENS  = 5000;
const PING_INTERVAL_MS = 7_000;
const PLAN_TIMEOUT_MS  = 120_000;

const BANNED_PACKAGES = [
  "framer-motion", "lucide-react", "react-router-dom", "axios",
  "three", "@react-three/fiber", "gsap", "zustand", "recharts",
  "next", "styled-components", "@emotion/react", "clsx", "classnames",
];

const BOILERPLATE_PATHS = new Set([
  "package.json", "index.html", "src/main.jsx", "vite.config.js",
]);

// ─── NVIDIA client ────────────────────────────────────────────────────────────

const client = new OpenAI({
  apiKey:  process.env.NVIDIA_API_KEY!,
  baseURL: NVIDIA_BASE_URL,
});

// ─── Model health ─────────────────────────────────────────────────────────────

const modelFailures = new Map<string, number>();
const FAILURE_THRESHOLD = 2;

function recordSuccess(model: string): void { modelFailures.delete(model); }
function recordFailure(model: string): void {
  modelFailures.set(model, (modelFailures.get(model) ?? 0) + 1);
}
function isHealthy(model: string): boolean {
  return (modelFailures.get(model) ?? 0) < FAILURE_THRESHOLD;
}
function getHealthyModels(): PlanModel[] {
  return PLAN_MODELS.filter(isHealthy);
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

function mlabel(model: string): string {
  return model.split("/")[1] ?? model;
}

function stripMarkdown(text: string): string {
  return text
    .replace(/^```(?:json|jsx?|javascript|typescript|tsx?)?\s*/gim, "")
    .replace(/^```\s*$/gim, "")
    .trim();
}

function fixTokenCorruption(code: string): string {
  let c = code;
  c = c.replace(/(\)|\])\s*=\s*\/\s*>/g, "$1 =>");
  c = c.replace(/(?<![=!<>])=\s*\/\s*>/g, "=>");
  return c;
}

/**
 * ROOT FIX #7: Strip wrapper quotes from font names so they're safe to embed
 * directly in JSX style={{}} string values.
 *
 * PROBLEM: fontFamily: "'Syne', sans-serif" crashes at runtime — the inner
 * single quotes are interpreted as string delimiters in JSX.
 *
 * SOLUTION: Strip all wrapping quotes from individual font names.
 * "'Syne', sans-serif" → "Syne, sans-serif"  ← safe to use in fontFamily
 */
export function sanitizeFontString(font: string): string {
  return font
    .replace(/^['"]|['"]$/g, "")  // strip outer quotes
    .replace(/'/g, "");            // strip inner quotes around font names
}

function pathToName(path: string): string {
  const filename = path.split("/").pop()?.replace(/\.[^.]+$/, "") ?? "Component";
  return filename
    .split(/[-_]/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");
}

function startsWithDigit(path: string): boolean {
  return /^[0-9]/.test(path.split("/").pop() ?? "");
}

function getFileTier(filePath: string): ComponentSpec["tier"] {
  if (
    filePath.includes("types/") ||
    filePath.includes("utils") ||
    filePath.includes("hooks/") ||
    filePath.includes("data/") ||
    filePath.includes("tailwind.config")
  ) {
    return "infrastructure";
  }
  if (filePath.includes("Layout") || filePath.includes("Navbar") || filePath.includes("Sidebar") || filePath.includes("Footer")) return "layout";
  if (filePath.includes("pages/") || filePath.includes("Page")) return "page";
  if (filePath.includes("components/") || filePath.includes("sections/") || filePath.includes("features/")) return "feature";
  return "shared";
}

// ─── Complexity Mode Detection (ROOT FIX #1) ──────────────────────────────────

/**
 * Reads the user prompt and returns a ModeConfig that governs:
 *   - How many files the planner is INSTRUCTED to generate
 *   - The min/max enforcement applied AFTER the plan returns
 *
 * This is the single source of truth for "how big should this project be".
 * The planner LLM is given the target and instructed NOT to exceed it.
 * validateAndTrimPlan() enforces the cap regardless of what the LLM returns.
 */
export function detectComplexityMode(prompt: string): ModeConfig {
  const p = prompt.toLowerCase();

  // Check for explicit numeric file/component count first
  const numMatch = prompt.match(/\b(\d+)\s+(?:component|file|section|page)/i);
  if (numMatch) {
    const n = parseInt(numMatch[1], 10);
    if (n <= 3) return {
      mode: "minimal",
      targetFileCount: n,
      minFileCount: 1,
      maxFileCount: n + 1,
      description: `Generate EXACTLY ${n} component file(s) as the user requested. Do NOT add extras.`,
    };
    if (n <= 7) return {
      mode: "standard",
      targetFileCount: n,
      minFileCount: Math.max(1, n - 1),
      maxFileCount: n + 2,
      description: `Generate approximately ${n} component files as the user requested.`,
    };
  }

  const minimalSignals = [
    /\bminimal\b/, /\bsimple\b/, /\bone[\s-]page\b/, /\bsingle[\s-]page\b/,
    /\bjust\s+a?\s*(component|page|screen|section)\b/,
    /\bonly\s+(a|one|single)\b/,
    /\bbasic\b/, /\bquick\b/, /\bsmall\b/, /\blite\b/, /\blight\b/,
    /^(?:make|build|create|write|give me)\s+a\s+\w+\s*$/,
  ];

  const complexSignals = [
    /\bfull[\s-]?(stack|app|website|platform|saas)\b/,
    /\bcomplete\b/, /\bproduction[\s-]?(grade|ready|quality)\b/,
    /\bwith\s+(auth|dashboard|analytics|payments|api)\b/,
    /\bmulti[\s-]?page\b/, /\blanding\s+page\b/,
    /\bfull\s+website\b/, /\bentire\b/,
  ];

  const isMinimal = minimalSignals.some((re) => re.test(p));
  const isLarge = /enterprise|full.?stack|complete|production|saas|dashboard|admin|platform|crm|analytics/i.test(prompt);
  const isComplex = complexSignals.some((re) => re.test(p))
    || /database|backend|auth|api|multi.?page|e.?commerce|marketplace/i.test(prompt);

  if (isMinimal && !isComplex) return {
    mode: "minimal",
    targetFileCount: 2,
    minFileCount: 1,
    maxFileCount: 4,
    description: "Generate 1–3 focused component files. The user wants something simple and direct. Do NOT over-engineer.",
  };

  if (isLarge) return {
    mode: "large",
    targetFileCount: 16,
    minFileCount: 13,
    maxFileCount: 20,
    description: "Generate 13-20 production-grade files for a polished large website or application shell, including shared infrastructure and feature modules.",
  };

  if (isComplex) return {
    mode: "complex",
    targetFileCount: 8,
    minFileCount: 4,
    maxFileCount: 11,
    description: "Generate 8–12 comprehensive component files for a full production website.",
  };

  return {
    mode: "standard",
    targetFileCount: 6,
    minFileCount: 4,
    maxFileCount: 9,
    description: "Generate 4–6 component files for a well-structured website.",
  };
}

// ─── Planner system prompt (ROOT FIX #2) ──────────────────────────────────────

/**
 * ROOT FIX #2: Planner prompt is dynamically built from ModeConfig.
 * Old prompt hardcoded: "Plan 10-15 components (more is better)"
 * New prompt: uses mode.targetFileCount and mode.description from detectComplexityMode()
 */
function buildPlannerSystemPrompt(mode: ModeConfig): string {
  return `You are a world-class React architect. Return ONLY a valid JSON object — no markdown, no backticks, no explanation.

JSON Schema:
{
  "projectName": "PascalCase project name",
  "description": "one sentence describing the project",
  "appStructure": "3-4 sentences: how App.jsx composes all components, what sections exist, how state flows",
  "components": [
    {
      "path": "src/components/Hero.jsx",
      "name": "Hero",
      "description": "Full-screen hero section with gradient background, animated headline, subtitle, and two CTA buttons",
      "props": "{ title: string, subtitle: string, primaryCta: string, secondaryCta: string }",
      "dependencies": [],
      "tier": "feature"
    }
  ],
  "modules": [
    {
      "name": "infrastructure",
      "description": "Shared types, utils, hooks, and mock data",
      "files": ["src/types/index.ts", "src/lib/utils.ts", "src/hooks/useLocalStorage.ts", "src/data/mockData.ts", "tailwind.config.ts"]
    }
  ],
  "qualityChecklist": ["has-typescript-types", "has-responsive-layout", "has-realistic-data", "has-hover-states"],
  "domainData": {
    "entities": ["User", "Product", "Order"],
    "sampleFields": {
      "User": ["id", "name", "email", "role", "avatarUrl", "createdAt"],
      "Product": ["id", "name", "price", "category", "imageUrl", "stock"]
    },
    "uiPatterns": ["data-table", "stat-cards", "line-chart", "sidebar-nav"]
  }
}

COMPLEXITY MODE: ${mode.mode.toUpperCase()}
${mode.description}

TARGET: Plan EXACTLY ${mode.targetFileCount} component file(s).
MAXIMUM: ${mode.maxFileCount} files total (including App.jsx).
MINIMUM: ${mode.minFileCount} files.

If the user asks for something "minimal", "simple", or a single component:
- Plan ONLY what they asked for
- Do NOT add extra sections or filler components
- A navbar + hero + App.jsx = 3 files. That is acceptable.

REQUIREMENTS FOR components ARRAY:
- INFRASTRUCTURE FILES: for standard, complex, and large projects, include these files at the TOP of your list before UI components: src/types/index.ts, src/lib/utils.ts, src/hooks/useLocalStorage.ts, src/data/mockData.ts, tailwind.config.ts
- After infrastructure files, list UI components in dependency order: layout first, pages second, feature components third, small shared components last
- Return a "modules" array grouping files by feature area; each module should have 2-5 files
- The "tier" field on each file must be one of: infrastructure, layout, page, feature, shared
- The "qualityChecklist" array must always contain: has-typescript-types, has-responsive-layout, has-realistic-data, has-hover-states
- Infer 2-4 main data entities from the prompt; for each entity, list 4-8 realistic field names in domainData.sampleFields
- List 2-5 appropriate UI patterns in domainData.uiPatterns
- ALWAYS include src/App.jsx as the LAST component in the array
- Use component folders: src/components/, src/sections/, src/layouts/, src/hooks/, src/utils/, src/lib/, src/data/, src/types/
- props field: realistic TypeScript-style interface (documentation only, we use JS)
- dependencies: list of paths from THIS project that this component imports
- ALL paths MUST start with "src/"

BANNED — never include these:
- package.json, index.html, src/main.jsx, vite.config.js (auto-generated)
- ANY .css, .scss, .sass, .less files (styling is inline only)
- TypeScript files (.ts, .tsx)
- Files whose name starts with a digit
- Packages: ${BANNED_PACKAGES.join(", ")}

STYLING RULE: ALL styling must use inline style={{}} props. NO Tailwind. NO CSS files. NO className.

RESPOND WITH ONLY THE JSON OBJECT — first character must be "{" and last must be "}"`;
}

// ─── Plan Validation (ROOT FIX #3, #9) ────────────────────────────────────────

/**
 * ROOT FIX #3, #9: Called immediately after the planner returns JSON.
 * Enforces mode-derived file count limits regardless of what the LLM generated.
 *
 * Why this is necessary: even with a good prompt, LLMs sometimes ignore
 * count constraints. This is the hard enforcement layer.
 */
export function validateAndTrimPlan(
  components: ComponentSpec[],
  mode:       ModeConfig,
): ComponentSpec[] {
  let comps = components
    .filter((c) => c.path.startsWith("src/"))
    .filter((c) => !c.path.endsWith(".css") && !c.path.endsWith(".scss") && !c.path.endsWith(".sass"))
    .filter((c) => !c.path.endsWith(".tsx"))
    .filter((c) => !c.path.endsWith(".ts") || getFileTier(c.path) === "infrastructure")
    .filter((c) => !startsWithDigit(c.path))
    .filter((c) => !BOILERPLATE_PATHS.has(c.path));

  const appComps   = comps.filter((c) => c.path === "src/App.jsx");
  const nonApp     = comps.filter((c) => c.path !== "src/App.jsx");

  // Enforce max — trim from end (lower priority components)
  const maxNonApp = mode.maxFileCount - 1;  // reserve 1 slot for App.jsx
  const trimmed   = nonApp.slice(0, maxNonApp);

  if (nonApp.length > maxNonApp) {
    console.log(`[validateAndTrimPlan] Trimmed from ${nonApp.length} to ${trimmed.length} components (mode: ${mode.mode})`);
  }

  const result = [...trimmed, ...(appComps.length > 0 ? [appComps[0]] : [])];

  // Ensure App.jsx exists
  if (!result.some((c) => c.path === "src/App.jsx")) {
    result.push({
      path:         "src/App.jsx",
      name:         "App",
      description:  "Root component — imports and composes all sections and components",
      props:        "{}",
      dependencies: trimmed.filter((c) => c.path.endsWith(".jsx")).map((c) => c.path),
    });
  }

  return result;
}

// ─── Main planner function ────────────────────────────────────────────────────

export async function planProjectV2(
  prompt:  string,
  ds:      DesignSystem,
  onPing?: () => void,
  mode?:   ModeConfig,  // optional — if not provided, auto-detected from prompt
): Promise<ProjectPlan | null> {
  modelFailures.clear();

  // ROOT FIX #1: Detect complexity mode if not provided
  const resolvedMode = mode ?? detectComplexityMode(prompt);
  console.log(`[planProjectV2] Mode: ${resolvedMode.mode} (target: ${resolvedMode.targetFileCount}, max: ${resolvedMode.maxFileCount})`);

  const models = getHealthyModels();
  if (models.length === 0) {
    console.error("[planProjectV2] All plan models unhealthy");
    return null;
  }

  // ROOT FIX #2: Build prompt from mode config
  const systemPrompt = buildPlannerSystemPrompt(resolvedMode);

  for (let mi = 0; mi < models.length; mi++) {
    const model = models[mi];
    console.log(`[planProjectV2] Planning with ${mlabel(model)} (${mi + 1}/${models.length})`);

    const abortCtrl = new AbortController();
    const timeout   = setTimeout(() => abortCtrl.abort(), PLAN_TIMEOUT_MS);

    try {
      const res = await client.chat.completions.create(
        {
          model,
          temperature: 0.3,
          max_tokens:  PLAN_MAX_TOKENS,
          messages: [
            { role: "system", content: systemPrompt },
            {
              role:    "user",
              content: `Project request: ${prompt}

Design system context:
- Primary color: ${ds.colors.primary}
- Background: ${ds.colors.bg}
- Text color: ${ds.colors.text}
- Font: ${ds.fonts}

Plan the project. Return ONLY the JSON object.`,
            },
          ],
        },
        { signal: abortCtrl.signal },
      );

      clearTimeout(timeout);
      recordSuccess(model);

      const raw  = fixTokenCorruption(res.choices[0]?.message?.content ?? "");
      const text = stripMarkdown(raw);

      const start = text.indexOf("{");
      const end   = text.lastIndexOf("}");

      if (start === -1 || end === -1) {
        throw new Error(`No JSON object found in response (model: ${mlabel(model)})`);
      }

      const jsonStr = text.slice(start, end + 1);
      const parsed  = JSON.parse(jsonStr) as Omit<ProjectPlan, "designSystem">;

      // Normalize component list
      let components: ComponentSpec[] = (parsed.components ?? []).map((c) => ({
        path:         (c.path ?? "").replace(/^\/+/, ""),
        name:         c.name || pathToName(c.path ?? ""),
        description:  c.description || c.path || "Component",
        props:        c.props || "{}",
        dependencies: Array.isArray(c.dependencies) ? c.dependencies : [],
        tier:         c.tier ?? getFileTier(c.path ?? ""),
      }));

      // ROOT FIX #3: Validate and trim to mode bounds
      components = validateAndTrimPlan(components, resolvedMode);

      // Validate minimum
      const nonBoilerplate = components.filter((c) => !BOILERPLATE_PATHS.has(c.path));
      if (nonBoilerplate.length < resolvedMode.minFileCount) {
        throw new Error(
          `Plan has only ${nonBoilerplate.length} component(s), minimum is ${resolvedMode.minFileCount} for mode '${resolvedMode.mode}'`
        );
      }

      const plan: ProjectPlan = {
        projectName:  parsed.projectName  || "Project",
        description:  parsed.description  || prompt.slice(0, 100),
        appStructure: parsed.appStructure || "App.jsx renders all components in a vertical layout.",
        designSystem: ds,
        components,
        modules: Array.isArray(parsed.modules) ? parsed.modules : [],
        qualityChecklist: ["has-typescript-types", "has-responsive-layout", "has-realistic-data", "has-hover-states"],
        domainData: parsed.domainData ?? { entities: [], sampleFields: {}, uiPatterns: [] },
      };

      console.log(
        `[planProjectV2] ✓ ${components.length} components — "${plan.projectName}" (mode: ${resolvedMode.mode})`
      );
      return plan;

    } catch (e: unknown) {
      clearTimeout(timeout);
      recordFailure(model);

      const status = (e as { status?: number })?.status ?? 0;
      const msg    = (e as Error)?.message ?? String(e);

      if (status === 401 || status === 403) {
        console.error("[planProjectV2] Auth error — cannot continue");
        return null;
      }

      console.warn(`[planProjectV2] ${mlabel(model)} failed: ${msg}`);

      if (mi < models.length - 1) {
        console.log(`[planProjectV2] Trying next model...`);
        await sleepWithPing(1500, onPing);
      }
    }
  }

  console.error("[planProjectV2] All plan models failed");
  return null;
}
