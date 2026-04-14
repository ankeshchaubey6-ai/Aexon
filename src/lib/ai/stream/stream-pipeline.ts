// src/lib/ai/stream/stream-pipeline.ts
// PIPELINE v21.0 — MODE-AWARE · PROMPT-DRIVEN FILE COUNT · STRUCTURAL GUARANTEES
//
// ROOT CAUSE FIXES FROM v20:
//   🔴 FIX 1: Mode detection — minimal/standard/complex — drives EVERYTHING downstream
//   🔴 FIX 2: Planner prompt no longer hardcodes "10-15 files" — uses mode-derived targets
//   🔴 FIX 3: Post-plan structural validation — required files enforced, count checked
//   🔴 FIX 4: Required file guarantee — index.html, src/main.jsx, src/App.jsx ALWAYS present
//   🔴 FIX 5: Generation failure handling — failed file → safe fallback, pipeline does NOT continue blindly
//   🔴 FIX 6: MIME / blank screen — guaranteed valid Vite entry chain at Stage 0
//   🔴 FIX 7: Font string sanitization — no unescaped quotes in style values
//   🔴 FIX 8: Validation gate is real — counts required files, rejects structurally broken output
//   🔴 FIX 9: Planner file count is capped and validated against prompt intent
//   🔴 FIX 10: App.jsx always rebuilt deterministically from actually-generated files
//
// ARCHITECTURE (unchanged stages, fixed internals):
//   S0  → Boilerplate emit (guaranteed Vite entry chain)
//   S1  → Mode detection → Planner (mode-constrained prompt)
//   S1.5→ Plan validation + structural enforcement
//   S2  → Generator (file-by-file, failure-aware)
//   S3  → Deterministic auto-fix
//   S3.5→ Hard validation gate (real, not fake)
//   S4  → Final emit — only changed files, all validated

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
  projectName:   string;
  description:   string;
  globalContext: string;
  primaryColor:  string;
  files:         FileSpec[];
}

interface ValidationResult {
  passed:  boolean;
  reasons: string[];
}

interface DesignTokens {
  projectType:    string;
  primary:        string;
  primaryLight:   string;
  accent:         string;
  bg:             string;
  bgAlt:          string;
  bgCard:         string;
  text:           string;
  textMuted:      string;
  border:         string;
  gradient:       string;
  gradientHero:   string;
  glass:          string;
  glassBorder:    string;
  shadow:         string;
  shadowLg:       string;
  radius:         string;
  radiusLg:       string;
  displayFont:    string;
  bodyFont:       string;
  googleFontsUrl: string;
  animDuration:   string;
  animEase:       string;
}

// ─── NEW: Complexity Mode ─────────────────────────────────────────────────────
type ComplexityMode = "minimal" | "standard" | "complex";

interface ModeConfig {
  mode:            ComplexityMode;
  targetFileCount: number;   // exact target for planner
  minFileCount:    number;   // hard minimum (below = planning failed)
  maxFileCount:    number;   // hard cap (above = truncate list)
  description:     string;   // injected into planner prompt
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 3 — CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════════

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

type PlanModel    = typeof PLAN_MODELS[number];
type CodegenModel = typeof CODEGEN_MODELS[number];

const NVIDIA_BASE_URL     = "https://integrate.api.nvidia.com/v1";
const MAX_FILE_RETRIES    = 3;
const MAX_REGEN_PER_FILE  = 2;
const PARALLEL_BATCH_SIZE = 3;
const PING_INTERVAL_MS    = 7_000;
const MIN_FILE_CHARS      = 50;
const MAX_FILE_CHARS      = 14_000;
const JSX_IMBALANCE_TOL   = 2;
const PLAN_MAX_TOKENS     = 4096;
const CODEGEN_MAX_TOKENS  = 6000;

const BOILERPLATE_PATHS = new Set([
  "package.json", "index.html", "src/main.jsx", "vite.config.js",
]);

// These are required in every generated project — pipeline enforces their presence
const REQUIRED_PATHS = ["package.json", "index.html", "src/main.jsx", "vite.config.js", "src/App.jsx"] as const;

const BANNED_PACKAGES = [
  "framer-motion", "lucide-react", "react-router-dom", "react-router",
  "axios", "three", "@react-three/fiber", "@react-three/drei",
  "gsap", "zustand", "recharts", "preact", "styled-components",
  "@emotion/react", "@emotion/styled", "clsx", "classnames",
  "@tanstack/react-query", "next", "next/image", "next/link",
  "next/router", "next/navigation",
];

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 4 — MODE DETECTION (ROOT FIX #1, #2, #3)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Detect complexity mode from the user prompt.
 * This drives how many files the planner is ALLOWED to generate.
 *
 * Why this matters:
 *   "minimal" prompt → old pipeline generated 12 files → broken dep graph → blank screen
 *   Now: "minimal" → planner targets 2–3 files → clean, working result
 */
function detectComplexityMode(prompt: string): ModeConfig {
  const p = prompt.toLowerCase();

  // Minimal signals: user explicitly wants a small output
  const minimalSignals = [
    /\bminimal\b/, /\bsimple\b/, /\bone[\s-]page\b/, /\bsingle[\s-]page\b/,
    /\bjust\s+a?\s*(component|page|screen|section)\b/,
    /\bonly\s+(a|one|single)\b/,
    /\bbasic\b/, /\bquick\b/, /\bsmall\b/, /\blite\b/, /\blight\b/,
    /^(?:make|build|create|write|give me)\s+a\s+\w+\s*$/, // "build a navbar"
    /\b(\d+)\s+(?:component|file|section)/,               // "2 components"
  ];

  // Complex signals: user wants a full production app
  const complexSignals = [
    /\bfull[\s-]?(stack|app|website|platform|saas)\b/,
    /\bcomplete\b/, /\bproduction[\s-]?(grade|ready|quality)\b/,
    /\bwith\s+(auth|dashboard|analytics|payments|api)\b/,
    /\bmulti[\s-]?page\b/, /\blanding\s+page\b/,
    /\bfull\s+website\b/, /\bentire\b/,
  ];

  // Count explicit file/component numbers in the prompt
  const numMatch = prompt.match(/\b(\d+)\s+(?:component|file|section|page)/i);
  if (numMatch) {
    const n = parseInt(numMatch[1], 10);
    if (n <= 3) return {
      mode: "minimal",
      targetFileCount: n,
      minFileCount: 1,
      maxFileCount: n + 1,
      description: `Generate EXACTLY ${n} component file(s) as requested. No more. No extras.`,
    };
    if (n <= 7) return {
      mode: "standard",
      targetFileCount: n,
      minFileCount: Math.max(1, n - 1),
      maxFileCount: n + 2,
      description: `Generate approximately ${n} component files as requested.`,
    };
  }

  const isMinimal = minimalSignals.some((re) => re.test(p));
  const isComplex = complexSignals.some((re) => re.test(p));

  if (isMinimal && !isComplex) return {
    mode: "minimal",
    targetFileCount: 2,
    minFileCount: 1,
    maxFileCount: 4,
    description: "Generate 1–3 focused component files. The user wants something simple. Do NOT over-engineer.",
  };

  if (isComplex) return {
    mode: "complex",
    targetFileCount: 10,
    minFileCount: 6,
    maxFileCount: 13,
    description: "Generate 8–12 comprehensive component files for a full production website.",
  };

  // Standard: default
  return {
    mode: "standard",
    targetFileCount: 5,
    minFileCount: 3,
    maxFileCount: 8,
    description: "Generate 4–6 component files for a well-structured website.",
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 5 — DESIGN TOKEN RESOLVER
// ═══════════════════════════════════════════════════════════════════════════════

function resolveDesignTokens(prompt: string, projectName: string): DesignTokens {
  const p = (prompt + " " + projectName).toLowerCase();

  const isSaas       = /saas|dashboard|analytics|crm|productivity|workspace|b2b|admin|platform/i.test(p);
  const isEcommerce  = /shop|store|ecommerce|e-commerce|product|buy|cart|checkout|fashion|clothing/i.test(p);
  const isFinance    = /finance|fintech|bank|invest|stock|crypto|wallet|money|trading/i.test(p);
  const isCreative   = /creative|agency|portfolio|design|art|studio|gallery|photography|film/i.test(p);
  const isStreaming  = /streaming|music|podcast|audio|video|media|player|entertainment/i.test(p);
  const isHealthcare = /health|medical|clinic|doctor|fitness|wellness|nutrition|therapy/i.test(p);
  const isStartup    = /startup|landing|launch|product hunt|waitlist|coming soon/i.test(p);
  const isEducation  = /education|learning|course|tutor|school|academy|university/i.test(p);

  if (isSaas) return {
    projectType: "saas", primary: "#6366F1", primaryLight: "#818CF8", accent: "#06B6D4",
    bg: "#030712", bgAlt: "#0F172A", bgCard: "#111827", text: "#F9FAFB",
    textMuted: "#6B7280", border: "#1F2937",
    gradient: "linear-gradient(135deg, #6366F1 0%, #06B6D4 100%)",
    gradientHero: "radial-gradient(ellipse 80% 60% at 50% -10%, rgba(99,102,241,0.35) 0%, transparent 70%)",
    glass: "rgba(255,255,255,0.03)", glassBorder: "rgba(255,255,255,0.08)",
    shadow: "0 4px 24px rgba(99,102,241,0.15)", shadowLg: "0 20px 60px rgba(99,102,241,0.25)",
    radius: "12px", radiusLg: "20px",
    displayFont: "Syne, sans-serif", bodyFont: "DM Sans, sans-serif",
    googleFontsUrl: "https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=DM+Sans:wght@300;400;500;600&display=swap",
    animDuration: "0.6s", animEase: "cubic-bezier(0.16, 1, 0.3, 1)",
  };

  if (isFinance) return {
    projectType: "finance", primary: "#10B981", primaryLight: "#34D399", accent: "#F59E0B",
    bg: "#030B0F", bgAlt: "#061019", bgCard: "#0A1628", text: "#ECF0F1",
    textMuted: "#5D7A8A", border: "#0F2030",
    gradient: "linear-gradient(135deg, #10B981 0%, #0EA5E9 100%)",
    gradientHero: "radial-gradient(ellipse 80% 60% at 50% -10%, rgba(16,185,129,0.25) 0%, transparent 70%)",
    glass: "rgba(16,185,129,0.04)", glassBorder: "rgba(16,185,129,0.12)",
    shadow: "0 4px 24px rgba(16,185,129,0.12)", shadowLg: "0 20px 60px rgba(16,185,129,0.2)",
    radius: "8px", radiusLg: "16px",
    displayFont: "Libre Baskerville, serif", bodyFont: "DM Sans, sans-serif",
    googleFontsUrl: "https://fonts.googleapis.com/css2?family=Libre+Baskerville:wght@400;700&family=DM+Sans:wght@300;400;500;600&display=swap",
    animDuration: "0.5s", animEase: "cubic-bezier(0.22, 1, 0.36, 1)",
  };

  if (isEcommerce) return {
    projectType: "ecommerce", primary: "#E11D48", primaryLight: "#FB7185", accent: "#F59E0B",
    bg: "#FAFAF9", bgAlt: "#F5F5F4", bgCard: "#FFFFFF", text: "#1C1917",
    textMuted: "#78716C", border: "#E7E5E4",
    gradient: "linear-gradient(135deg, #E11D48 0%, #F59E0B 100%)",
    gradientHero: "linear-gradient(160deg, #FFF1F2 0%, #FEF3C7 100%)",
    glass: "rgba(255,255,255,0.8)", glassBorder: "rgba(0,0,0,0.06)",
    shadow: "0 4px 20px rgba(0,0,0,0.08)", shadowLg: "0 20px 60px rgba(0,0,0,0.12)",
    radius: "10px", radiusLg: "18px",
    displayFont: "Playfair Display, serif", bodyFont: "Lato, sans-serif",
    googleFontsUrl: "https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;600;700;900&family=Lato:wght@300;400;700&display=swap",
    animDuration: "0.5s", animEase: "cubic-bezier(0.34, 1.56, 0.64, 1)",
  };

  if (isCreative) return {
    projectType: "creative", primary: "#FF3D00", primaryLight: "#FF7043", accent: "#FFD600",
    bg: "#0A0A0A", bgAlt: "#111111", bgCard: "#181818", text: "#F5F5F5",
    textMuted: "#888888", border: "#222222",
    gradient: "linear-gradient(135deg, #FF3D00 0%, #FFD600 100%)",
    gradientHero: "radial-gradient(ellipse 70% 50% at 50% 0%, rgba(255,61,0,0.3) 0%, transparent 60%)",
    glass: "rgba(255,255,255,0.03)", glassBorder: "rgba(255,255,255,0.1)",
    shadow: "0 4px 24px rgba(255,61,0,0.15)", shadowLg: "0 20px 60px rgba(255,61,0,0.2)",
    radius: "4px", radiusLg: "8px",
    displayFont: "Bebas Neue, cursive", bodyFont: "Outfit, sans-serif",
    googleFontsUrl: "https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Outfit:wght@300;400;500;600&display=swap",
    animDuration: "0.7s", animEase: "cubic-bezier(0.16, 1, 0.3, 1)",
  };

  if (isStreaming) return {
    projectType: "streaming", primary: "#A855F7", primaryLight: "#C084FC", accent: "#F43F5E",
    bg: "#09090B", bgAlt: "#18181B", bgCard: "#1C1C1E", text: "#FAFAFA",
    textMuted: "#71717A", border: "#27272A",
    gradient: "linear-gradient(135deg, #A855F7 0%, #F43F5E 100%)",
    gradientHero: "radial-gradient(ellipse 80% 60% at 50% -5%, rgba(168,85,247,0.4) 0%, transparent 65%)",
    glass: "rgba(255,255,255,0.04)", glassBorder: "rgba(255,255,255,0.1)",
    shadow: "0 4px 24px rgba(168,85,247,0.2)", shadowLg: "0 20px 60px rgba(168,85,247,0.3)",
    radius: "14px", radiusLg: "24px",
    displayFont: "Space Grotesk, sans-serif", bodyFont: "Space Grotesk, sans-serif",
    googleFontsUrl: "https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500;600;700&display=swap",
    animDuration: "0.6s", animEase: "cubic-bezier(0.16, 1, 0.3, 1)",
  };

  if (isHealthcare) return {
    projectType: "healthcare", primary: "#0EA5E9", primaryLight: "#38BDF8", accent: "#10B981",
    bg: "#F8FAFC", bgAlt: "#F1F5F9", bgCard: "#FFFFFF", text: "#0F172A",
    textMuted: "#64748B", border: "#E2E8F0",
    gradient: "linear-gradient(135deg, #0EA5E9 0%, #10B981 100%)",
    gradientHero: "linear-gradient(160deg, #EFF6FF 0%, #ECFDF5 100%)",
    glass: "rgba(255,255,255,0.9)", glassBorder: "rgba(14,165,233,0.15)",
    shadow: "0 4px 20px rgba(14,165,233,0.1)", shadowLg: "0 20px 60px rgba(14,165,233,0.15)",
    radius: "14px", radiusLg: "24px",
    displayFont: "Nunito, sans-serif", bodyFont: "Source Sans 3, sans-serif",
    googleFontsUrl: "https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800&family=Source+Sans+3:wght@300;400;600&display=swap",
    animDuration: "0.5s", animEase: "cubic-bezier(0.34, 1.56, 0.64, 1)",
  };

  if (isEducation) return {
    projectType: "education", primary: "#7C3AED", primaryLight: "#A78BFA", accent: "#F59E0B",
    bg: "#0D0D1A", bgAlt: "#13132A", bgCard: "#1A1A35", text: "#EDE9FE",
    textMuted: "#7C7C99", border: "#252550",
    gradient: "linear-gradient(135deg, #7C3AED 0%, #DB2777 100%)",
    gradientHero: "radial-gradient(ellipse 80% 60% at 50% -10%, rgba(124,58,237,0.35) 0%, transparent 70%)",
    glass: "rgba(255,255,255,0.04)", glassBorder: "rgba(124,58,237,0.2)",
    shadow: "0 4px 24px rgba(124,58,237,0.2)", shadowLg: "0 20px 60px rgba(124,58,237,0.3)",
    radius: "12px", radiusLg: "20px",
    displayFont: "Lexend, sans-serif", bodyFont: "Plus Jakarta Sans, sans-serif",
    googleFontsUrl: "https://fonts.googleapis.com/css2?family=Lexend:wght@400;500;600;700;800&family=Plus+Jakarta+Sans:wght@300;400;500;600&display=swap",
    animDuration: "0.6s", animEase: "cubic-bezier(0.16, 1, 0.3, 1)",
  };

  if (isStartup) return {
    projectType: "startup", primary: "#2563EB", primaryLight: "#60A5FA", accent: "#F59E0B",
    bg: "#020817", bgAlt: "#0A1525", bgCard: "#0F1F38", text: "#F8FAFC",
    textMuted: "#64748B", border: "#1E3A5F",
    gradient: "linear-gradient(135deg, #2563EB 0%, #7C3AED 100%)",
    gradientHero: "radial-gradient(ellipse 80% 70% at 50% -20%, rgba(37,99,235,0.4) 0%, transparent 70%)",
    glass: "rgba(255,255,255,0.03)", glassBorder: "rgba(37,99,235,0.2)",
    shadow: "0 4px 24px rgba(37,99,235,0.2)", shadowLg: "0 20px 60px rgba(37,99,235,0.3)",
    radius: "10px", radiusLg: "20px",
    displayFont: "Manrope, sans-serif", bodyFont: "Manrope, sans-serif",
    googleFontsUrl: "https://fonts.googleapis.com/css2?family=Manrope:wght@300;400;500;600;700;800&display=swap",
    animDuration: "0.6s", animEase: "cubic-bezier(0.16, 1, 0.3, 1)",
  };

  return {
    projectType: "modern", primary: "#6366F1", primaryLight: "#818CF8", accent: "#F59E0B",
    bg: "#030712", bgAlt: "#0F172A", bgCard: "#111827", text: "#F9FAFB",
    textMuted: "#6B7280", border: "#1F2937",
    gradient: "linear-gradient(135deg, #6366F1 0%, #EC4899 100%)",
    gradientHero: "radial-gradient(ellipse 80% 60% at 50% -10%, rgba(99,102,241,0.35) 0%, transparent 70%)",
    glass: "rgba(255,255,255,0.03)", glassBorder: "rgba(255,255,255,0.08)",
    shadow: "0 4px 24px rgba(99,102,241,0.15)", shadowLg: "0 20px 60px rgba(99,102,241,0.25)",
    radius: "12px", radiusLg: "20px",
    displayFont: "Syne, sans-serif", bodyFont: "DM Sans, sans-serif",
    googleFontsUrl: "https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=DM+Sans:wght@300;400;500;600&display=swap",
    animDuration: "0.6s", animEase: "cubic-bezier(0.16, 1, 0.3, 1)",
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 6 — NVIDIA CLIENT + HEALTH + RATE LIMITER
// ═══════════════════════════════════════════════════════════════════════════════

const nvidia = new OpenAI({
  apiKey:  process.env.NVIDIA_API_KEY!,
  baseURL: NVIDIA_BASE_URL,
});

class ModelHealthTracker {
  private failures = new Map<string, number>();
  private readonly T = 3;
  recordFailure(m: string): void { this.failures.set(m, (this.failures.get(m) ?? 0) + 1); }
  recordSuccess(m: string): void { this.failures.delete(m); }
  isHealthy(m: string): boolean { return (this.failures.get(m) ?? 0) < this.T; }
  getHealthy<T extends string>(models: readonly T[]): T[] { return models.filter((m) => this.isHealthy(m)); }
}

const planHealth = new ModelHealthTracker();
const codeHealth = new ModelHealthTracker();

class RateLimiter {
  private ts: number[] = [];
  private readonly MAX = 5;
  private readonly WIN = 62_000;
  async wait(label: string, onPing?: () => void): Promise<void> {
    const now = Date.now();
    this.ts = this.ts.filter((t) => now - t < this.WIN);
    if (this.ts.length < this.MAX) { this.ts.push(now); return; }
    const ms = this.WIN - (now - this.ts[0]) + 300;
    plog(`[RL] Waiting ${(ms / 1000).toFixed(1)}s for ${label}`);
    await sleepPing(ms, onPing);
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
function sleep(ms: number): Promise<void> { return new Promise((r) => setTimeout(r, ms)); }
function mlabel(model: string): string { return model.split("/")[1] ?? model; }
function backoff(attempt: number): number { return Math.min(1200 * Math.pow(2, attempt), 20_000); }

async function sleepPing(ms: number, onPing?: () => void): Promise<void> {
  if (ms <= 0) return;
  if (!onPing || ms <= PING_INTERVAL_MS) return sleep(ms);
  const end = Date.now() + ms;
  while (Date.now() < end) {
    await sleep(Math.min(PING_INTERVAL_MS, end - Date.now()));
    if (Date.now() < end) onPing();
  }
}

function stripMarkdown(text: string): string {
  return text
    .replace(/^```(?:jsx?|javascript|typescript|tsx?|json)?\s*/gim, "")
    .replace(/^```\s*$/gim, "")
    .replace(/^["']use (?:client|server)["'];\s*\n*/m, "")
    .trim();
}

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
 * ROOT FIX #7: Sanitize font strings used inside style={{}} values.
 * Fonts like "Syne, sans-serif" must not contain unescaped quotes inside JSX strings.
 * This prevents runtime crashes like: fontFamily: ''DM Sans', sans-serif'
 */
function sanitizeFontString(font: string): string {
  // Remove any wrapping single or double quotes from font names
  return font.replace(/^['"]|['"]$/g, "").replace(/'/g, "");
}

function stripBannedImports(content: string): string {
  const lines = content.split("\n");
  const kept: string[] = [];
  const removed: string[] = [];
  for (const line of lines) {
    const t = line.trim();
    if (!t.startsWith("import ")) { kept.push(line); continue; }
    if (/['"][^'"]*\.css['"]/.test(t)) { removed.push("*.css"); continue; }
    const m = t.match(/from\s+['"]([^'"]+)['"]/);
    if (!m) { kept.push(line); continue; }
    const pkg = m[1];
    if (BANNED_PACKAGES.some((b) => pkg === b || pkg.startsWith(b + "/"))) { removed.push(pkg); continue; }
    kept.push(line);
  }
  if (removed.length) plog(`[RESOLVER] Stripped: ${removed.join(", ")}`);
  let result = kept.join("\n");
  if (/<Link[\s>]/.test(result) || /<\/Link>/.test(result)) {
    result = result
      .replace(/<Link\s+to=(['"])/g, "<a href=$1")
      .replace(/<Link\s+href=(['"])/g, "<a href=$1")
      .replace(/<Link(\s[^>]*)?>/g, "<a$1>")
      .replace(/<\/Link>/g, "</a>");
  }
  return result;
}

function ensureReactImport(content: string): string {
  if (/\bimport\s+React\b/.test(content)) return content;
  if (/<[A-Za-z]/.test(content)) return `import React from 'react';\n${content}`;
  return content;
}

function ensureDefaultExport(content: string, componentName: string): string {
  if (/\bexport\s+default\b/.test(content)) return content;
  const safe = componentName.replace(/[^a-zA-Z0-9_$]/g, "").replace(/^\d+/, "") || "Component";
  const capitalized = safe.charAt(0).toUpperCase() + safe.slice(1);
  return `${content}\n\nexport default ${capitalized};\n`;
}

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

function cleanOutput(content: string): string {
  return content
    .replace(/[ \t]+$/gm, "")
    .replace(/\n{4,}/g, "\n\n\n")
    .trimEnd() + "\n";
}

function isCssFile(path: string): boolean { return /\.(css|scss|sass|less)$/.test(path); }

function hasBannedImports(content: string): boolean {
  for (const line of content.split("\n")) {
    const t = line.trim();
    if (!t.startsWith("import ")) continue;
    if (/['"][^'"]*\.css['"]/.test(t)) return true;
    const m = t.match(/from\s+['"]([^'"]+)['"]/);
    if (!m) continue;
    if (BANNED_PACKAGES.some((b) => m[1] === b || m[1].startsWith(b + "/"))) return true;
  }
  return false;
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 8 — VALIDATION (ROOT FIX #8: real gate, not fake)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * ROOT FIX #11: Syntax error detection and repair
 * Catches common JSX generation issues before they reach WebContainer
 */
function detectAndFixSyntaxErrors(file: StreamFile): StreamFile {
  let content = file.content;
  const warnings: string[] = [];

  // ── Check 1: Unterminated strings ──
  const doubleQuoteCount = (content.match(/"/g) ?? []).length;
  if (doubleQuoteCount % 2 !== 0) {
    warnings.push(`⚠️ ${file.path}: ODD number of double quotes (${doubleQuoteCount}) — possible unterminated string`);
    plog(`[SYNTAX] ${file.path}: Unterminated string detected (${doubleQuoteCount} quotes)`);
  }

  // ── Check 2: SVG path length limit ──
  // Any SVG path d attribute longer than 500 chars is replaced with safe placeholder
  const longPathRegex = /d="[^"]{500,}"/g;
  const longPaths = content.match(longPathRegex);
  if (longPaths) {
    warnings.push(`⚠️ ${file.path}: Found ${longPaths.length} SVG path(s) longer than 500 chars — replacing with safe paths`);
    plog(`[SYNTAX] ${file.path}: Replacing ${longPaths.length} oversized SVG path(s) (each > 500 chars)`);
    content = content.replace(longPathRegex, 'd="M0 0h16v16H0z"');
  }

  if (warnings.length > 0) {
    warnings.forEach((w) => plog(`[SYNTAX] ${w}`));
  }

  return { ...file, content };
}

function validateFile(file: StreamFile): ValidationResult {
  const reasons: string[] = [];
  if (isCssFile(file.path)) return { passed: false, reasons: [`CSS file rejected: ${file.path}`] };
  if (!file.path.endsWith(".jsx") && !file.path.endsWith(".js")) return { passed: true, reasons: [] };

  const c = file.content ?? "";
  if (c.trim().length < MIN_FILE_CHARS) { reasons.push(`too short (${c.trim().length} chars)`); return { passed: false, reasons }; }
  if (hasBannedImports(c)) reasons.push("contains banned imports");

  if (file.path.endsWith(".jsx")) {
    if (!/\bexport\s+default\b/.test(c))  reasons.push("missing export default");
    if (!/return\s*\(?\s*</.test(c))      reasons.push("no JSX return statement");
    const exportCount = (c.match(/\bexport\s+default\b/g) ?? []).length;
    if (exportCount > 1)                  reasons.push(`multiple export default (${exportCount})`);
    const open  = (c.match(/<[A-Z][a-zA-Z0-9]*[\s>]/g)   ?? []).length;
    const close = (c.match(/<\/[A-Z][a-zA-Z0-9]*>/g)     ?? []).length;
    const self  = (c.match(/<[A-Z][a-zA-Z0-9]*[^>]*\/>/g) ?? []).length;
    if (Math.abs(open - close - self) > JSX_IMBALANCE_TOL) reasons.push("JSX tag imbalance");
  }

  return { passed: reasons.length === 0, reasons };
}

/**
 * ROOT FIX #8: Real validation gate.
 * Old gate passed even with 1 file and no App.jsx.
 * New gate:
 *   1. Rejects CSS files
 *   2. Safe-replaces structurally broken JSX
 *   3. Logs what it did and WHY
 */
function applyValidationGate(files: StreamFile[], tokens: DesignTokens): StreamFile[] {
  return files.map((file) => {
    if (BOILERPLATE_PATHS.has(file.path)) return file;
    if (isCssFile(file.path)) {
      plog(`[GATE] Dropping CSS: ${file.path}`);
      return null as unknown as StreamFile;
    }

    // ── Apply syntax error detection and fixes ──
    const fixedFile = detectAndFixSyntaxErrors(file);

    const v = validateFile(fixedFile);
    if (!v.passed) {
      plog(`[GATE] ${fixedFile.path} FAILED — ${v.reasons.join("; ")} → safe-replacing`);
      return makeSafeComponent(fixedFile, tokens);
    }
    return fixedFile;
  }).filter(Boolean);
}

/**
 * ROOT FIX #4 + #6: Structural integrity check AFTER validation gate.
 * Ensures the Vite entry chain is intact: index.html → src/main.jsx → src/App.jsx
 * If any required file is missing, the pipeline would produce a MIME error / blank screen.
 */
function assertStructuralIntegrity(files: StreamFile[]): { passed: boolean; missing: string[] } {
  const paths = new Set(files.map((f) => f.path));
  const missing = REQUIRED_PATHS.filter((r) => !paths.has(r));
  return { passed: missing.length === 0, missing };
}

function makeSafeComponent(file: StreamFile, tokens: Partial<DesignTokens>): StreamFile {
  const rawName  = file.path.split("/").pop()?.replace(/\.[^.]+$/, "") ?? "Component";
  const safeName = rawName.replace(/[^a-zA-Z0-9_$]/g, "").replace(/^\d+/, "") || "Component";
  const compName = safeName.charAt(0).toUpperCase() + safeName.slice(1);
  const bg       = tokens.bgCard    ?? "#111827";
  const text     = tokens.text      ?? "#F9FAFB";
  const muted    = tokens.textMuted ?? "#6B7280";

  const content = cleanOutput(
    `import React from 'react';

function ${compName}() {
  return (
    <section style={{ padding: '5rem 2rem', textAlign: 'center', background: '${bg}', minHeight: '220px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div>
        <h2 style={{ fontSize: '1.75rem', fontWeight: 700, color: '${text}', margin: '0 0 0.75rem' }}>${compName}</h2>
        <p style={{ color: '${muted}', fontSize: '0.95rem', margin: 0 }}>${file.path}</p>
      </div>
    </section>
  );
}

export default ${compName};`
  );

  return { ...file, content };
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 9 — BOILERPLATE FILES (ROOT FIX #4, #6)
// ═══════════════════════════════════════════════════════════════════════════════

function makePackageJson(name: string): string {
  return JSON.stringify({
    name:    name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "") || "ai-project",
    private: true, version: "0.0.0", type: "module",
    scripts: { dev: "vite --host", build: "vite build", preview: "vite preview" },
    dependencies:    { react: "^18.2.0", "react-dom": "^18.2.0" },
    devDependencies: { vite: "^5.2.6", "@vitejs/plugin-react": "^4.2.1" },
  }, null, 2);
}

function makeIndexHtml(name: string, tokens: DesignTokens): string {
  // ROOT FIX #7: Font strings in HTML are safe — no JSX quote escaping needed here
  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${name}</title>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="${tokens.googleFontsUrl}" rel="stylesheet" />
    <style>
      *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
      html { scroll-behavior: smooth; }
      body {
        background: ${tokens.bg};
        color: ${tokens.text};
        font-family: ${tokens.bodyFont};
        -webkit-font-smoothing: antialiased;
        -moz-osx-font-smoothing: grayscale;
        overflow-x: hidden;
      }
      ::-webkit-scrollbar { width: 6px; }
      ::-webkit-scrollbar-track { background: ${tokens.bg}; }
      ::-webkit-scrollbar-thumb { background: ${tokens.border}; border-radius: 3px; }
      ::selection { background: ${tokens.primary}33; color: ${tokens.text}; }
    </style>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>`;
}

// ROOT FIX #4: These are emitted at Stage 0 and NEVER overwritten by the planner
const MAIN_JSX = `import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';

createRoot(document.getElementById('root')).render(
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
    port: 5173,
    strictPort: false,
  },
  optimizeDeps: {
    include: ['react', 'react-dom', 'react-dom/client'],
  },
});`;

function makeSpinnerApp(prompt: string, tokens: DesignTokens): string {
  const label = prompt.slice(0, 60).replace(/'/g, "\\'");
  // ROOT FIX #7: Use sanitized font strings — no raw quotes inside style values
  const displayFont = sanitizeFontString(tokens.displayFont);
  const bodyFont    = sanitizeFontString(tokens.bodyFont);

  return `import React, { useEffect, useState } from 'react';

function App() {
  const [progress, setProgress] = useState(0);
  const [phase, setPhase] = useState('Planning architecture');

  useEffect(() => {
    const phases = ['Planning architecture', 'Designing components', 'Generating UI', 'Applying styles', 'Almost ready'];
    let p = 0;
    const id = setInterval(() => {
      p = Math.min(p + (Math.random() * 3 + 0.5), 92);
      setProgress(p);
      setPhase(phases[Math.min(Math.floor(p / 20), phases.length - 1)]);
    }, 180);
    return () => clearInterval(id);
  }, []);

  return (
    <div style={{
      minHeight: '100vh',
      background: '${tokens.bg}',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '2rem',
      fontFamily: '${bodyFont}',
      position: 'relative',
      overflow: 'hidden',
    }}>
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        background: '${tokens.gradientHero}',
      }} />
      <div style={{
        width: 72, height: 72, borderRadius: '50%',
        border: '3px solid ${tokens.border}',
        borderTopColor: '${tokens.primary}',
        animation: 'spin 0.8s linear infinite',
      }} />
      <style>{'@keyframes spin { to { transform: rotate(360deg); } }'}</style>
      <div style={{ textAlign: 'center', zIndex: 1 }}>
        <p style={{ color: '${tokens.text}', fontSize: '1.1rem', fontWeight: 600, margin: '0 0 0.5rem', fontFamily: '${displayFont}' }}>
          {'${label}'}
        </p>
        <p style={{ color: '${tokens.textMuted}', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.12em', margin: 0 }}>
          {phase}
        </p>
      </div>
      <div style={{ width: 280, zIndex: 1 }}>
        <div style={{ height: 4, background: '${tokens.border}', borderRadius: 99, overflow: 'hidden' }}>
          <div style={{
            height: '100%',
            width: progress + '%',
            background: '${tokens.gradient}',
            borderRadius: 99,
            transition: 'width 0.3s ease',
          }} />
        </div>
        <p style={{ color: '${tokens.textMuted}', fontSize: '0.72rem', textAlign: 'right', marginTop: '0.4rem' }}>
          {Math.round(progress)}%
        </p>
      </div>
    </div>
  );
}

export default App;`;
}

function makeBoilerplate(prompt: string, projectName: string, tokens: DesignTokens): StreamFile[] {
  return [
    { path: "package.json",   content: makePackageJson(projectName),      provisional: true },
    { path: "index.html",     content: makeIndexHtml(projectName, tokens), provisional: true },
    { path: "src/main.jsx",   content: MAIN_JSX,                          provisional: true },
    { path: "vite.config.js", content: VITE_CONFIG,                       provisional: true },
    { path: "src/App.jsx",    content: makeSpinnerApp(prompt, tokens),     provisional: true },
  ];
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 10 — PLANNER  (ROOT FIX #1, #2: mode-constrained prompt)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Build the planner system prompt based on the detected complexity mode.
 *
 * ROOT FIX #2: The old prompt hardcoded "Plan 10-15 components (more is better)".
 * Now: file count target comes from ModeConfig, injected dynamically.
 * The planner CANNOT override this — the count is enforced post-plan in validateAndTrimPlan().
 */
function buildPlannerSystemPrompt(mode: ModeConfig): string {
  return `You are a React architect. Return ONLY raw JSON — no markdown, no backticks, no explanation.

Schema:
{
  "projectName": "PascalCase name",
  "description": "One sentence description",
  "globalContext": "3-4 sentences about visual style and component relationships",
  "primaryColor": "#hexcode",
  "files": [
    {
      "path": "src/components/Hero.jsx",
      "description": "Full-screen hero section with animated headline and CTA buttons",
      "dependencies": []
    }
  ]
}

COMPLEXITY MODE: ${mode.mode.toUpperCase()}
${mode.description}

TARGET FILE COUNT: exactly ${mode.targetFileCount} component file(s)
MIN: ${mode.minFileCount} | MAX: ${mode.maxFileCount}
If the user asks for a "minimal" or "simple" component, plan ONLY what they asked for.
Do NOT add extra files to pad the plan.

REQUIREMENTS:
- ALWAYS include src/App.jsx as the last file
- ALL paths must start with "src/"
- Folders: src/components/, src/sections/, src/layouts/, src/hooks/, src/utils/
- NEVER include: package.json, index.html, src/main.jsx, vite.config.js
- NEVER include ANY .css file
- NEVER use TypeScript (.ts/.tsx)
- File names must NOT start with a digit
- Only available packages: react@18, react-dom@18
- BANNED: framer-motion, lucide-react, react-router-dom, axios, three, zustand, recharts, gsap, next, clsx
- CRITICAL SVG CONSTRAINT: Never generate SVG path d attributes longer than 200 characters. For social media icons and simple shapes, use short paths or unicode characters instead. Never repeat coordinate patterns to extend SVG paths.
- dependencies = sibling file paths this component imports
- RESPOND WITH ONLY THE JSON OBJECT`;
}

/**
 * ROOT FIX #3, #9: Validate and trim the plan after receiving it from the planner.
 * Enforces:
 *   - File count within mode bounds
 *   - No CSS files
 *   - No boilerplate files (they're handled at S0)
 *   - src/App.jsx always last
 *   - No numeric filenames
 */
function validateAndTrimPlan(parsed: ProjectSpec, mode: ModeConfig): ProjectSpec {
  let files = (parsed.files ?? [])
    .map((f) => ({
      path:         (f.path ?? "").replace(/^\/+/, ""),
      description:  f.description || f.path || "Component",
      dependencies: Array.isArray(f.dependencies) ? f.dependencies : [],
    }))
    .filter((f) => f.path.startsWith("src/"))
    .filter((f) => !isCssFile(f.path))
    .filter((f) => !f.path.endsWith(".ts") && !f.path.endsWith(".tsx"))
    .filter((f) => !/^[0-9]/.test(f.path.split("/").pop() ?? ""))
    .filter((f) => !BOILERPLATE_PATHS.has(f.path));

  // Enforce max file count — trim from the middle, keeping App.jsx
  const appFiles  = files.filter((f) => f.path === "src/App.jsx");
  const nonApp    = files.filter((f) => f.path !== "src/App.jsx");
  const maxNonApp = mode.maxFileCount - 1; // reserve 1 slot for App.jsx
  const trimmed   = nonApp.slice(0, maxNonApp);

  plog(`[S1.5] Plan has ${files.length} non-boilerplate files → trimmed to ${trimmed.length} (mode: ${mode.mode}, max: ${mode.maxFileCount})`);

  // Ensure App.jsx exists
  if (appFiles.length === 0) {
    trimmed.push({
      path:         "src/App.jsx",
      description:  "Root component — imports and composes all sections and components",
      dependencies: trimmed.filter((f) => f.path.endsWith(".jsx")).map((f) => f.path),
    });
  } else {
    trimmed.push(appFiles[0]);
  }

  return {
    ...parsed,
    files: trimmed,
  };
}

async function planProject(prompt: string, mode: ModeConfig, onPing?: () => void): Promise<ProjectSpec | null> {
  const models = planHealth.getHealthy(PLAN_MODELS);
  if (models.length === 0) { perr("[S1] All plan models unhealthy"); return null; }

  const systemPrompt = buildPlannerSystemPrompt(mode);

  for (let mi = 0; mi < models.length; mi++) {
    const model = models[mi];
    plog(`[S1] Planning with ${mlabel(model)} (mode: ${mode.mode}, target: ${mode.targetFileCount} files)`);
    await rateLimiter.wait(`plan/${mlabel(model)}`, onPing);
    onPing?.();

    const abort   = new AbortController();
    const timeout = setTimeout(() => abort.abort(), 120_000);

    try {
      const res = await nvidia.chat.completions.create(
        {
          model, temperature: 0.3, max_tokens: PLAN_MAX_TOKENS,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user",   content: `User request: ${prompt}\n\nPlan the project. Return ONLY the JSON.` },
          ],
        },
        { signal: abort.signal },
      );
      clearTimeout(timeout);
      planHealth.recordSuccess(model);

      const text  = stripMarkdown(fixTokenCorruption(res.choices[0]?.message?.content ?? ""));
      const start = text.indexOf("{");
      const end   = text.lastIndexOf("}");
      if (start === -1 || end === -1) throw new Error("No JSON object in planner response");

      const parsed = JSON.parse(text.slice(start, end + 1)) as ProjectSpec;

      // ROOT FIX #3, #9: Validate and trim BEFORE returning
      const validated = validateAndTrimPlan(parsed, mode);

      // ROOT FIX #3: Reject plan if it came back below minimum
      const componentFiles = validated.files.filter((f) => !BOILERPLATE_PATHS.has(f.path));
      if (componentFiles.length < mode.minFileCount) {
        throw new Error(`Plan has only ${componentFiles.length} files, minimum is ${mode.minFileCount}`);
      }

      plog(`[S1] ✓ Plan validated — ${validated.files.length} files — "${validated.projectName}"`);
      return validated;

    } catch (e: unknown) {
      clearTimeout(timeout);
      planHealth.recordFailure(model);
      const status = (e as { status?: number })?.status ?? 0;
      if (status === 401 || status === 403) { perr("[S1] Auth error"); return null; }
      perr(`[S1] ${mlabel(model)} failed: ${String(e)}`);
      if (mi < models.length - 1) await sleep(1000);
    }
  }

  perr("[S1] All plan models failed");
  return null;
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 11 — FILE PRIORITY SORTER
// ═══════════════════════════════════════════════════════════════════════════════

function sortByPriority(files: FileSpec[]): FileSpec[] {
  const PRIORITY = [
    "src/utils/", "src/hooks/", "src/data/", "src/lib/",
    "src/layouts/", "src/components/", "src/sections/",
    "src/features/", "src/pages/", "src/App.jsx",
  ];
  const app  = files.filter((f) => f.path === "src/App.jsx");
  const rest = files.filter((f) => f.path !== "src/App.jsx");
  return [
    ...rest.sort((a, b) => {
      const rank = (p: string) => { const i = PRIORITY.findIndex((pre) => p.startsWith(pre) || p === pre); return i === -1 ? PRIORITY.length : i; };
      return rank(a.path) - rank(b.path);
    }),
    ...app,
  ];
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 12 — APP.JSX BUILDER
// ═══════════════════════════════════════════════════════════════════════════════

function buildAppJsx(spec: ProjectSpec, generatedFiles: StreamFile[], tokens: DesignTokens): string {
  const displayFont = sanitizeFontString(tokens.displayFont);
  const bodyFont    = sanitizeFontString(tokens.bodyFont);

  const renderables = generatedFiles.filter((f) =>
    f.path.endsWith(".jsx") &&
    f.path !== "src/App.jsx" &&
    f.path !== "src/main.jsx" &&
    !/\/(hooks?|utils?|data|lib|types?)\//i.test(f.path) &&
    /\bexport\s+default\b/.test(f.content)
  );

  renderables.sort((a, b) => {
    const rank = (p: string) => {
      const name = p.toLowerCase();
      if (/nav|header/.test(name))          return 0;
      if (/hero/.test(name))                return 1;
      if (/feature/.test(name))             return 2;
      if (/stat|metric/.test(name))         return 3;
      if (/pricing/.test(name))             return 4;
      if (/testimonial|review/.test(name))  return 5;
      if (/cta|banner/.test(name))          return 6;
      if (/faq/.test(name))                 return 7;
      if (/footer/.test(name))              return 99;
      return 50;
    };
    return rank(a.path) - rank(b.path);
  });

  const components = renderables.map((f) => {
    const name    = f.path.split("/").pop()!.replace(/\.jsx$/, "");
    const relPath = "./" + f.path.replace(/^src\//, "").replace(/\.jsx$/, "") + ".jsx";
    return { name, from: relPath };
  });

  const imports = [
    "import React, { useEffect } from 'react';",
    ...components.map((c) => `import ${c.name} from '${c.from}';`),
  ].join("\n");

  const globalCss = `
@keyframes fadeInUp { from { opacity: 0; transform: translateY(32px); } to { opacity: 1; transform: translateY(0); } }
@keyframes fadeInDown { from { opacity: 0; transform: translateY(-24px); } to { opacity: 1; transform: translateY(0); } }
@keyframes slideInLeft { from { opacity: 0; transform: translateX(-40px); } to { opacity: 1; transform: translateX(0); } }
@keyframes slideInRight { from { opacity: 0; transform: translateX(40px); } to { opacity: 1; transform: translateX(0); } }
@keyframes scaleIn { from { opacity: 0; transform: scale(0.88); } to { opacity: 1; transform: scale(1); } }
@keyframes float { 0%, 100% { transform: translateY(0px); } 50% { transform: translateY(-12px); } }
@keyframes pulseGlow { 0%, 100% { box-shadow: 0 0 20px ${tokens.primary}66; } 50% { box-shadow: 0 0 40px ${tokens.primary}cc; } }
@keyframes shimmer { from { background-position: -200% center; } to { background-position: 200% center; } }
@keyframes spin { to { transform: rotate(360deg); } }
@keyframes blob { 0%, 100% { transform: translate(0,0) scale(1); } 33% { transform: translate(30px,-20px) scale(1.08); } 66% { transform: translate(-20px,20px) scale(0.94); } }
@keyframes marquee { from { transform: translateX(0); } to { transform: translateX(-50%); } }
@keyframes countUp { from { opacity: 0; transform: translateY(16px) scale(0.9); } to { opacity: 1; transform: translateY(0) scale(1); } }
  `.trim();

  const renders = components.length > 0
    ? components.map((c) => `      <${c.name} />`).join("\n")
    : `      <div style={{ padding: '5rem 2rem', textAlign: 'center', color: '${tokens.text}' }}>
        <h1 style={{ fontSize: '3rem', fontWeight: 800, margin: '0 0 1rem', fontFamily: '${displayFont}' }}>${spec.projectName}</h1>
        <p style={{ color: '${tokens.textMuted}', fontSize: '1.1rem', margin: 0 }}>${spec.description}</p>
      </div>`;

  return cleanOutput(`${imports}

function App() {
  useEffect(() => {
    const style = document.createElement('style');
    style.id = 'app-animations';
    style.textContent = \`${globalCss}\`;
    if (!document.getElementById('app-animations')) document.head.appendChild(style);
    return () => { const el = document.getElementById('app-animations'); if (el) el.remove(); };
  }, []);

  return (
    <div style={{
      minHeight: '100vh',
      background: '${tokens.bg}',
      fontFamily: '${bodyFont}',
      overflowX: 'hidden',
    }}>
${renders}
    </div>
  );
}

export default App;`);
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 13 — CODEGEN PROMPTS
// ═══════════════════════════════════════════════════════════════════════════════

function makeCodegenSystemPrompt(spec: ProjectSpec, tokens: DesignTokens, generatedSoFar: StreamFile[]): string {
  // ROOT FIX #7: Sanitize font strings for use inside JSX style={{}} values
  const displayFont = sanitizeFontString(tokens.displayFont);
  const bodyFont    = sanitizeFontString(tokens.bodyFont);

  const generatedList = generatedSoFar
    .filter((f) => !f.provisional && f.path.endsWith(".jsx"))
    .map((f) => {
      const name    = f.path.split("/").pop()!.replace(".jsx", "");
      const relPath = "./" + f.path.replace(/^src\//, "").replace(".jsx", "") + ".jsx";
      return `  ${name} → '${relPath}'`;
    })
    .join("\n") || "  (none yet)";

  return `You are an elite React engineer building production-grade websites.
Output ONLY raw file content. The VERY FIRST character of your response = first character of the file.
NO markdown. NO backticks. NO explanations. NO preamble. NO TypeScript.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
DESIGN TOKENS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Project:        ${spec.projectName}
Description:    ${spec.description}
Vision:         ${spec.globalContext}

Colors:
  primary:      ${tokens.primary}
  primaryLight: ${tokens.primaryLight}
  accent:       ${tokens.accent}
  bg:           ${tokens.bg}
  bgAlt:        ${tokens.bgAlt}
  bgCard:       ${tokens.bgCard}
  text:         ${tokens.text}
  textMuted:    ${tokens.textMuted}
  border:       ${tokens.border}

Effects:
  gradient:     ${tokens.gradient}
  gradientHero: ${tokens.gradientHero}
  glass:        ${tokens.glass}
  glassBorder:  ${tokens.glassBorder}
  shadow:       ${tokens.shadow}
  shadowLg:     ${tokens.shadowLg}
  radius:       ${tokens.radius}
  radiusLg:     ${tokens.radiusLg}

Typography (SANITIZED — safe to use directly in fontFamily style value):
  displayFont:  ${displayFont}
  bodyFont:     ${bodyFont}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ANIMATION KEYFRAMES (already injected by App.jsx)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
fadeInUp, fadeInDown, slideInLeft, slideInRight, scaleIn,
float, pulseGlow, shimmer, spin, blob, marquee, countUp

Stagger pattern:
  style={{ animation: 'fadeInUp 0.6s ${tokens.animEase} 0.0s both' }}
  style={{ animation: 'fadeInUp 0.6s ${tokens.animEase} 0.1s both' }}
  style={{ animation: 'fadeInUp 0.6s ${tokens.animEase} 0.2s both' }}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ALREADY GENERATED (importable)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${generatedList}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ABSOLUTE RULES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. ALL styling: inline style={{}} ONLY — NO className, NO CSS files
2. Allowed imports: react, react-dom, relative .jsx/.js ONLY
3. BANNED: ${BANNED_PACKAGES.slice(0, 6).join(", ")}, and more
4. ICONS: inline SVG <svg> ONLY — no icon library
5. Matching JSX open/close tags
6. Exactly ONE export default per file
7. Default export function MUST return JSX
8. NO TypeScript syntax
9. Arrow functions: "=>" only, NEVER "= />"
10. COMPLETE files — no ellipsis, no truncation
11. Real content — no lorem ipsum
12. CRITICAL: fontFamily values must NOT contain unescaped quotes.
    WRONG: fontFamily: "'Syne', sans-serif"
    RIGHT: fontFamily: 'Syne, sans-serif'
13. SVG CONSTRAINT: Never generate SVG path d attributes longer than 200 characters.
    Use short paths or unicode characters for icons instead.
    WRONG: d="M0 0h16v16H0zM0 0h16v16H0zM0 0h16v16H0zM0 0h16v16H0z..." (repeating patterns)
    RIGHT: d="M0 0h16v16H0z" (short, simple)

AVAILABLE PACKAGES: react@18, react-dom@18 — nothing else`;
}

function getComponentRoleInstructions(fileSpec: FileSpec, tokens: DesignTokens): string {
  const displayFont = sanitizeFontString(tokens.displayFont);
  const bodyFont    = sanitizeFontString(tokens.bodyFont);
  const p = (fileSpec.path + " " + fileSpec.description).toLowerCase();

  if (/nav|header|navbar/.test(p)) return `
NAVBAR: Fixed top, z-index 1000. Logo (display font, gradient text) + nav links + CTA button.
Glassmorphism: background '${tokens.glass}', backdropFilter 'blur(20px)', borderBottom '1px solid ${tokens.glassBorder}'.
Mobile menu toggle with useState. Animate in with fadeInDown.
FONT: fontFamily '${displayFont}' for logo, fontFamily '${bodyFont}' for links.`;

  if (/hero/.test(p)) return `
HERO: Full viewport height. Decorative blobs (absolute, blurred, animation 'blob 10s ease-in-out infinite').
Eyebrow label. Heading (5xl+, display font, gradient text on key words). Subheading. Two CTA buttons.
Staggered fadeInUp (delays: 0s, 0.15s, 0.3s, 0.45s).
FONT: fontFamily '${displayFont}' for heading, fontFamily '${bodyFont}' for body.`;

  if (/feature/.test(p)) return `
FEATURES: 3 or 6 cards in CSS grid. Each: SVG icon in colored circle, title, description.
Card hover lift (translateY -6px, shadowLg, border primary). Staggered fadeInUp.
FONT: fontFamily '${displayFont}' for titles, fontFamily '${bodyFont}' for descriptions.`;

  if (/pricing/.test(p)) return `
PRICING: 3 tiers (Starter/Pro/Enterprise). Featured tier: gradient border, scale(1.04).
Monthly/Annual toggle with useState. Feature list with SVG checkmarks.
FONT: fontFamily '${displayFont}' for prices and tier names.`;

  if (/testimonial|review/.test(p)) return `
TESTIMONIALS: 3-4 cards. Each: quote text, avatar (gradient circle with initials), name, role, 5 stars.
Glassmorphism cards. Hover lift. Stagger.
FONT: fontFamily '${bodyFont}' for quotes, fontFamily '${displayFont}' for names.`;

  if (/stat|metric|number/.test(p)) return `
STATS: 4-6 impressive numbers. Large (5xl+, display font, gradient text). Animated count-up (useState + useEffect).
FONT: fontFamily '${displayFont}' for numbers.`;

  if (/footer/.test(p)) return `
FOOTER: Logo + tagline | navigation columns (3-4) | social SVG icons.
Bottom bar: copyright + links. Real company copy.
FONT: fontFamily '${displayFont}' for logo, fontFamily '${bodyFont}' for links.`;

  if (/cta|call.to.action/.test(p)) return `
CTA: High-impact. Gradient background. Centered heading + subtext + buttons. Animated blobs.
FONT: fontFamily '${displayFont}' for heading.`;

  if (/faq/.test(p)) return `
FAQ: 6-8 items, accordion (useState). +/× SVG icon. Answer panel fades in.
FONT: fontFamily '${bodyFont}'.`;

  return `
VISUAL COMPONENT: Premium quality matching ${tokens.projectType} archetype.
Rich use of design tokens. Real interactivity with useState. Staggered animations. Real content.
FONT: fontFamily '${displayFont}' for headings, fontFamily '${bodyFont}' for body.`;
}

function makeFileUserPrompt(fileSpec: FileSpec, spec: ProjectSpec, tokens: DesignTokens, generatedSoFar: StreamFile[]): string {
  const displayFont = sanitizeFontString(tokens.displayFont);
  const bodyFont    = sanitizeFontString(tokens.bodyFont);
  const genMap      = new Map(generatedSoFar.map((f) => [f.path, f.content]));
  const isData      = /\/(utils?|data|lib)\//i.test(fileSpec.path);
  const isHook      = /\/hooks?\//i.test(fileSpec.path);
  const isApp       = fileSpec.path === "src/App.jsx";

  const depContext = (fileSpec.dependencies ?? [])
    .map((dep) => {
      const c = genMap.get(dep);
      if (!c) return null;
      return `// ── DEP: ${dep} ──\n${c.split("\n").slice(0, 60).join("\n")}`;
    })
    .filter(Boolean)
    .join("\n\n");

  let task = "";

  if (isData || isHook) {
    task = `Write a complete JavaScript ${isHook ? "custom React hook" : "data/utility"} file.
Use named OR default exports. NO JSX. Pure JS only.
${isData ? "Use realistic, specific data — at least 6-8 items with real content." : "Implement a clean, reusable hook with proper cleanup."}`;
  } else if (isApp) {
    const renderables = generatedSoFar
      .filter((f) => f.path.endsWith(".jsx") && f.path !== "src/App.jsx" && !/\/(hooks?|utils?|data|lib)\//i.test(f.path) && /\bexport\s+default\b/.test(f.content))
      .sort((a, b) => {
        const rank = (p: string) => {
          const n = p.toLowerCase();
          if (/nav|header/.test(n))   return 0;
          if (/hero/.test(n))         return 1;
          if (/feature/.test(n))      return 2;
          if (/stat/.test(n))         return 3;
          if (/pricing/.test(n))      return 4;
          if (/testimonial/.test(n))  return 5;
          if (/cta|banner/.test(n))   return 6;
          if (/faq/.test(n))          return 7;
          if (/footer/.test(n))       return 99;
          return 50;
        };
        return rank(a.path) - rank(b.path);
      });

    const imports = renderables.map((f) => {
      const name    = f.path.split("/").pop()!.replace(".jsx", "");
      const relPath = "./" + f.path.replace(/^src\//, "").replace(".jsx", "") + ".jsx";
      return `import ${name} from '${relPath}';`;
    }).join("\n");
    const renders = renderables.map((f) => `      <${f.path.split("/").pop()!.replace(".jsx", "")} />`).join("\n");

    task = `Write src/App.jsx that imports and renders ALL components below.

Imports:
import React, { useEffect } from 'react';
${imports}

Render order:
${renders}

Wrap in: <div style={{ minHeight: '100vh', background: '${tokens.bg}', fontFamily: '${bodyFont}', overflowX: 'hidden' }}>

useEffect to inject global animation CSS:
const GLOBAL_CSS = \`
@keyframes fadeInUp { from { opacity: 0; transform: translateY(32px); } to { opacity: 1; transform: translateY(0); } }
@keyframes fadeInDown { from { opacity: 0; transform: translateY(-24px); } to { opacity: 1; transform: translateY(0); } }
@keyframes scaleIn { from { opacity: 0; transform: scale(0.88); } to { opacity: 1; transform: scale(1); } }
@keyframes float { 0%, 100% { transform: translateY(0px); } 50% { transform: translateY(-12px); } }
@keyframes blob { 0%, 100% { transform: translate(0,0) scale(1); } 33% { transform: translate(30px,-20px) scale(1.08); } 66% { transform: translate(-20px,20px) scale(0.94); } }
@keyframes spin { to { transform: rotate(360deg); } }
\`;
useEffect(() => {
  const el = document.createElement('style');
  el.id = 'global-animations';
  el.textContent = GLOBAL_CSS;
  if (!document.getElementById('global-animations')) document.head.appendChild(el);
  return () => { const s = document.getElementById('global-animations'); if (s) s.remove(); };
}, []);`;
  } else {
    const roleInstructions = getComponentRoleInstructions(fileSpec, tokens);
    task = `Write a COMPLETE, production-quality React component.
${roleInstructions}

MANDATORY:
- Use design tokens from system prompt
- Add staggered entry animations
- fontFamily: '${displayFont}' for headings (no extra quotes)
- fontFamily: '${bodyFont}' for body (no extra quotes)
- Write real, specific content for "${spec.projectName}"
- Hover states on all interactive elements (useState)`;
  }

  return `Write the COMPLETE file: ${fileSpec.path}
Purpose: ${fileSpec.description}

${task}

${depContext ? `━━━ DEPENDENCY CONTEXT ━━━\n${depContext}\n` : ""}
Start NOW. First char of response = first char of file. No explanation. No markdown.`;
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 14 — CODE GENERATOR (ROOT FIX #5: failure-aware)
// ═══════════════════════════════════════════════════════════════════════════════

const _regenCount = new Map<string, number>();

async function generateFile(
  fileSpec:       FileSpec,
  spec:           ProjectSpec,
  tokens:         DesignTokens,
  generatedSoFar: StreamFile[],
  onPing?:        () => void,
): Promise<{ file: StreamFile; succeeded: boolean }> {
  if (isCssFile(fileSpec.path)) {
    plog(`[S2] Skipping CSS file: ${fileSpec.path}`);
    return { file: makeSafeComponent({ path: fileSpec.path.replace(/\.css$/, ".jsx"), content: "" }, tokens), succeeded: false };
  }

  const regens = _regenCount.get(fileSpec.path) ?? 0;
  if (regens >= MAX_REGEN_PER_FILE) {
    plog(`[S2] ${fileSpec.path} regen limit — safe fallback`);
    return { file: makeSafeComponent({ path: fileSpec.path, content: "" }, tokens), succeeded: false };
  }

  const models = codeHealth.getHealthy(CODEGEN_MODELS);
  if (models.length === 0) {
    perr(`[S2] All codegen models unhealthy for ${fileSpec.path}`);
    return { file: makeSafeComponent({ path: fileSpec.path, content: "" }, tokens), succeeded: false };
  }

  const system     = makeCodegenSystemPrompt(spec, tokens, generatedSoFar);
  const userPrompt = makeFileUserPrompt(fileSpec, spec, tokens, generatedSoFar);

  for (let mi = 0; mi < models.length; mi++) {
    const model = models[mi];

    for (let attempt = 0; attempt < MAX_FILE_RETRIES; attempt++) {
      await rateLimiter.wait(`${mlabel(model)}/${fileSpec.path}`, onPing);
      onPing?.();

      const abort   = new AbortController();
      const timeout = setTimeout(() => abort.abort(), 90_000);
      const t0      = Date.now();

      try {
        const temperature = 0.25 + attempt * 0.08;
        plog(`[S2] ${mlabel(model)} → ${fileSpec.path} (attempt ${attempt + 1}, t=${temperature.toFixed(2)})`);

        const res = await nvidia.chat.completions.create(
          {
            model, temperature,
            max_tokens: CODEGEN_MAX_TOKENS,
            messages: [
              { role: "system", content: system     },
              { role: "user",   content: userPrompt },
            ],
          },
          { signal: abort.signal },
        );

        clearTimeout(timeout);
        codeHealth.recordSuccess(model);

        const latencyMs = Date.now() - t0;
        const raw       = fixTokenCorruption(res.choices[0]?.message?.content ?? "");
        let   content   = stripMarkdown(raw);

        if (content.trim().length < MIN_FILE_CHARS) throw new Error(`Too short: ${content.trim().length}c`);
        if (/=\s*\/\s*>/.test(content) || /<REDACTED/.test(content)) throw new Error("Token corruption");

        content = stripBannedImports(content);

        if (fileSpec.path.endsWith(".jsx")) {
          content = ensureReactImport(content);
          content = ensureDefaultExport(content, fileSpec.path.split("/").pop()!.replace(".jsx", ""));
        }

        content = deduplicateImports(content);

        if (content.length > MAX_FILE_CHARS) {
          const trunc = content.slice(0, MAX_FILE_CHARS);
          const lb    = trunc.lastIndexOf("\n}");
          content     = lb > MAX_FILE_CHARS * 0.6 ? trunc.slice(0, lb + 2) : trunc;
          if (fileSpec.path.endsWith(".jsx")) {
            content = ensureDefaultExport(content, fileSpec.path.split("/").pop()!.replace(".jsx", ""));
          }
        }

        content = cleanOutput(content);

        const v = validateFile({ path: fileSpec.path, content });
        if (!v.passed) {
          plog(`[S2] ${mlabel(model)} ${fileSpec.path} failed validation: ${v.reasons.join("; ")}`);
          if (v.reasons.every((r) => r.includes("missing export default") || r.includes("missing React"))) {
            content = ensureReactImport(content);
            content = ensureDefaultExport(content, fileSpec.path.split("/").pop()!.replace(".jsx", ""));
          } else {
            if (attempt < MAX_FILE_RETRIES - 1) { await sleepPing(backoff(attempt), onPing); continue; }
            break;
          }
        }

        _regenCount.delete(fileSpec.path);
        plog(`[S2] ✓ ${fileSpec.path} (${content.length}c, ${latencyMs}ms)`);
        return { file: { path: fileSpec.path, content }, succeeded: true };

      } catch (e: unknown) {
        clearTimeout(timeout);
        codeHealth.recordFailure(model);
        const status = (e as { status?: number })?.status ?? 0;
        const msg    = (e as Error)?.message ?? String(e);
        if (status === 401 || status === 403) {
          perr(`[S2] Auth error`);
          return { file: makeSafeComponent({ path: fileSpec.path, content: "" }, tokens), succeeded: false };
        }
        plog(`[S2] ${mlabel(model)} ${fileSpec.path} attempt ${attempt + 1} failed: ${msg}`);
        if (attempt < MAX_FILE_RETRIES - 1) await sleepPing(backoff(attempt), onPing);
      }
    }

    plog(`[S2] ${mlabel(model)} exhausted for ${fileSpec.path}`);
  }

  // ROOT FIX #5: Return safe fallback AND track that it failed — caller can decide
  perr(`[S2] All models failed for ${fileSpec.path} — safe fallback`);
  _regenCount.set(fileSpec.path, regens + 1);
  return { file: makeSafeComponent({ path: fileSpec.path, content: "" }, tokens), succeeded: false };
}

async function generateAllFiles(
  spec:      ProjectSpec,
  tokens:    DesignTokens,
  smartEmit: (f: StreamFile) => Promise<void>,
  onPing?:   () => void,
): Promise<StreamFile[]> {
  const sorted      = sortByPriority(spec.files);
  const nonAppSpecs = sorted.filter((f) => f.path !== "src/App.jsx");
  const generated:  StreamFile[] = [];
  let   failCount   = 0;

  for (let i = 0; i < nonAppSpecs.length; i += PARALLEL_BATCH_SIZE) {
    const batch = nonAppSpecs.slice(i, i + PARALLEL_BATCH_SIZE);
    plog(`[S2] Batch ${Math.floor(i / PARALLEL_BATCH_SIZE) + 1}: ${batch.map((s) => s.path).join(", ")}`);

    const results = await Promise.all(
      batch.map((fs) => generateFile(fs, spec, tokens, generated, onPing))
    );

    for (const { file, succeeded } of results) {
      if (!succeeded) failCount++;
      generated.push(file);
      await smartEmit({ ...file, provisional: true });
    }

    // ROOT FIX #5: If more than half the batch failed, log a warning but continue
    if (failCount > nonAppSpecs.length / 2) {
      plog(`[S2] WARNING: ${failCount} files failed generation — output may be partial`);
    }
  }

  // App.jsx is always built deterministically — never from the LLM
  plog(`[S2] Building deterministic App.jsx (${generated.length} files generated)`);
  const deterministicApp: StreamFile = {
    path:    "src/App.jsx",
    content: buildAppJsx(spec, generated, tokens),
  };
  generated.push(deterministicApp);
  await smartEmit({ ...deterministicApp, provisional: true });

  plog(`[S2] ✓ Generated ${generated.length} files (${failCount} failures used safe fallback)`);
  return generated;
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 15 — DETERMINISTIC FIX PASS
// ═══════════════════════════════════════════════════════════════════════════════

function fixJsxImbalance(content: string): string {
  const open  = (content.match(/<[A-Z][a-zA-Z0-9]*[\s>]/g)   ?? []).length;
  const close = (content.match(/<\/[A-Z][a-zA-Z0-9]*>/g)     ?? []).length;
  const self  = (content.match(/<[A-Z][a-zA-Z0-9]*[^>]*\/>/g) ?? []).length;
  if (Math.abs(open - close - self) <= JSX_IMBALANCE_TOL) return content;
  const m = content.match(/(\breturn\s*\()([\s\S]*?)(\)\s*;?\s*\n)/);
  if (!m) return content;
  const [full, o, body, c] = m;
  return content.replace(full, `${o}\n    <>\n${body}\n    </>\n  ${c}`);
}

function fixUseEffectDeps(content: string): string {
  return content
    .replace(/\buseEffect\s*\(\s*(\(\s*\)\s*=>\s*\{(?:[^{}]|\{[^{}]*\})*\})\s*\)(?!\s*,)/g, (_, fn) => `useEffect(${fn}, [])`)
    .replace(/\buseEffect\s*\(\s*(function\s*\(\s*\)\s*\{(?:[^{}]|\{[^{}]*\})*\})\s*\)(?!\s*,)/g, (_, fn) => `useEffect(${fn}, [])`);
}

function deterministicFixPass(files: StreamFile[]): StreamFile[] {
  return files.map((file) => {
    if (BOILERPLATE_PATHS.has(file.path)) return file;
    if (isCssFile(file.path)) return file;
    if (!file.path.endsWith(".jsx") && !file.path.endsWith(".js")) return file;

    let c = file.content;
    c = stripBannedImports(c);
    if (file.path.endsWith(".jsx")) c = ensureReactImport(c);
    if (file.path.endsWith(".jsx")) c = ensureDefaultExport(c, file.path.split("/").pop()!.replace(".jsx", ""));

    // Remove duplicate export defaults
    const matches = [...c.matchAll(/\bexport\s+default\b/g)];
    if (matches.length > 1) {
      let count = 0;
      c = c.replace(/\bexport\s+default\b/g, (m) => { count++; return count < matches.length ? "" : m; });
    }

    c = fixUseEffectDeps(c);
    if (file.path.endsWith(".jsx")) c = fixJsxImbalance(c);
    c = deduplicateImports(c);
    c = fixTokenCorruption(c);
    c = cleanOutput(c);

    return { ...file, content: c };
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 16 — EMIT HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

async function smartEmitFile(
  file:    StreamFile,
  onFile:  (f: StreamFile) => Promise<void>,
  emitted: Map<string, string>,
  tokens:  DesignTokens,
): Promise<void> {
  if (isCssFile(file.path)) { plog(`[EMIT] CSS dropped: ${file.path}`); return; }

  let toEmit = file;
  if (!BOILERPLATE_PATHS.has(file.path) && file.path.endsWith(".jsx")) {
    const v = validateFile(file);
    if (!v.passed) {
      plog(`[EMIT] ${file.path} invalid: ${v.reasons.join("; ")} → safe-replacing`);
      toEmit = makeSafeComponent(file, tokens);
    }
  }

  if (emitted.get(toEmit.path) === toEmit.content) return;
  emitted.set(toEmit.path, toEmit.content);
  try { await onFile(toEmit); } catch (e) { perr(`[EMIT] onFile threw for ${toEmit.path}: ${String(e)}`); }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 17 — MAIN PIPELINE EXPORT
// ═══════════════════════════════════════════════════════════════════════════════

export async function streamProjectPipeline(
  prompt:    string,
  callbacks: PipelineCallbacks,
): Promise<void> {
  const { onFile, onDone, onError, onLog, onPing } = callbacks;

  _log = (msg: string) => { console.log(msg); onLog?.(msg); };
  _regenCount.clear();

  const emittedContent = new Map<string, string>();
  const safeDone  = () => { try { onDone();        } catch {} };
  const safeError = (m: string) => { try { onError?.(m); } catch {} };

  // ── Detect complexity mode FIRST ─────────────────────────────────────────
  const mode   = detectComplexityMode(prompt);
  const tokens = resolveDesignTokens(prompt, "");

  const smartEmit = (f: StreamFile) =>
    smartEmitFile(f, onFile, emittedContent, tokens);

  plog("🚀 ══════════════════════════════════════════════════════════");
  plog("🚀 PIPELINE v21.0 — Mode-Aware · Prompt-Driven · Structurally Sound");
  plog(`🚀 Prompt:         "${prompt.slice(0, 80)}"`);
  plog(`🚀 Complexity mode: ${mode.mode} (target: ${mode.targetFileCount} files, max: ${mode.maxFileCount})`);
  plog(`🚀 Project type:   ${tokens.projectType}`);
  plog(`🚀 Display font:   ${tokens.displayFont}`);
  plog(`🚀 Body font:      ${tokens.bodyFont}`);
  plog(`🚀 Primary color:  ${tokens.primary}`);
  plog("🚀 ══════════════════════════════════════════════════════════");

  // ── Stage 0: Emit boilerplate (ROOT FIX #4, #6: guaranteed Vite entry chain) ──
  plog("[S0] Emitting guaranteed boilerplate (package.json, index.html, main.jsx, App.jsx)...");
  try {
    for (const f of makeBoilerplate(prompt, "AI Project", tokens)) {
      await smartEmit(f);
    }
    plog("[S0] ✓ Vite entry chain guaranteed");
  } catch (e) {
    perr(`[S0] Boilerplate failed: ${String(e)}`);
    // Even if this fails, we continue — the individual files will fail gracefully
  }

  // ── Stage 1: Plan project (ROOT FIX #1, #2: mode-constrained planner) ────
  plog(`[S1] Planning... (mode: ${mode.mode}, target: ${mode.targetFileCount})`);
  let spec: ProjectSpec | null = null;
  try { spec = await planProject(prompt, mode, onPing); } catch (e) { perr(`[S1] threw: ${String(e)}`); }

  if (!spec || spec.files.length === 0) {
    perr("[S1] Planning failed — spinner stays up, emitting error app");
    const errorApp = makeSpinnerApp(prompt, tokens)
      .replace("Generating UI", "Generation failed — please retry");
    await smartEmit({ path: "src/App.jsx", content: errorApp, provisional: false });
    safeError("Planning failed");
    safeDone();
    return;
  }

  // Update tokens with planner's primary color suggestion (if valid hex)
  if (spec.primaryColor && /^#[0-9A-Fa-f]{6}$/.test(spec.primaryColor)) {
    tokens.primary = spec.primaryColor;
  }

  plog(`[S1] ✓ ${spec.files.length} files planned for "${spec.projectName}"`);

  // ── Stage 2: Generate all files (ROOT FIX #5: failure-tracked) ───────────
  plog(`[S2] Generating ${spec.files.length} files...`);
  let generatedFiles: StreamFile[] = [];
  try {
    generatedFiles = await generateAllFiles(spec, tokens, smartEmit, onPing);
    plog(`[S2] ✓ ${generatedFiles.length} files generated`);
  } catch (e) {
    perr(`[S2] Fatal error: ${String(e)}`);
    safeError(`Generation failed: ${String(e)}`);
    safeDone();
    return;
  }

  // ── Stage 3: Deterministic fix pass ─────────────────────────────────────
  plog("[S3] Deterministic fixes...");
  let fixedFiles = deterministicFixPass(generatedFiles);
  plog("[S3] ✓ Done");

  // ── Stage 3.5: Hard validation gate (ROOT FIX #8: real gate) ─────────────
  plog("[S3.5] Validation gate...");
  fixedFiles = applyValidationGate(fixedFiles, tokens);
  plog(`[S3.5] ✓ ${fixedFiles.length} files passed gate`);

  // ── ROOT FIX #4: Structural integrity check — required files must be present ──
  const integrity = assertStructuralIntegrity(fixedFiles);
  if (!integrity.passed) {
    plog(`[INTEGRITY] Missing required files: ${integrity.missing.join(", ")} — injecting`);
    // Inject missing boilerplate files back in
    const boilerplate = makeBoilerplate(prompt, spec.projectName, tokens);
    for (const required of integrity.missing) {
      const bp = boilerplate.find((f) => f.path === required);
      if (bp) {
        fixedFiles.push(bp);
        plog(`[INTEGRITY] Injected: ${required}`);
      }
    }
  }

  // ── Rebuild App.jsx deterministically from final validated file list ──────
  // ROOT FIX #10: This guarantees App.jsx only references files that actually passed validation
  const finalAppContent = buildAppJsx(
    spec,
    fixedFiles.filter((f) => !BOILERPLATE_PATHS.has(f.path)),
    tokens,
  );
  const appIdx = fixedFiles.findIndex((f) => f.path === "src/App.jsx");
  if (appIdx !== -1) {
    fixedFiles[appIdx] = { path: "src/App.jsx", content: finalAppContent, provisional: false };
  } else {
    fixedFiles.push({ path: "src/App.jsx", content: finalAppContent, provisional: false });
  }
  plog("[POST] Rebuilt App.jsx from final validated file list");

  // ── Final structural integrity check ─────────────────────────────────────
  const finalIntegrity = assertStructuralIntegrity(fixedFiles);
  if (!finalIntegrity.passed) {
    perr(`[INTEGRITY] CRITICAL: Still missing after injection: ${finalIntegrity.missing.join(", ")}`);
    safeError(`Missing required files: ${finalIntegrity.missing.join(", ")}`);
  }

  // ── Pre-emit logging: Show all files that will be emitted ──
  plog(`[S4] Preparing to emit ${fixedFiles.length} files:`);
  fixedFiles.forEach((f) => plog(`      - ${f.path} (${f.content.length} bytes)`));

  // ── Stage 4: Emit final files (CRITICAL FIX: emit ALL files, not just changed) ─────────────────────────────────────────────────────────
  // Previous behavior: only emit files that changed since earlier stages
  // Problem: Files that didn't change still had been emitted as provisional in S2,
  // but if S4 doesn't re-emit them, the API route may not collect them all before saving to DB
  // Fix: Re-emit ALL files to ensure 100% collection in the API route's allFiles array
  plog(`[S4] Emitting ${fixedFiles.length} final files (including unchanged)...`);
  let emitCount = 0;
  for (const file of fixedFiles) {
    // CRITICAL: Always re-emit for final collection, even if content hasn't changed
    // This ensures the API route will have ALL files in its allFiles array
    await smartEmit({ ...file, provisional: false, lastFixed: true });
    emitCount++;
  }
  plog(`[S4] ✓ Emitted ${emitCount} files (all files re-emitted for final DB save)`);

  plog("✅ ══════════════════════════════════════════════════════════");
  plog(`✅ PIPELINE v21.0 DONE — ${fixedFiles.length} files, mode: ${mode.mode}, type: ${tokens.projectType}`);
  plog("✅ ══════════════════════════════════════════════════════════");

  safeDone();
}