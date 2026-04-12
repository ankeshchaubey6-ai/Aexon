// src/lib/ai/engine/project-planner-v2.ts
// v19.0 — Uses PLAN_MODELS roster: kimi-k2, mistral-large-3, llama-4-maverick
//
// CHANGES FROM v18:
//   - Replaced Llama-70b with the full PLAN_MODELS roster (model fallback chain)
//   - Added model health tracking — bad models are skipped automatically
//   - Increased max_tokens from 2000 → 4096 (planner needs room for 15+ file specs)
//   - Stronger JSON extraction (handles models that add preamble/postamble)
//   - Removed CSS files at planner level
//   - App.jsx always placed last in component list

import OpenAI from "openai";
import { DesignSystem } from "./design-system";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ComponentSpec {
  path:         string;
  name:         string;
  description:  string;
  props:        string;
  dependencies: string[];
}

export interface ProjectPlan {
  projectName:  string;
  description:  string;
  designSystem: DesignSystem;
  components:   ComponentSpec[];
  appStructure: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const NVIDIA_BASE_URL = "https://integrate.api.nvidia.com/v1";

// Plan model roster — ordered by preference
// kimi-k2: best architectural reasoning
// mistral-large-3: strong JSON output discipline
// llama-4-maverick: fallback
const PLAN_MODELS = [
  "moonshotai/kimi-k2-instruct",
  "mistralai/mistral-large-3-675b-instruct-2512",
  "meta/llama-4-maverick-17b-128e-instruct",
] as const;

type PlanModel = typeof PLAN_MODELS[number];

const PLAN_MAX_TOKENS  = 4096;   // was 2000 — planner needs space for 15+ file specs
const PING_INTERVAL_MS = 7_000;
const PLAN_TIMEOUT_MS  = 120_000;

// Packages that are banned — planner should not plan imports of these
const BANNED_PACKAGES = [
  "framer-motion", "lucide-react", "react-router-dom", "axios",
  "three", "@react-three/fiber", "gsap", "zustand", "recharts",
  "next", "styled-components", "@emotion/react", "clsx", "classnames",
];

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
 * Derive a PascalCase component name from a file path.
 * "src/components/hero-section.jsx" → "HeroSection"
 */
function pathToName(path: string): string {
  const filename = path.split("/").pop()?.replace(/\.[^.]+$/, "") ?? "Component";
  return filename
    .split(/[-_]/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");
}

/**
 * Check if a filename starts with a digit (invalid JS identifier).
 */
function startsWithDigit(path: string): boolean {
  return /^[0-9]/.test(path.split("/").pop() ?? "");
}

// ─── Planner system prompt ────────────────────────────────────────────────────

const PLANNER_SYSTEM = `You are a world-class React architect. Return ONLY a valid JSON object — no markdown, no backticks, no explanation.

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
      "dependencies": []
    }
  ]
}

REQUIREMENTS FOR components ARRAY:
- Plan 10-15 components for a production-quality website (more is better)
- ALWAYS include src/App.jsx as the LAST component in the array
- Use component folders: src/components/, src/sections/, src/layouts/, src/hooks/, src/utils/
- props field: realistic TypeScript-style interface (even though we use JS — just for documentation)
- dependencies: list of paths from THIS project that this component imports
- ALL paths MUST start with "src/"

BANNED — never include these:
- package.json, index.html, src/main.jsx, vite.config.js (these are auto-generated)
- ANY .css, .scss, .sass, .less files (styling is inline only)
- TypeScript files (.ts, .tsx)
- Files named: Icon.jsx, Card.jsx, Button.jsx, Badge.jsx, index.jsx
- Files whose name starts with a digit
- Packages: ${BANNED_PACKAGES.join(", ")}

STYLING RULE: ALL styling in generated components must use inline style={{}} props.
NO Tailwind, NO CSS files, NO className attributes (except for very specific cases like animation).

RESPOND WITH ONLY THE JSON OBJECT — the very first character must be "{" and the last must be "}"`;

// ─── Main planner function ────────────────────────────────────────────────────

export async function planProjectV2(
  prompt:  string,
  ds:      DesignSystem,
  onPing?: () => void,
): Promise<ProjectPlan | null> {
  modelFailures.clear();

  const models = getHealthyModels();
  if (models.length === 0) {
    console.error("[planProjectV2] All plan models unhealthy");
    return null;
  }

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
            { role: "system", content: PLANNER_SYSTEM },
            {
              role:    "user",
              content: `Project request: ${prompt}

Design system context:
- Primary color: ${ds.colors.primary}
- Background: ${ds.colors.bg}
- Text color: ${ds.colors.text}
- Font: ${ds.fonts}

Plan a complete, production-quality React website. Return ONLY the JSON object.`,
            },
          ],
        },
        { signal: abortCtrl.signal },
      );

      clearTimeout(timeout);
      recordSuccess(model);

      const raw  = fixTokenCorruption(res.choices[0]?.message?.content ?? "");
      const text = stripMarkdown(raw);

      // Find JSON object boundaries — handles models that add preamble/postamble
      const start = text.indexOf("{");
      const end   = text.lastIndexOf("}");

      if (start === -1 || end === -1) {
        throw new Error(`No JSON object found in response (model: ${mlabel(model)})`);
      }

      const jsonStr = text.slice(start, end + 1);
      const parsed  = JSON.parse(jsonStr) as Omit<ProjectPlan, "designSystem">;

      // Sanitise component list
      let components = (parsed.components ?? []).map((c) => ({
        path:         (c.path ?? "").replace(/^\/+/, ""),
        name:         c.name || pathToName(c.path ?? ""),
        description:  c.description || c.path || "Component",
        props:        c.props || "{}",
        dependencies: Array.isArray(c.dependencies) ? c.dependencies : [],
      }));

      // Filter out invalid files
      components = components
        .filter((c) => c.path.startsWith("src/"))
        .filter((c) => !c.path.endsWith(".css") && !c.path.endsWith(".scss") && !c.path.endsWith(".sass") && !c.path.endsWith(".less"))
        .filter((c) => !c.path.endsWith(".ts") && !c.path.endsWith(".tsx"))
        .filter((c) => !startsWithDigit(c.path))
        .filter((c) => !["package.json", "index.html", "src/main.jsx", "vite.config.js"].includes(c.path));

      // Ensure App.jsx exists
      if (!components.some((c) => c.path === "src/App.jsx")) {
        components.push({
          path:         "src/App.jsx",
          name:         "App",
          description:  "Root component — imports and composes all sections and components",
          props:        "{}",
          dependencies: components.filter((c) => c.path.endsWith(".jsx")).map((c) => c.path),
        });
      }

      // App.jsx must be last (it depends on everything else)
      components = [
        ...components.filter((c) => c.path !== "src/App.jsx"),
        ...components.filter((c) => c.path === "src/App.jsx"),
      ];

      const plan: ProjectPlan = {
        projectName:  parsed.projectName  || "Project",
        description:  parsed.description  || prompt.slice(0, 100),
        appStructure: parsed.appStructure || "App.jsx renders all components in a vertical layout.",
        designSystem: ds,
        components,
      };

      console.log(`[planProjectV2] ✓ Planned ${components.length} components — "${plan.projectName}"`);
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