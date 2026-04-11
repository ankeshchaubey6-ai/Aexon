// src/lib/ai/stream/stream-pipeline.ts
// PIPELINE v17.0 — HARD VALIDATION · FILE‑LEVEL FAULT ISOLATION · NEVER COLLAPSE PROJECT
//
// ┌─────────────────────────────────────────────────────────────────┐
// │  REGIONS (in order)                                             │
// │  1.  PUBLIC TYPES                                               │
// │  2.  INTERNAL TYPES                                             │
// │  3.  CONSTANTS & CONFIG                                         │
// │  4.  NVIDIA CLIENT                                              │
// │  5.  METRICS MODULE                                             │
// │  6.  MODEL HEALTH & SELECTION                                   │
// │  7.  RATE LIMITER                                               │
// │  8.  UTILITIES                                                  │
// │  9.  DESIGN TOKENS & BOILERPLATE                                │
// │  10. ── PLANNER ──────────────────────────────────────────────  │
// │  11. ── S1.5 SPEC VALIDATOR ──────────────────────────────────  │
// │  12. ── VALIDATOR ────────────────────────────────────────────  │
// │  13. ── IMPORT GRAPH ─────────────────────────────────────────  │
// │  14. ── RESOLVER ─────────────────────────────────────────────  │
// │  15. ── GENERATOR ────────────────────────────────────────────  │
// │  16. ── FIXER ────────────────────────────────────────────────  │
// │  17. ── EMITTER ──────────────────────────────────────────────  │
// │  18. MAIN EXPORT                                                │
// └─────────────────────────────────────────────────────────────────┘

import OpenAI from "openai";
import { checkSyntax }              from "@/lib/ai/validation/syntax-checker";
import { runSemanticValidation }    from "@/lib/ai/validation/semantic-validator";
import { buildComponentRegistry }   from "@/lib/ai/engine/component-registry";
import { fixWholeProjectWithRetry } from "@/lib/ai/engine/project-fixer";

// ═══════════════════════════════════════════════════════════════════════════════
// REGION 1 — PUBLIC TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export type StreamFile = {
  path:         string;
  content:      string;
  provisional?: boolean;
  size?:        number;
  lastFixed?:   boolean;
};

export interface PipelineCallbacks {
  onFile:    (file: StreamFile) => Promise<void>;
  onLog?:    (msg: string) => void;
  onDone:    () => void;
  onError?:  (message: string) => void;
  onMetric?: (name: string, value: number) => void;
  onPing?:   () => void;
}

// ═══════════════════════════════════════════════════════════════════════════════
// REGION 2 — INTERNAL TYPES
// ═══════════════════════════════════════════════════════════════════════════════

interface FileSpec {
  path:         string;
  description:  string;
  dependencies: string[];
  is3D?:        boolean;
  isAnimation?: boolean;
}

interface ProjectSpec {
  projectName:   string;
  description:   string;
  globalContext: string;
  designTokens:  DesignTokens;
  files:         FileSpec[];
}

interface DesignTokens {
  colors: {
    primary:    string[];
    secondary:  string[];
    accent:     string[];
    background: string[];
    text:       string[];
  };
  typography: {
    fontFamily:   string;
    headingSizes: Record<string, string>;
    bodySize:     string;
  };
  spacing:    Record<string, string>;
  animations: {
    duration: Record<string, string>;
    easing:   Record<string, string>;
  };
  breakpoints: Record<string, string>;
}

interface ValidationIssue {
  path:     string;
  type:     "jsx-imbalance" | "missing-export" | "empty-file" | "too-short"
          | "missing-import" | "undefined-component" | "invalid-hook"
          | "console-log" | "todo-comment" | "incomplete-function"
          | "no-jsx-return" | "circular-import" | "unresolvable-import"
          | "forbidden-import";
  message:  string;
  severity: "error" | "warning";
}

interface GenerationQualityReport {
  totalFiles:   number;
  invalidFiles: number;
  invalidRate:  number;
  issues:       ValidationIssue[];
  passed:       boolean;
}

interface AutoResolveResult {
  files:      StreamFile[];
  fixedCount: number;
  details:    string[];
}

interface NormalizationResult {
  files:             StreamFile[];
  reactImportsAdded: number;
  exportsAdded:      number;
  jsxIssues:         string[];
}

interface ImportGraph {
  edges:    Map<string, Set<string>>;
  missing:  Map<string, string[]>;
  circular: string[];
}

interface ValidationGateResult {
  canProceed:    boolean;
  blockedFiles:  string[];
  reason:        string;
}

type FailureReason =
  | "syntax" | "missing-import" | "jsx-imbalance"
  | "output-contract" | "too-short" | "unknown";

type ErrorCategory = "auto-fixable" | "regen-required";

interface RegenerableFile {
  file:   StreamFile;
  reason: FailureReason;
}

// ═══════════════════════════════════════════════════════════════════════════════
// REGION 2.5 — HARD VALIDATION TYPES
// ═══════════════════════════════════════════════════════════════════════════════

interface HardValidationResult {
  passed:   boolean;
  reasons:  string[];
}

const _regenAttempts = new Map<string, number>();
const MAX_REGEN_ATTEMPTS = 2;

const MAX_PIPELINE_RETRIES = 2;

// ═══════════════════════════════════════════════════════════════════════════════
// REGION 3 — CONSTANTS & CONFIG
// ═══════════════════════════════════════════════════════════════════════════════

const RATE_WINDOW_MS          = 62_000;
const MAX_RPM                 = 5;
const PLAN_TIMEOUT_MS         = 180_000;
const FILE_TIMEOUT_MS         = 120_000;
const MAX_FILE_RETRIES        = 3;
const MAX_COMPONENTS          = 12;
const MAX_FILE_CHARS          = 10_000;
const PING_INTERVAL_MS        = 6_000;
const PARALLEL_BATCH_SIZE     = 3;
const QUALITY_GATE_THRESHOLD  = 0.30;
const MIN_FILE_CHARS          = 20;
const JSX_IMBALANCE_TOLERANCE = 2;
const CONSECUTIVE_FAIL_LIMIT  = 3;
const TEMP_BASE               = 0.3;
const TEMP_JITTER_MAX         = 0.1;

const INVALID_RATE_RETRY_THRESHOLD = 1.0;

const FILE_PRIORITY_ORDER: string[] = [
  "src/data/", "src/hooks/", "src/utils/",
  "src/components/", "src/sections/", "src/layouts/",
  "src/pages/", "src/features/", "src/views/",
  "src/App.jsx",
];

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

const BOILERPLATE_PATHS = new Set([
  "package.json", "index.html", "src/main.jsx", "vite.config.js",
]);

// v17.0: FORBIDDEN_IMPORT_PATTERN — primary hard-block before emit
// Strengthened: blocks framer-motion, lucide-react, any .css, react-router, etc.
const FORBIDDEN_IMPORT_PATTERN = /(?:framer-motion|lucide-react|\.css|react-router(?:-dom)?|clsx|axios|zustand|recharts|three|@react-three\/(?:fiber|drei)|gsap|react-intersection-observer|@tanstack\/react-query|preact|styled-components|@emotion\/(?:react|styled)|next\/(?:image|link|router|navigation))/;

const BANNED_IMPORT_SOURCES = [
  "react-router-dom", "react-router", "axios", "three",
  "@react-three/fiber", "@react-three/drei", "gsap",
  "react-intersection-observer", "@tanstack/react-query",
  "zustand", "recharts", "preact", "styled-components",
  "@emotion/react", "@emotion/styled",
  "next/image", "next/link", "next/router", "next/navigation",
];

const VALID_EXTENSIONS = new Set([".jsx", ".js", ".ts", ".tsx", ".json", ".svg"]);

// v17.0: AVAILABLE_PACKAGES restricted to only react@18 and react-dom@18
const AVAILABLE_PACKAGES = `react@18, react-dom@18`;

const AUTO_FIX_ONLY_TYPES = new Set<ValidationIssue["type"]>([
  "missing-import",
  "undefined-component",
  "invalid-hook",
  "jsx-imbalance",
]);

const REGEN_REQUIRED_TYPES = new Set<ValidationIssue["type"]>([
  "too-short",
  "empty-file",
  "missing-export",
  "no-jsx-return",
  "circular-import",
  "forbidden-import",
]);

// v17.0: Critical files that must always be valid — force regen or safe-replace
const CRITICAL_FILES = new Set(["src/App.jsx", "src/main.jsx"]);

// ═══════════════════════════════════════════════════════════════════════════════
// REGION 4 — NVIDIA CLIENT
// ═══════════════════════════════════════════════════════════════════════════════

const nvidia = new OpenAI({
  apiKey:  process.env.NVIDIA_API_KEY!,
  baseURL: "https://integrate.api.nvidia.com/v1",
});

// ═══════════════════════════════════════════════════════════════════════════════
// REGION 5 — METRICS MODULE
// ═══════════════════════════════════════════════════════════════════════════════

class PipelineMetrics {
  private data: Record<string, number> = {
    generationTime: 0, fixTime: 0, planTime: 0, totalTime: 0,
    errorCount: 0, retryCount: 0, totalFiles: 0, invalidFiles: 0,
    regenCount: 0, fallbackUsageCount: 0, qualityGateFailures: 0,
    successRate: 0, avgGenerationTimePerFile: 0, autoFixResolvedCount: 0,
    autoFixImports: 0, autoFixJsx: 0, autoFixHooks: 0, regenSkipped: 0,
    pipelineRetries: 0, corruptionBlocked: 0, validationBlocked: 0,
    filesReplacedWithSafe: 0, forbiddenImportsBlocked: 0, hardValidationBlocked: 0,
    criticalFilesForceRegenerated: 0,
  };
  private modelUsage:   Record<string, number> = {};
  private startTimes:   Record<string, number> = {};
  private genFileTimes: number[] = [];
  private successCount  = 0;
  private attemptCount  = 0;

  startTimer(key: string): void { this.startTimes[key] = performance.now(); }

  stopTimer(key: string): number {
    const s = (performance.now() - (this.startTimes[key] ?? performance.now())) / 1000;
    this.data[key] = (this.data[key] ?? 0) + s;
    return s;
  }

  recordFileGenTime(ms: number): void { this.genFileTimes.push(ms); }

  increment(key: string, by = 1): void { this.data[key] = (this.data[key] ?? 0) + by; }

  recordModel(model: string): void {
    const label = mlabel(model);
    this.modelUsage[label] = (this.modelUsage[label] ?? 0) + 1;
  }

  recordAttempt(success: boolean): void {
    this.attemptCount++;
    if (success) this.successCount++;
  }

  flush(onMetric?: (name: string, value: number) => void): void {
    if (this.genFileTimes.length > 0) {
      this.data.avgGenerationTimePerFile =
        this.genFileTimes.reduce((a, b) => a + b, 0) / this.genFileTimes.length / 1000;
    }
    if (this.attemptCount > 0) this.data.successRate = this.successCount / this.attemptCount;
    for (const [k, v] of Object.entries(this.data))       onMetric?.(k, v);
    for (const [k, v] of Object.entries(this.modelUsage)) onMetric?.(`model_${k}`, v);
  }

  get(key: string): number { return this.data[key] ?? 0; }
}

// ═══════════════════════════════════════════════════════════════════════════════
// REGION 6 — MODEL HEALTH & SELECTION
// ═══════════════════════════════════════════════════════════════════════════════

type FileType = "jsx" | "js" | "other";

class ModelHealthTracker {
  private failures     = new Map<string, number>();
  private typeLatency  = new Map<FileType, Map<string, number[]>>();
  private readonly SKIP_THRESHOLD = 3;

  recordFailure(model: string): void {
    const f = (this.failures.get(model) ?? 0) + 1;
    this.failures.set(model, f);
    if (f >= this.SKIP_THRESHOLD) {
      pipelineLog(`[PIPELINE][HEALTH] ${mlabel(model)} health-skipped after ${f} failures`);
    }
  }

  recordSuccess(model: string, latencyMs: number, ftype: FileType): void {
    this.failures.delete(model);
    if (!this.typeLatency.has(ftype)) this.typeLatency.set(ftype, new Map());
    const tmap    = this.typeLatency.get(ftype)!;
    const samples = tmap.get(model) ?? [];
    samples.push(latencyMs);
    if (samples.length > 20) samples.shift();
    tmap.set(model, samples);
  }

  isHealthy(model: string): boolean {
    return (this.failures.get(model) ?? 0) < this.SKIP_THRESHOLD;
  }

  rankModels<T extends string>(models: readonly T[], ftype: FileType): T[] {
    const healthy = models.filter((m) => this.isHealthy(m));
    const tmap    = this.typeLatency.get(ftype);
    if (!tmap) return healthy;
    return [...healthy].sort((a, b) => {
      const avgOf = (m: string) => {
        const s = tmap.get(m);
        return s && s.length > 0 ? s.reduce((x, y) => x + y, 0) / s.length : Infinity;
      };
      return avgOf(a) - avgOf(b);
    });
  }
}

const modelHealth = new ModelHealthTracker();

function fileTypeOf(path: string): FileType {
  if (path.endsWith(".jsx") || path.endsWith(".tsx")) return "jsx";
  if (path.endsWith(".js")  || path.endsWith(".ts"))   return "js";
  return "other";
}

// ═══════════════════════════════════════════════════════════════════════════════
// REGION 7 — RATE LIMITER
// ═══════════════════════════════════════════════════════════════════════════════

class AdvancedRateLimiter {
  private callTimestamps:  number[] = [];
  private failures         = new Map<string, number>();
  private circuitOpenUntil = new Map<string, number>();
  private readonly FAILURE_THRESHOLD = 3;
  private readonly CIRCUIT_RESET_MS  = 60_000;

  async waitForSlot(model: string, label: string, onPing?: () => void): Promise<void> {
    const openUntil = this.circuitOpenUntil.get(model);
    if (openUntil && Date.now() < openUntil) {
      const wait = openUntil - Date.now();
      pipelineLog(`[PIPELINE][RL] Circuit open for ${mlabel(model)}, waiting ${(wait / 1000).toFixed(1)}s`);
      await sleepWithPing(wait, onPing);
      this.circuitOpenUntil.delete(model);
    }
    const now = Date.now();
    this.callTimestamps = this.callTimestamps.filter((t) => now - t < RATE_WINDOW_MS);
    if (this.callTimestamps.length < MAX_RPM) { this.callTimestamps.push(now); return; }
    const waitMs = RATE_WINDOW_MS - (now - this.callTimestamps[0]) + 500;
    pipelineLog(`[PIPELINE][RL] Rate limit — waiting ${(waitMs / 1000).toFixed(1)}s before ${label}`);
    await sleepWithPing(waitMs, onPing);
    await this.waitForSlot(model, label, onPing);
  }

  recordSuccess(model: string): void {
    this.failures.delete(model);
    this.circuitOpenUntil.delete(model);
  }

  recordFailure(model: string): void {
    const fails = (this.failures.get(model) ?? 0) + 1;
    this.failures.set(model, fails);
    if (fails >= this.FAILURE_THRESHOLD) {
      this.circuitOpenUntil.set(model, Date.now() + this.CIRCUIT_RESET_MS);
      pipelineLog(`[PIPELINE][CB] Circuit opened for ${mlabel(model)}`);
    }
  }
}

const rateLimiter = new AdvancedRateLimiter();

// ═══════════════════════════════════════════════════════════════════════════════
// REGION 8 — UTILITIES
// ═══════════════════════════════════════════════════════════════════════════════

let _logFn: (msg: string) => void = (msg) => console.log(msg);

function pipelineLog(msg: string):  void { _logFn(msg); }
function pipelineErr(msg: string):  void { _logFn(`❌ ${msg}`); console.error(msg); }

function logStage(stage: string, model: string, message: string): void {
  pipelineLog(`[PIPELINE][${stage}][${mlabel(model)}] ${message}`);
}

function mlabel(model: string): string { return model.split("/")[1] ?? model; }

function sleep(ms: number): Promise<void> { return new Promise((r) => setTimeout(r, ms)); }

async function sleepWithPing(ms: number, onPing?: () => void): Promise<void> {
  if (!onPing || ms <= PING_INTERVAL_MS) return sleep(ms);
  const end = Date.now() + ms;
  while (Date.now() < end) {
    const remaining = end - Date.now();
    await sleep(Math.min(PING_INTERVAL_MS, remaining));
    if (Date.now() < end) onPing();
  }
}

function backoffMs(attempt: number): number { return Math.min(1000 * Math.pow(2, attempt), 16_000); }

function djb2(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h) ^ s.charCodeAt(i);
  return Math.abs(h);
}

function deterministicTemp(prompt: string, filePath: string, attemptOffset = 0): number {
  const jitter = (djb2(`${prompt}::${filePath}`) % 1000) / 1000 * TEMP_JITTER_MAX;
  return Math.round((TEMP_BASE + jitter + attemptOffset * 0.05) * 1000) / 1000;
}

function stripMarkdown(text: string): string {
  return text
    .replace(/^```(?:json|jsx?|javascript|css|html|ts|tsx)?\s*/gim, "")
    .replace(/^```\s*$/gim, "")
    .replace(/^["']use (?:client|server)["'];\s*\n*/m, "")
    .trim();
}

function fixRedactedTokens(code: string): string {
  let f = code;
  f = f.replace(/(\)|\])\s*=\s*\/\s*>/g, "$1 =>");
  f = f.replace(/(?<!=)=\s*\/\s*>/g, "=>");
  f = f.replace(/\b(useState|useReducer)\s*\(\s*<REDACTED_EMAIL>\s*\)/g, "$1('')");
  f = f.replace(/\b(useState|useReducer)\s*\(\s*<REDACTED_EMAIL>\s*,/g, "$1(null,");
  f = f.replace(/=\s*\{\s*<REDACTED_EMAIL>\s*\}/g, "={''}");
  f = f.replace(/\b(\w+)\s*\(\s*<REDACTED_EMAIL>\s*\)/g, "$1('')");
  f = f.replace(/=\s*<REDACTED_EMAIL>\b/g, "= ''");
  f = f.replace(/\[REDACTED(?:_EMAIL)?\]/g, "''");
  f = f.replace(/"<REDACTED_EMAIL>"/g, "''");
  f = f.replace(/'<REDACTED_EMAIL>'/g, "''");
  return f;
}

function cleanOutput(content: string): string {
  return content
    .replace(/\n{4,}/g, "\n\n\n")
    .replace(/[ \t]+$/gm, "")
    .trimEnd() + "\n";
}

function deduplicateImportLines(content: string): string {
  const seen = new Set<string>();
  return content.split("\n").filter((line) => {
    const t = line.trim();
    if (!t.startsWith("import ")) return true;
    if (seen.has(t)) return false;
    seen.add(t);
    return true;
  }).join("\n");
}

function removeUnusedImports(content: string): string {
  const body     = content.replace(/^import[^\n]+$/gm, "");
  const importRe = /^import\s+\{([^}]+)\}\s+from\s+(['"][^'"]+['"]);?\s*$/gm;
  return content
    .replace(importRe, (fullLine, specifiers, _source) => {
      const names = specifiers.split(",").map((s: string) => s.trim().split(" as ").pop()!.trim()).filter(Boolean);
      const used  = names.filter((n: string) => new RegExp(`\\b${n}\\b`).test(body));
      if (used.length === names.length) return fullLine;
      if (used.length === 0) return "";
      return fullLine.replace(specifiers, ` ${used.join(", ")} `);
    })
    .replace(/^import\s*\{\s*\}\s+from\s+['"][^'"]+['"];?\s*\n?/gm, "");
}

function stripConsoleLogs(content: string): string {
  return content.replace(/^\s*console\.(log|warn|error|debug|info)\s*\([^)]*\)\s*;?\s*$/gm, "");
}

// Strip banned imports — CSS imports are also removed here
function stripBannedImports(content: string): string {
  const lines       = content.split("\n");
  const strippedPkgs: string[] = [];
  const filtered    = lines.filter((line) => {
    const t = line.trim();
    if (!t.startsWith("import ")) return true;
    const m = t.match(/from\s+['"]([^'"]+)['"]/);
    // Strip any CSS import
    if (t.match(/['"][^'"]*\.css['"]/)) { strippedPkgs.push("*.css"); return false; }
    if (!m) return true;
    const pkg    = m[1];
    const banned = BANNED_IMPORT_SOURCES.some((b) => pkg === b || pkg.startsWith(b + "/"));
    const isNext = pkg === "next" || pkg.startsWith("next/");
    if (banned || isNext) { strippedPkgs.push(pkg); return false; }
    return true;
  });
  let result = filtered.join("\n");
  if (strippedPkgs.length > 0) {
    pipelineLog(`[PIPELINE][RESOLVER] Stripped banned (fallback): ${strippedPkgs.join(", ")}`);
  }
  if (/<Link[\s>]/.test(result) || /<\/Link>/.test(result)) {
    result = result
      .replace(/<Link\s+to=(['"])/g,   "<a href=$1")
      .replace(/<Link\s+href=(['"])/g, "<a href=$1")
      .replace(/<Link(\s[^>]*)?>/g,    "<a$1>")
      .replace(/<\/Link>/g,            "</a>");
  }
  return result;
}

function cleanLLMOutput(code: string, filePath: string): string {
  let out = code;
  const PROSE = [
    /^I\s+(have|added|removed|updated|fixed|also)/i, /^Note\s+that\b/i, /^Here('s| is)\b/i,
    /^This\s+(component|file|code|implementation)\b/i, /^The\s+(above|following|component|file)\b/i,
    /^In\s+(this|the)\s+(component|file)\b/i, /^Finally[,\s]/i, /^Additionally[,\s]/i,
    /^Also[,\s]/i, /^Please\s+note\b/i, /^You\s+(can|should|need|may)\b/i,
    /^To\s+(use|run|install|fix)\b/i, /^Let\s+me\s+(know|explain)\b/i,
    /^Hope\s+(this|that)\b/i, /^Feel\s+free\b/i,
  ];
  const exportRe = /^export\s+default\b[^\n]*/gm;
  let lastExport: RegExpExecArray | null = null;
  let m: RegExpExecArray | null;
  while ((m = exportRe.exec(out)) !== null) lastExport = m;
  if (lastExport) {
    const endPos = lastExport.index + lastExport[0].length;
    const after  = out.slice(endPos).replace(/^[\s;]+/, "");
    if (PROSE.some((p) => p.test(after))) out = out.slice(0, endPos).trimEnd() + "\n";
  }
  const isJSX = filePath.endsWith(".jsx") || (filePath.endsWith(".js") && !filePath.endsWith(".test.js"));
  if (isJSX) {
    out = out.replace(/\)\s*:\s*React\.FC(?:<[^>]{0,80}>)?\s*(?==\s*[({])/g, ")");
    out = out.replace(/\)\s*:\s*React\.(?:ReactNode|ReactElement|JSX\.Element)(?=\s*[{(])/g, ")");
    out = out.replace(/\b(useState|useRef|useCallback|useMemo|useReducer)<[^>]{0,60}>\s*\(/g, "$1(");
    out = out.replace(/(\w)\s*:\s*(string|number|boolean|any|void|never|unknown)(\s*[,)=])/g, "$1$3");
    out = out.replace(/^interface\s+\w+\s*\{[^}]*\}\s*$/gm, "");
    out = out.replace(/^type\s+\w+\s*=\s*[^;]+;\s*$/gm, "");
  }
  out = out.replace(/(\)|\])\s*=\s*\/\s*>/g, "$1 =>");
  out = out.replace(/(?<![=!<>])=\s*\/\s*>/g, "=>");
  out = out.replace(/^\s*n\s*$/gm, "");
  out = out.replace(/\n{4,}/g, "\n\n\n");
  out = fixRedactedTokens(out);
  return out;
}

function addJsxExtensions(content: string): string {
  return content.replace(
    /from\s+(['"])(\.\.?\/[^'"]+)(['"])/g,
    (match, q1, importPath: string, q2) => {
      if (!importPath.startsWith(".")) return match;
      if (/\.(js|jsx|ts|tsx|css)$/.test(importPath)) return match;
      const clean = importPath.replace(/\.(js|jsx|ts|tsx)$/, "");
      return `from ${q1}${clean}${q2}`;
    }
  );
}

function ensureDefaultExport(content: string, name: string): string {
  if (/\bexport\s+default\b/.test(content)) return content;
  const safe = name.replace(/[^a-zA-Z0-9_$]/g, "") || "Component";
  return `${content}\n\nexport default ${safe};\n`;
}

function injectReactImport(content: string): string {
  if (/\bimport\s+React\b/.test(content)) return content;
  if (/<[A-Za-z]/.test(content)) return `import React from 'react';\n${content}`;
  return content;
}

function findImportInsertionPoint(content: string): number {
  const reactLine = content.indexOf("import React");
  if (reactLine !== -1) {
    const lineEnd = content.indexOf("\n", reactLine);
    return lineEnd > -1 ? lineEnd + 1 : 0;
  }
  const lines = content.split("\n");
  let i = 0;
  while (i < lines.length && (lines[i].trim().startsWith("import ") || lines[i].trim() === "")) i++;
  return lines.slice(0, i).join("\n").length + (i > 0 ? 1 : 0);
}

function hardenOutput(files: StreamFile[]): StreamFile[] {
  return files.map((file) => {
    if (!file.path.endsWith(".jsx") && !file.path.endsWith(".js")) return file;
    let c = file.content;
    c = deduplicateImportLines(c);
    c = removeUnusedImports(c);
    c = stripConsoleLogs(c);
    c = cleanOutput(c);
    return { ...file, content: c };
  });
}

// v17.0: Helper to detect any CSS in content
function containsCSS(content: string): boolean {
  return /\.css['"]/.test(content) ||
         /<style[\s>]/.test(content) ||
         /import\s+['"][^'"]*\.css['"]/.test(content);
}

// ═══════════════════════════════════════════════════════════════════════════════
// REGION 8.5 — HARD VALIDATION LAYER (v17.0 — PRIMARY DEFENSE)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Returns true if the file is a CSS file — CSS files must never reach runtime.
 */
function isCssFile(path: string): boolean {
  return path.endsWith(".css") || path.endsWith(".scss") || path.endsWith(".sass") || path.endsWith(".less");
}

/**
 * Returns true if the file content contains any CSS import.
 */
function hasCssImport(code: string): boolean {
  return /import\s+['"][^'"]*\.css['"]/m.test(code);
}

/**
 * v17.0: PRIMARY hard-block check.
 * Returns true if the file contains any forbidden import that must never reach runtime.
 */
function hasForbiddenImports(code: string): boolean {
  const lines = code.split("\n");
  for (const line of lines) {
    const t = line.trim();
    if (!t.startsWith("import ")) continue;
    // Block CSS imports
    if (/['"][^'"]*\.css['"]/.test(t)) return true;
    const m = t.match(/from\s+['"]([^'"]+)['"]/);
    if (!m) continue;
    if (FORBIDDEN_IMPORT_PATTERN.test(m[1])) return true;
  }
  return false;
}

/**
 * v17.0: Structural validation gate applied BEFORE emit.
 */
function runHardValidation(file: StreamFile): HardValidationResult {
  const reasons: string[] = [];

  // CSS files are always rejected
  if (isCssFile(file.path)) {
    reasons.push(`CSS file rejected: ${file.path}`);
    return { passed: false, reasons };
  }

  if (!file.path.endsWith(".jsx") && !file.path.endsWith(".js")) {
    return { passed: true, reasons: [] };
  }

  const c = file.content ?? "";

  if (c.trim().length < MIN_FILE_CHARS) {
    reasons.push(`file too short (${c.trim().length} chars, min ${MIN_FILE_CHARS})`);
  }

  if (file.path.endsWith(".jsx")) {
    if (!/\bexport\s+default\b/.test(c)) {
      reasons.push("missing export default");
    }

    if (!/return\s*\(?\s*</.test(c)) {
      reasons.push("no JSX return statement");
    }

    const openT  = (c.match(/<[A-Z][a-zA-Z0-9]*[\s>]/g) ?? []).length;
    const closeT = (c.match(/<\/[A-Z][a-zA-Z0-9]*>/g) ?? []).length;
    const selfC  = (c.match(/<[A-Z][a-zA-Z0-9]*[^>]*\/>/g) ?? []).length;
    const bal    = openT - closeT - selfC;
    if (Math.abs(bal) > JSX_IMBALANCE_TOLERANCE) {
      reasons.push(`JSX tag imbalance (delta=${bal})`);
    }

    if ((c.match(/\bexport\s+default\b/g) ?? []).length > 1) {
      reasons.push("multiple export default declarations");
    }

    if (!/\bexport\s+default\b/.test(c) && /\bexport\s+(?:const|function|class)\b/.test(c)) {
      reasons.push("named exports only — missing export default");
    }
  }

  return { passed: reasons.length === 0, reasons };
}

/**
 * v17.0: Apply hard validation to every file in the collection.
 * CSS files and files with forbidden imports are replaced with safe fallbacks.
 */
function applyHardValidationGate(
  files:   StreamFile[],
  metrics: PipelineMetrics,
  context: string,
): StreamFile[] {
  return files.map((file) => {
    // Hard block: CSS files must never reach runtime
    if (isCssFile(file.path)) {
      pipelineLog(`[PIPELINE][HARD-BLOCK][${context}] CSS file blocked — replacing: ${file.path}`);
      metrics.increment("hardValidationBlocked");
      metrics.increment("filesReplacedWithSafe");
      return replaceWithSafeComponent(file);
    }

    if (BOILERPLATE_PATHS.has(file.path)) return file;

    // Gate 1: Forbidden imports (PRIMARY hard block — includes CSS imports)
    if (hasForbiddenImports(file.content)) {
      console.warn(`[PIPELINE][HARD-BLOCK] Blocked forbidden import in: ${file.path}`);
      pipelineLog(`[PIPELINE][HARD-BLOCK][${context}] Forbidden import blocked — replacing: ${file.path}`);
      metrics.increment("forbiddenImportsBlocked");
      metrics.increment("filesReplacedWithSafe");
      return replaceWithSafeComponent(file);
    }

    // Gate 2: Structural validation
    const validation = runHardValidation(file);
    if (!validation.passed) {
      pipelineLog(`[PIPELINE][HARD-VALIDATE][${context}] ${file.path} failed structural check: ${validation.reasons.join("; ")} — replacing with safe fallback`);
      metrics.increment("hardValidationBlocked");
      metrics.increment("filesReplacedWithSafe");
      return replaceWithSafeComponent(file);
    }

    return file;
  });
}

/**
 * v17.0: Safe emit wrapper that applies hard validation before calling onFile.
 * CSS files are hard-blocked at this final barrier.
 */
async function safeEmitWithValidation(
  file:    StreamFile,
  onFile:  (f: StreamFile) => Promise<void>,
  metrics: PipelineMetrics,
): Promise<void> {
  // Hard block: CSS files must never be emitted
  if (isCssFile(file.path)) {
    pipelineLog(`[PIPELINE][EMIT-BLOCK] CSS file blocked at emit gate: ${file.path}`);
    metrics.increment("hardValidationBlocked");
    return;
  }

  if (BOILERPLATE_PATHS.has(file.path)) {
    try { await onFile(file); } catch {}
    return;
  }

  // v17.0: FINAL FIX PASS before any emit
  try {
    const fixResult = await fixWholeProjectWithRetry([file]);
    if (!fixResult.ok) {
      pipelineLog(`[PIPELINE][EMIT-BLOCK] Fixer failed for ${file.path} — safe replacing`);
      metrics.increment("filesReplacedWithSafe");
      const safe = replaceWithSafeComponent(file);
      try { await onFile(safe); } catch {}
      return;
    }
    // Use fixed file if available
    const fixedFile = fixResult.files.find(f => f.path === file.path);
    if (fixedFile) {
      file = { ...file, content: fixedFile.content };
    }
  } catch (fixError) {
    pipelineErr(`[PIPELINE][EMIT-BLOCK] Fixer error for ${file.path}: ${String(fixError)} — safe replacing`);
    metrics.increment("filesReplacedWithSafe");
    const safe = replaceWithSafeComponent(file);
    try { await onFile(safe); } catch {}
    return;
  }

  // Primary block: forbidden imports (includes CSS imports in JS files)
  if (hasForbiddenImports(file.content)) {
    console.warn(`[PIPELINE][EMIT-BLOCK] Blocked forbidden import at emit: ${file.path}`);
    pipelineLog(`[PIPELINE][EMIT-BLOCK] Replaced at emit gate: ${file.path}`);
    metrics.increment("forbiddenImportsBlocked");
    metrics.increment("filesReplacedWithSafe");
    const safe = replaceWithSafeComponent(file);
    try { await onFile(safe); } catch {}
    return;
  }

  // Secondary block: structural validation
  const validation = runHardValidation(file);
  if (!validation.passed && file.path.endsWith(".jsx")) {
    pipelineLog(`[PIPELINE][EMIT-BLOCK] Structural failure at emit gate for ${file.path}: ${validation.reasons.join("; ")}`);
    metrics.increment("hardValidationBlocked");
    metrics.increment("filesReplacedWithSafe");
    const safe = replaceWithSafeComponent(file);
    try { await onFile(safe); } catch {}
    return;
  }

  try { await onFile(file); } catch {}
}

function replaceWithSafeComponent(file: StreamFile): StreamFile {
  const name = file.path.split("/").pop()?.replace(/\.[^.]+$/, "") ?? "Component";
  const safeName = name.replace(/[^a-zA-Z0-9_$]/g, "") || "Component";
  const content = cleanOutput(`import React from 'react';
export default function ${safeName}() {
  return <div>${safeName}</div>;
}`);
  // Always use .jsx extension for safe components
  const safePath = file.path.endsWith(".jsx") || file.path.endsWith(".js")
    ? file.path
    : file.path.replace(/\.[^.]+$/, ".jsx");
  return { ...file, path: safePath, content };
}

function hasCriticalCorruption(files: StreamFile[]): boolean {
  for (const file of files) {
    if (BOILERPLATE_PATHS.has(file.path)) continue;
    if (isCssFile(file.path)) continue;

    const c = file.content ?? "";

    if (c.trim().length === 0) {
      pipelineLog(`[PIPELINE][CORRUPTION] Empty file: ${file.path}`);
      return true;
    }

    if (/\);\s*=>/.test(c) || /\];\s*=>/.test(c)) {
      pipelineLog(`[PIPELINE][CORRUPTION] Corrupted arrow token in: ${file.path}`);
      return true;
    }

    if (/er-motion['"]/.test(c) && !/framer-motion['"]/.test(c)) {
      pipelineLog(`[PIPELINE][CORRUPTION] Corrupted framer-motion import in: ${file.path}`);
      return true;
    }

    const exportDefaultMatches = c.match(/\bexport\s+default\b/g) ?? [];
    if (exportDefaultMatches.length > 1) {
      pipelineLog(`[PIPELINE][CORRUPTION] Multiple export default in: ${file.path} (${exportDefaultMatches.length})`);
      return true;
    }

    const importLines = c.split("\n").filter((l) => l.trim().startsWith("import "));
    for (const line of importLines) {
      if (/\bfrom\s+['"][^'"]*$/.test(line.trimEnd())) {
        pipelineLog(`[PIPELINE][CORRUPTION] Unterminated import string in: ${file.path} — "${line.trim().slice(0, 60)}"`);
        return true;
      }
    }
  }
  return false;
}

function isFileRejected(file: StreamFile): boolean {
  if (BOILERPLATE_PATHS.has(file.path)) return false;
  // CSS files are always rejected
  if (isCssFile(file.path)) return true;
  const c = file.content ?? "";

  if (c.trim().length < MIN_FILE_CHARS) return true;

  if (file.path.endsWith(".jsx")) {
    if (!/\bexport\s+default\b/.test(c)) return true;
    if (!/return\s*\(?\s*</.test(c)) return true;
    if ((c.match(/\bexport\s+default\b/g) ?? []).length > 1) return true;
  }

  return false;
}

// ═══════════════════════════════════════════════════════════════════════════════
// REGION 9 — DESIGN TOKENS & BOILERPLATE
// ═══════════════════════════════════════════════════════════════════════════════

function generateDesignTokens(_spec: Partial<ProjectSpec>): DesignTokens {
  return {
    colors: {
      primary:    ["#6366f1", "#4f46e5", "#4338ca"],
      secondary:  ["#a855f7", "#9333ea", "#7e22ce"],
      accent:     ["#06b4d4", "#0891b2", "#0e7490"],
      background: ["#050508", "#0d0d18", "#1a1a2e"],
      text:       ["#f8fafc", "#94a3b8", "#475569"],
    },
    typography: {
      fontFamily:   "Inter, system-ui, -apple-system, sans-serif",
      headingSizes: {
        h1: "clamp(3rem, 8vw, 6rem)", h2: "clamp(2rem, 5vw, 3.5rem)",
        h3: "clamp(1.5rem, 4vw, 2rem)", h4: "clamp(1.25rem, 3vw, 1.5rem)",
      },
      bodySize: "1rem",
    },
    spacing: {
      xs: "0.5rem", sm: "1rem", md: "1.5rem",
      lg: "2rem", xl: "3rem", "2xl": "4rem", "3xl": "6rem",
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
    breakpoints: { sm: "640px", md: "768px", lg: "1024px", xl: "1280px", "2xl": "1536px" },
  };
}

function makePkgJson(_name: string): string {
  return JSON.stringify({
    name: "ai-project", private: true, version: "0.0.0", type: "module",
    scripts: { dev: "vite --host", build: "vite build", preview: "vite preview" },
    dependencies: {
      react: "^18.2.0", "react-dom": "^18.2.0",
    },
    devDependencies: { vite: "^5.2.6", "@vitejs/plugin-react": "^4.2.1" },
  }, null, 2);
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

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode><App /></React.StrictMode>
);`;

const VITE_CONFIG = `import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({
  plugins: [react()],
  server: { host: true, open: false, port: 5173, strictPort: false },
  optimizeDeps: { include: ['react', 'react-dom', 'react-dom/client'] },
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

function makeFallbackComponent(spec: FileSpec): string {
  if (spec.path.endsWith(".js") && !spec.path.endsWith(".jsx")) {
    return `// ${spec.path}\nexport const data = [];\nexport default {};\n`;
  }
  const name = spec.path.split("/").pop()?.replace(/\.[^.]+$/, "") ?? "Component";
  return cleanOutput(`import React from 'react';
function ${name}() {
  return (
    <section style={{ padding: '5rem 1.5rem', textAlign: 'center', background: '#0d0d18' }}>
      <h2 style={{ fontSize: '2rem', fontWeight: 700, color: '#f8fafc' }}>${name}</h2>
      <p style={{ color: '#94a3b8', marginTop: '1rem' }}>${spec.description}</p>
    </section>
  );
}
export default ${name};`);
}

function makeBoilerplate(prompt: string): StreamFile[] {
  return [
    { path: "package.json",   content: makePkgJson("ai-project"),  provisional: true },
    { path: "index.html",     content: makeIndexHtml("AI Project"), provisional: true },
    { path: "src/main.jsx",   content: MAIN_JSX,                   provisional: true },
    { path: "vite.config.js", content: VITE_CONFIG,                provisional: true },
    { path: "src/App.jsx",    content: makeSpinnerApp(prompt),     provisional: true },
  ];
}

function buildAppJsx(spec: ProjectSpec, generatedFiles: StreamFile[]): string {
  const ORDER = ["layouts", "sections", "components", "pages", "features", "views"];
  const renderableFiles = generatedFiles.filter((f) =>
    f.path.endsWith(".jsx") &&
    f.path !== "src/App.jsx" && f.path !== "src/main.jsx" &&
    !(/\/(data|utils|hooks|lib|types)\//.test(f.path)) &&
    f.content.includes("export default")
  );
  const sorted = [...renderableFiles].sort((a, b) => {
    const r = (p: string) => { const i = ORDER.findIndex((s) => p.includes(`/${s}/`)); return i === -1 ? ORDER.length : i; };
    return r(a.path) - r(b.path);
  });
  const components = sorted.map((f) => {
    const name    = f.path.split("/").pop()!.replace(/\.[^.]+$/, "");
    const relPath = f.path.replace(/^src\//, "./").replace(/\.jsx$/, "");
    return { name, from: `${relPath}.jsx` };
  });
  const imports  = [
    `import React from 'react';`,
    ...components.map((c) => `import ${c.name} from '${c.from}';`)
  ].join("\n");
  const renders  = components.length > 0
    ? components.map((c) => `      <${c.name} />`).join("\n")
    : `      <div style={{ padding: '5rem', textAlign: 'center', color: '#f8fafc' }}>
        <h1 style={{ fontSize: '3rem', fontWeight: 700 }}>${spec.projectName}</h1>
        <p style={{ color: '#94a3b8', marginTop: '1rem' }}>${spec.description}</p>
      </div>`;
  return cleanOutput(`${imports}\n\nfunction App() {\n  return (\n    <div style={{ minHeight: '100vh', background: '#050508', fontFamily: 'Inter, system-ui, sans-serif' }}>\n${renders}\n    </div>\n  );\n}\n\nexport default App;`);
}

// ═══════════════════════════════════════════════════════════════════════════════
// REGION 10 — PLANNER
// ═══════════════════════════════════════════════════════════════════════════════

const PLANNER_SYSTEM = `You are a world-class React architect. Return ONLY raw JSON — no markdown, no backticks, no explanation.

Schema:
{
  "projectName": "PascalCase",
  "description": "one sentence",
  "globalContext": "5-6 sentences about design philosophy",
  "files": [
    { "path": "src/components/Hero.jsx", "description": "...", "dependencies": [], "isAnimation": true }
  ]
}

RULES:
- NEVER include: package.json, index.html, src/main.jsx, vite.config.js
- NEVER include ANY .css file
- ALWAYS include: src/App.jsx
- Styling must be inline using style={{}} only — NO external CSS files, NO className with Tailwind
- Plan 8-12 component files minimum across src/components/, src/sections/, src/layouts/
- ALL paths MUST start with "src/"
- FILENAME RULE: identifiers MUST NOT start with a digit
- Available packages ONLY: react@18, react-dom@18
- BANNED packages: react-router-dom, axios, three, @react-three/fiber, gsap, zustand, recharts, next, framer-motion, lucide-react, clsx
- NO TypeScript, NO "use client"
- Arrow functions use => NOT = />
- NEVER plan files named: Icon.jsx, Card.jsx, Button.jsx, Badge.jsx
- NEVER plan a file named index.jsx inside src/
- "is3D" is always false`;

export async function planProject(prompt: string, onPing?: () => void): Promise<ProjectSpec | null> {
  const ranked = modelHealth.rankModels(PLAN_MODELS, "js");
  if (ranked.length === 0) { pipelineErr("[PIPELINE][S1] All plan models unhealthy"); return null; }

  for (let mi = 0; mi < ranked.length; mi++) {
    const model = ranked[mi];
    logStage("S1", model, `Planning (${mi + 1}/${ranked.length})`);
    await rateLimiter.waitForSlot(model, `plan/${mlabel(model)}`, onPing);
    onPing?.();

    const controller = new AbortController();
    const timer      = setTimeout(() => controller.abort(), PLAN_TIMEOUT_MS);
    const t0         = performance.now();

    try {
      const res = await nvidia.chat.completions.create(
        {
          model, temperature: deterministicTemp(prompt, "plan"), max_tokens: 3500,
          messages: [{ role: "system", content: PLANNER_SYSTEM }, { role: "user", content: prompt }],
        },
        { signal: controller.signal },
      );
      clearTimeout(timer);
      rateLimiter.recordSuccess(model);
      modelHealth.recordSuccess(model, performance.now() - t0, "js");

      let raw  = fixRedactedTokens(res.choices[0]?.message?.content ?? "");
      const text = stripMarkdown(raw);
      const s = text.indexOf("{"); const e = text.lastIndexOf("}");
      if (s === -1 || e === -1) throw new Error("No JSON in planner response");

      const parsed = JSON.parse(text.slice(s, e + 1)) as ProjectSpec;
      parsed.files = parsed.files
        .map((f) => ({ path: f.path.replace(/^\/+/, ""), description: f.description || f.path, dependencies: Array.isArray(f.dependencies) ? f.dependencies : [], is3D: false, isAnimation: f.isAnimation === true }))
        .filter((f) => !BOILERPLATE_PATHS.has(f.path))
        // Filter out any CSS files the planner may have hallucinated
        .filter((f) => !isCssFile(f.path))
        .filter((f) => !/^[0-9]/.test(f.path.split("/").pop() ?? ""));

      const compFiles = parsed.files.filter((f) => f.path.startsWith("src/components/"));
      const nonComp   = parsed.files.filter((f) => !f.path.startsWith("src/components/"));
      if (compFiles.length > MAX_COMPONENTS) parsed.files = [...compFiles.slice(0, MAX_COMPONENTS), ...nonComp];

      if (!parsed.files.some((f) => f.path === "src/App.jsx"))
        parsed.files.push({ path: "src/App.jsx", description: "Root component", dependencies: [], is3D: false, isAnimation: false });

      parsed.designTokens = generateDesignTokens(parsed);
      logStage("S1", model, `Planned ${parsed.files.length} files`);
      return parsed;

    } catch (e: unknown) {
      clearTimeout(timer);
      rateLimiter.recordFailure(model);
      modelHealth.recordFailure(model);
      const status = (e as { status?: number })?.status ?? 0;
      if (status === 401 || status === 403) { pipelineErr(`[PIPELINE][S1] Auth error`); return null; }
      pipelineLog(`[PIPELINE][S1][${mlabel(model)}] Failed — ${mi === ranked.length - 1 ? "exhausted" : "next"}`);
    }
  }
  return null;
}

// ═══════════════════════════════════════════════════════════════════════════════
// REGION 11 — S1.5: SPEC VALIDATOR
// ═══════════════════════════════════════════════════════════════════════════════

interface SpecValidationResult { valid: boolean; errors: string[]; }

function validateProjectSpec(spec: ProjectSpec): SpecValidationResult {
  const errors: string[] = [];
  const seenPaths = new Set<string>();

  for (const file of spec.files) {
    if (!file.path.startsWith("src/") && !BOILERPLATE_PATHS.has(file.path))
      errors.push(`Path must start with src/: ${file.path}`);
    // CSS files are invalid in spec
    if (isCssFile(file.path))
      errors.push(`CSS files not allowed: ${file.path}`);
    const ext = "." + (file.path.split(".").pop() ?? "");
    if (!VALID_EXTENSIONS.has(ext))
      errors.push(`Invalid extension "${ext}": ${file.path}`);
    if (seenPaths.has(file.path))
      errors.push(`Duplicate path: ${file.path}`);
    seenPaths.add(file.path);
  }

  const depMap  = new Map(spec.files.map((f) => [f.path, f.dependencies ?? []]));
  const visited = new Set<string>();
  const inStack = new Set<string>();
  function hasCycle(node: string): boolean {
    if (inStack.has(node))  return true;
    if (visited.has(node))  return false;
    visited.add(node); inStack.add(node);
    for (const dep of depMap.get(node) ?? []) if (hasCycle(dep)) return true;
    inStack.delete(node); return false;
  }
  for (const f of spec.files) {
    if (hasCycle(f.path)) { errors.push(`Circular dependency: ${f.path}`); break; }
  }

  return { valid: errors.length === 0, errors };
}

function prioritizeFiles(files: FileSpec[]): FileSpec[] {
  // Remove any CSS files that may have slipped through
  const nonCss = files.filter((f) => !isCssFile(f.path));
  return [...nonCss].sort((a, b) => {
    const rank = (p: string) => {
      const i = FILE_PRIORITY_ORDER.findIndex((prefix) => p.startsWith(prefix) || p === prefix);
      return i === -1 ? FILE_PRIORITY_ORDER.length : i;
    };
    return rank(a.path) - rank(b.path);
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// REGION 12 — VALIDATOR
// ═══════════════════════════════════════════════════════════════════════════════

function checkOutputContract(file: StreamFile): { passed: boolean; violations: string[] } {
  const violations: string[] = [];
  const c = file.content;
  if (isCssFile(file.path)) { violations.push("CSS file not allowed"); return { passed: false, violations }; }
  if (!file.path.endsWith(".jsx") && !file.path.endsWith(".js")) return { passed: true, violations };
  if (file.path.endsWith(".jsx") && !/\bexport\s+default\b/.test(c))    violations.push("missing export default");
  if (file.path.endsWith(".jsx") && !/return\s*\(?\s*</.test(c))        violations.push("no JSX return");
  if (/\bconsole\.(log|warn|error|debug)\s*\(/.test(c))                 violations.push("contains console calls");
  if (/\/\/\s*TODO|\/\*\s*TODO/.test(c))                                violations.push("contains TODO");
  if (/\bfunction\s+\w+\s*\([^)]*\)\s*\{\s*\}/.test(c) && c.split("\n").length < 10) violations.push("empty function body");
  return { passed: violations.length === 0, violations };
}

function validateSingleFile(file: StreamFile): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const { path, content }         = file;

  // CSS files are always rejected
  if (isCssFile(path)) {
    return [{ path, type: "forbidden-import", message: "CSS file not allowed in pipeline", severity: "error" }];
  }

  if (!content || content.trim().length === 0) {
    return [{ path, type: "empty-file", message: "File is empty", severity: "error" }];
  }
  if (content.trim().length < MIN_FILE_CHARS) {
    return [{ path, type: "too-short", message: `Only ${content.length} chars`, severity: "error" }];
  }

  // v17.0: forbidden-import check integrated into validation issues (includes CSS imports)
  if (hasForbiddenImports(content)) {
    issues.push({ path, type: "forbidden-import", message: "File contains forbidden imports (including CSS)", severity: "error" });
  }

  if (!path.endsWith(".jsx") && !path.endsWith(".js")) return issues;

  if (path.endsWith(".jsx") && !/\bexport\s+default\b/.test(content))
    issues.push({ path, type: "missing-export", message: "No export default", severity: "error" });

  const openT  = (content.match(/<[A-Z][a-zA-Z0-9]*[\s>]/g) ?? []).length;
  const closeT = (content.match(/<\/[A-Z][a-zA-Z0-9]*>/g) ?? []).length;
  const selfC  = (content.match(/<[A-Z][a-zA-Z0-9]*[^>]*\/>/g) ?? []).length;
  const bal    = openT - closeT - selfC;
  if (Math.abs(bal) > JSX_IMBALANCE_TOLERANCE)
    issues.push({ path, type: "jsx-imbalance", message: `Tag delta=${bal}`, severity: "error" });

  const defined = new Set<string>();
  const defRe   = /(?:function|const|class|let|var)\s+([A-Z][a-zA-Z0-9_]*)/g;
  const impRe   = /^import[^{]*\{([^}]+)\}|^import\s+([A-Z]\w*)\s+from/gm;
  let mx: RegExpExecArray | null;
  while ((mx = impRe.exec(content)) !== null) {
    if (mx[1]) mx[1].split(",").forEach((s) => { const n = s.trim().split(" as ").pop()?.trim(); if (n) defined.add(n); });
    if (mx[2]) defined.add(mx[2]);
  }
  while ((mx = defRe.exec(content)) !== null) { if (mx[1]) defined.add(mx[1]); }

  const INTRINSICS = new Set(["React","Fragment","Suspense","StrictMode","Component","PureComponent","ErrorBoundary","Provider","Consumer","Router","Route","Routes","Navigate","Link","Switch","motion"]);
  const jsxRe = /<([A-Z][a-zA-Z0-9]*)/g;
  while ((mx = jsxRe.exec(content)) !== null) {
    if (mx[1] && !defined.has(mx[1]) && !INTRINSICS.has(mx[1]))
      issues.push({ path, type: "undefined-component", message: `<${mx[1]}> not defined`, severity: "warning" });
  }

  if (/if\s*\([^)]*\)\s*\{[^}]*\buse[A-Z]/.test(content))
    issues.push({ path, type: "invalid-hook", message: "Hook in conditional", severity: "error" });
  if (/(?:for|while|forEach)[^{]*\{[^}]*\buse[A-Z]/.test(content))
    issues.push({ path, type: "invalid-hook", message: "Hook in loop", severity: "error" });

  return issues;
}

function checkGenerationQuality(files: StreamFile[]): GenerationQualityReport {
  const nonBoilerplate = files.filter((f) => !BOILERPLATE_PATHS.has(f.path) && !isCssFile(f.path));
  const allIssues: ValidationIssue[] = [];
  const invalidPaths   = new Set<string>();
  for (const file of nonBoilerplate) {
    const errs = validateSingleFile(file).filter((i) => i.severity === "error");
    if (errs.length > 0) { invalidPaths.add(file.path); allIssues.push(...errs); }
  }
  const total   = nonBoilerplate.length;
  const invalid = invalidPaths.size;
  return { totalFiles: total, invalidFiles: invalid, invalidRate: total > 0 ? invalid / total : 0, issues: allIssues, passed: (total > 0 ? invalid / total : 0) <= QUALITY_GATE_THRESHOLD };
}

// ═══════════════════════════════════════════════════════════════════════════════
// REGION 13 — IMPORT GRAPH
// ═══════════════════════════════════════════════════════════════════════════════

function resolveRelative(dir: string, rel: string): string {
  const parts    = `${dir}/${rel}`.split("/");
  const resolved: string[] = [];
  for (const p of parts) {
    if (p === "..") resolved.pop();
    else if (p !== ".") resolved.push(p);
  }
  return resolved.join("/");
}

function buildImportGraph(files: StreamFile[]): ImportGraph {
  const pathSet = new Set(files.map((f) => f.path));
  const edges   = new Map<string, Set<string>>();
  const missing = new Map<string, string[]>();

  for (const file of files) {
    if (!file.path.endsWith(".jsx") && !file.path.endsWith(".js")) continue;
    const deps: Set<string> = new Set();
    const misses: string[]  = [];
    const relRe = /from\s+['"](\.[^'"]+)['"]/g;
    let m: RegExpExecArray | null;
    while ((m = relRe.exec(file.content)) !== null) {
      const imp = m[1];
      // Skip CSS imports entirely
      if (imp.endsWith(".css") || imp.endsWith(".scss") || imp.endsWith(".sass") || imp.endsWith(".less")) continue;
      const dir      = file.path.split("/").slice(0, -1).join("/");
      const resolved = resolveRelative(dir, imp);
      if (pathSet.has(resolved)) deps.add(resolved);
      else misses.push(resolved);
    }
    edges.set(file.path, deps);
    if (misses.length > 0) missing.set(file.path, misses);
  }

  const circular: string[] = [];
  const visited  = new Set<string>();
  const stack    = new Set<string>();
  function dfs(node: string): boolean {
    if (stack.has(node))   { circular.push(node); return true; }
    if (visited.has(node)) return false;
    visited.add(node); stack.add(node);
    for (const dep of edges.get(node) ?? []) if (dfs(dep)) return true;
    stack.delete(node); return false;
  }
  for (const path of edges.keys()) dfs(path);

  return { edges, missing, circular };
}

function annotateGraphIssues(files: StreamFile[], graph: ImportGraph): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  for (const [path, misses] of graph.missing) {
    for (const miss of misses) {
      issues.push({ path, type: "unresolvable-import", message: `Cannot resolve: ${miss}`, severity: "error" });
    }
  }
  for (const path of graph.circular) {
    issues.push({ path, type: "circular-import", message: "Circular import chain", severity: "error" });
  }
  return issues;
}

// ═══════════════════════════════════════════════════════════════════════════════
// REGION 14 — RESOLVER
// ═══════════════════════════════════════════════════════════════════════════════

function mergeImportsSafely(existingLine: string, newSpecifiers: string[]): string {
  const match = existingLine.match(/^import\s*\{([^}]+)\}\s*from\s*(['"][^'"]+['"])/);
  if (!match) return existingLine;
  const existing    = match[1].split(",").map((s) => s.trim()).filter(Boolean);
  const existingSet = new Set(existing);
  const toAdd       = newSpecifiers.filter((s) => !existingSet.has(s));
  if (toAdd.length === 0) return existingLine;
  return `import { ${[...existing, ...toAdd.sort()].join(", ")} } from ${match[2]}`;
}

function autoResolveImports(files: StreamFile[]): AutoResolveResult {
  let fixedCount = 0;
  const details: string[] = [];

  const resolved = files.map((file) => {
    if (!file.path.endsWith(".jsx") && !file.path.endsWith(".js")) return file;
    let content = file.content;
    let changed  = false;

    if (/from\s*['"]react-router-dom['"]/.test(content)) {
      content = content.split("\n").filter((l) => !/from\s*['"]react-router-dom['"]/.test(l)).join("\n")
        .replace(/<Link\s+to=(['"])/g, "<a href=$1").replace(/<Link\s+href=(['"])/g, "<a href=$1")
        .replace(/<Link(\s[^>]*)?>/g, "<a$1>").replace(/<\/Link>/g, "</a>");
      changed = true; details.push(`${file.path}: removed react-router-dom`);
    }

    // Strip any remaining CSS imports
    if (hasCssImport(content)) {
      content = stripBannedImports(content);
      changed = true; details.push(`${file.path}: removed CSS imports`);
    }

    if (changed) { fixedCount++; return { ...file, content }; }
    return file;
  });

  return { files: resolved, fixedCount, details };
}

function normalizeJsxFiles(files: StreamFile[]): NormalizationResult {
  let reactImportsAdded = 0;
  let exportsAdded      = 0;
  const jsxIssues: string[] = [];

  const normalized = files.map((file) => {
    // Skip CSS files — they should never be here but if they are, ignore
    if (isCssFile(file.path)) return file;
    if (!file.path.endsWith(".jsx")) return file;
    let content = file.content;
    let changed  = false;

    if (!/\bimport\s+React\b/.test(content) && /<[A-Za-z]/.test(content)) {
      content = `import React from 'react';\n${content}`; changed = true; reactImportsAdded++;
    }
    if (!/\bexport\s+default\b/.test(content)) {
      const base    = file.path.split("/").pop()?.replace(".jsx", "") ?? "Component";
      const safe    = base.replace(/[^a-zA-Z0-9_$]/g, "") || "Component";
      const func    = content.match(/^(?:function|const)\s+([A-Z][a-zA-Z0-9_]*)\b/m);
      content = `${content}\n\nexport default ${func ? func[1] : safe};\n`;
      changed = true; exportsAdded++;
    }
    const openT  = (content.match(/<[A-Z][a-zA-Z0-9]*[\s>]/g) ?? []).length;
    const closeT = (content.match(/<\/[A-Z][a-zA-Z0-9]*>/g) ?? []).length;
    const selfC  = (content.match(/<[A-Z][a-zA-Z0-9]*[^>]*\/>/g) ?? []).length;
    const bal    = openT - closeT - selfC;
    if (Math.abs(bal) > JSX_IMBALANCE_TOLERANCE) jsxIssues.push(`${file.path}: delta=${bal}`);

    const cleaned = stripBannedImports(content);
    if (cleaned !== content) { content = cleaned; changed = true; }

    return changed ? { ...file, content: cleanOutput(content) } : file;
  });

  return { files: normalized, reactImportsAdded, exportsAdded, jsxIssues };
}

function injectMissingReactImports(files: StreamFile[]): StreamFile[] {
  return files.map((file) => {
    if (isCssFile(file.path)) return file;
    if (!file.path.endsWith(".jsx")) return file;
    if (/\bimport\s+React\b/.test(file.content)) return file;
    if (/<[A-Za-z]/.test(file.content)) return { ...file, content: cleanOutput(`import React from 'react';\n${file.content}`) };
    return file;
  });
}

function deduplicateFiles(files: StreamFile[]): StreamFile[] {
  const map = new Map<string, StreamFile>();
  for (const f of files) {
    // Drop CSS files at dedup stage
    if (isCssFile(f.path)) continue;
    map.set(f.path, f);
  }
  return Array.from(map.values());
}

// ═══════════════════════════════════════════════════════════════════════════════
// REGION 15 — GENERATOR
// ═══════════════════════════════════════════════════════════════════════════════

function buildRichContext(fileSpec: FileSpec, generatedSoFar: StreamFile[], spec: ProjectSpec): string {
  const genMap = new Map(generatedSoFar.map((f) => [f.path, f.content]));

  const depContents = (fileSpec.dependencies ?? [])
    .map((dep) => { const c = genMap.get(dep); if (!c) return null; return `// DEP: ${dep}\n${c.split("\n").slice(0, 40).join("\n")}`; })
    .filter(Boolean).join("\n\n---\n\n");

  const fileDir  = fileSpec.path.split("/").slice(0, -1).join("/");
  const siblings = generatedSoFar
    .filter((f) => f.path !== fileSpec.path && f.path.split("/").slice(0, -1).join("/") === fileDir && !f.provisional)
    .slice(0, 3)
    .map((f) => `// SIBLING: ${f.path}\n${f.content.split("\n").slice(0, 30).join("\n")}`)
    .join("\n\n---\n\n");

  const dt       = spec.designTokens;
  const tokens   = `Colors: primary=${dt.colors.primary[0]}, accent=${dt.colors.accent[0]}, bg=${dt.colors.background[0]} | Font: ${dt.typography.fontFamily} | H1: ${dt.typography.headingSizes.h1}`;

  const sections: string[] = [];
  if (depContents) sections.push(`━━━ DEPENDENCIES ━━━\n${depContents}`);
  if (siblings)    sections.push(`━━━ SIBLINGS ━━━\n${siblings}`);
  sections.push(`━━━ DESIGN TOKENS ━━━\n${tokens}`);
  return sections.join("\n\n");
}

function makeCodegenSystem(spec: ProjectSpec, generatedSoFar: StreamFile[]): string {
  const siblings = generatedSoFar
    .filter((f) => !f.provisional)
    .map((f) => `  - ${f.path.split("/").pop()?.replace(/\.[^.]+$/, "")} → './${f.path.replace(/^src\//, "")}'`)
    .join("\n") || "  (none yet)";

  return `You are an elite React engineer building production-grade websites.
Output ONLY raw file content. No markdown. No backticks. No explanations. No "use client". No TypeScript.
The VERY FIRST character must be the first character of the file.

━━━ RULES (NON-NEGOTIABLE) ━━━
1. NEVER explain after export default. Complete every file — no TODO, no truncation.
2. NO TypeScript: no ": string", ": React.FC", "useState<string>", interface, type alias.
3. Arrow functions use "=>" NEVER "= />".
4. ALL styling must use inline style={{}} props — NO className, NO CSS files, NO external stylesheets.
5. Every JSX open tag must have a matching close tag or self-close.
6. ICONS: use inline SVG only. Do NOT import from lucide-react or any icon library.
7. CARDS: plain divs + inline styles. NEVER import local Card/Button/Badge.
8. STRICTLY FORBIDDEN:
   - CSS files (any import ending .css)
   - import './style.css' or similar
   - <style> tags
   - framer-motion
   - lucide-react
   - react-router-dom or react-router
9. Only allowed imports: react, react-dom, and relative paths to .jsx or .js files within this project.
10. NO console.log, NO TODO comments, NO empty functions, NO CSS imports.
━━━ AVAILABLE PACKAGES ━━━
${AVAILABLE_PACKAGES}

━━━ PROJECT ━━━
Name: ${spec.projectName} | ${spec.description}
Vision: ${spec.globalContext ?? "ultra-dark premium SaaS, inline styles only, indigo/purple palette"}

━━━ ALREADY GENERATED ━━━
${siblings}`;
}

async function generateOneFile(
  fileSpec:       FileSpec,
  spec:           ProjectSpec,
  generatedSoFar: StreamFile[],
  metrics:        PipelineMetrics,
  prompt:         string,
  onPing?:        () => void,
): Promise<{ file: StreamFile; usedFallback: boolean }> {
  const isDataFile  = /^src\/(data|utils)\//.test(fileSpec.path);
  const isHookFile  = fileSpec.path.startsWith("src/hooks/");

  // Hard block: never generate CSS files
  if (isCssFile(fileSpec.path)) {
    pipelineLog(`[PIPELINE][S2] CSS file skipped: ${fileSpec.path}`);
    return { file: { path: fileSpec.path.replace(/\.css$/, ".jsx"), content: makeFallbackComponent({ ...fileSpec, path: fileSpec.path.replace(/\.css$/, ".jsx") }) }, usedFallback: true };
  }

  // v17.0: Strict file-level regen control
  const attemptsSoFar = _regenAttempts.get(fileSpec.path) ?? 0;
  if (attemptsSoFar >= MAX_REGEN_ATTEMPTS) {
    pipelineLog(`[PIPELINE][S2] ${fileSpec.path} exceeded max regen attempts (${MAX_REGEN_ATTEMPTS}) — using fallback`);
    metrics.increment("regenSkipped");
    metrics.increment("fallbackUsageCount");
    return { file: { path: fileSpec.path, content: makeFallbackComponent(fileSpec) }, usedFallback: true };
  }

  const ftype  = fileTypeOf(fileSpec.path);
  const ranked = modelHealth.rankModels(CODEGEN_MODELS, ftype);

  if (ranked.length === 0) {
    pipelineLog(`[PIPELINE][S2] All models unhealthy for ${fileSpec.path}`);
    metrics.increment("fallbackUsageCount");
    return { file: { path: fileSpec.path, content: makeFallbackComponent(fileSpec) }, usedFallback: true };
  }

  const system = (isDataFile || isHookFile)
    ? `You are a JavaScript expert. Output ONLY raw JS. No markdown. No TypeScript. No console.log.\nExport named OR default exports. REAL data — at least 4-6 items.`
    : makeCodegenSystem(spec, generatedSoFar);

  const richContext = buildRichContext(fileSpec, generatedSoFar, spec);
  const userPrompt  = `Write the COMPLETE file: ${fileSpec.path}
Purpose: ${fileSpec.description}
${fileSpec.isAnimation ? "REQUIRED: use CSS animations via inline style only (keyframes via <style> tag in JSX if needed, no external animation libraries)." : ""}
No TypeScript. No prose after export default. No console.log. No TODO. Start NOW.
CRITICAL: Do NOT import framer-motion, lucide-react, clsx, or any banned package. Do NOT import any .css file.
Use inline style={{}} for ALL styling.

${richContext}`;

  for (let mi = 0; mi < ranked.length; mi++) {
    const model = ranked[mi];

    for (let attempt = 0; attempt < MAX_FILE_RETRIES; attempt++) {
      await rateLimiter.waitForSlot(model, `${mlabel(model)}/${fileSpec.path}`, onPing);
      onPing?.();

      const controller = new AbortController();
      const timer      = setTimeout(() => controller.abort(), FILE_TIMEOUT_MS);
      const t0         = performance.now();

      try {
        const temperature = deterministicTemp(prompt, fileSpec.path, attempt);
        logStage("S2", model, `Generating ${fileSpec.path} (m${mi + 1} a${attempt + 1} t=${temperature})`);
        metrics.recordModel(model);

        const res = await nvidia.chat.completions.create(
          { model, temperature, max_tokens: 3500, messages: [{ role: "system", content: system }, { role: "user", content: userPrompt }] },
          { signal: controller.signal },
        );

        const latency = performance.now() - t0;
        clearTimeout(timer);
        rateLimiter.recordSuccess(model);
        modelHealth.recordSuccess(model, latency, ftype);
        metrics.recordFileGenTime(latency);
        metrics.recordAttempt(true);

        let raw     = fixRedactedTokens(res.choices[0]?.message?.content ?? "");
        let content = stripMarkdown(raw);

        // v17.0: Hard CSS ban at generation level
        if (containsCSS(content)) {
          throw new Error("CSS detected in generated content — banned");
        }

        // Fail fast on corruption patterns
        if (/=\s*\/\s*>/.test(content) || /<REDACTED/.test(content) || content.trim().length < MIN_FILE_CHARS) {
          throw new Error("Corruption detected (token corruption, redacted, or too short)");
        }

        if (!content || content.length < MIN_FILE_CHARS) throw new Error(`Too short: ${content.length}`);

        // Strip banned imports including CSS imports
        if (fileSpec.path.endsWith(".jsx") || fileSpec.path.endsWith(".js")) {
          content = stripBannedImports(content);
        }
        content = cleanLLMOutput(content, fileSpec.path);

        if (content.length > MAX_FILE_CHARS) {
          const trunc = content.slice(0, MAX_FILE_CHARS);
          const brace = trunc.lastIndexOf("\n}");
          content = brace > MAX_FILE_CHARS * 0.6 ? trunc.slice(0, brace + 2) : trunc;
        }

        if (fileSpec.path.endsWith(".jsx")) {
          content = addJsxExtensions(content);
          content = injectReactImport(content);
          content = ensureDefaultExport(content, fileSpec.path.split("/").pop()?.replace(".jsx", "") ?? "Component");
        }
        if ((isDataFile || isHookFile) && !content.includes("export default") && !content.includes("export const")) {
          content = `export default ${content};\n`;
        }

        const contract = checkOutputContract({ path: fileSpec.path, content });
        if (!contract.passed) {
          pipelineLog(`[PIPELINE][S2][${mlabel(model)}] Contract violation in ${fileSpec.path}: ${contract.violations.join(", ")}`);
          metrics.recordAttempt(false);
          metrics.increment("retryCount");
          if (attempt < MAX_FILE_RETRIES - 1) { await sleepWithPing(backoffMs(attempt), onPing); continue; }
          break;
        }

        content = cleanOutput(content);
        logStage("S2", model, `✓ ${fileSpec.path} (${content.length}c, ${(latency / 1000).toFixed(1)}s)`);
        // Reset regen attempts on success
        _regenAttempts.delete(fileSpec.path);
        return { file: { path: fileSpec.path, content }, usedFallback: false };

      } catch (e: unknown) {
        clearTimeout(timer);
        rateLimiter.recordFailure(model);
        modelHealth.recordFailure(model);
        metrics.increment("errorCount");
        metrics.increment("retryCount");
        metrics.recordAttempt(false);

        const status = (e as { status?: number })?.status ?? 0;
        if (status === 401 || status === 403) {
          pipelineErr(`[PIPELINE][S2][${mlabel(model)}] Auth error`);
          metrics.increment("fallbackUsageCount");
          return { file: { path: fileSpec.path, content: makeFallbackComponent(fileSpec) }, usedFallback: true };
        }
        if (status === 410 || status === 404) break;
        if (attempt < MAX_FILE_RETRIES - 1) {
          const delay = backoffMs(attempt);
          pipelineLog(`[PIPELINE][S2][${mlabel(model)}] ${fileSpec.path} a${attempt + 1} failed — backoff ${delay}ms`);
          await sleepWithPing(delay, onPing);
        } else {
          // Increment regen attempts after exhausting retries
          _regenAttempts.set(fileSpec.path, attemptsSoFar + 1);
        }
      }
    }
  }

  pipelineErr(`[PIPELINE][S2] ${fileSpec.path} — all exhausted, fallback`);
  metrics.increment("fallbackUsageCount");
  _regenAttempts.set(fileSpec.path, attemptsSoFar + 1);
  return { file: { path: fileSpec.path, content: makeFallbackComponent(fileSpec) }, usedFallback: true };
}

async function generateFilesInBatches(
  specs:       FileSpec[],
  spec:        ProjectSpec,
  accumulated: StreamFile[],
  metrics:     PipelineMetrics,
  prompt:      string,
  smartEmit:   (f: StreamFile) => Promise<void>,
  onPing?:     () => void,
): Promise<{ files: StreamFile[]; consecutiveFails: number }> {
  const result: StreamFile[] = [];
  let consecutiveFails = 0;

  // Filter out any CSS specs before batching
  const nonCssSpecs = specs.filter((s) => !isCssFile(s.path));

  for (let i = 0; i < nonCssSpecs.length; i += PARALLEL_BATCH_SIZE) {
    if (consecutiveFails >= CONSECUTIVE_FAIL_LIMIT) {
      pipelineErr(`[PIPELINE][S2] Fast-fail: ${consecutiveFails} consecutive failures`);
      break;
    }
    const batch = nonCssSpecs.slice(i, i + PARALLEL_BATCH_SIZE);
    logStage("S2", "batch", `Files ${i + 1}–${Math.min(i + PARALLEL_BATCH_SIZE, nonCssSpecs.length)} of ${nonCssSpecs.length}`);

    const batchResults = await Promise.all(
      batch.map((fs) => generateOneFile(fs, spec, [...accumulated, ...result], metrics, prompt, onPing))
    );

    for (const { file, usedFallback } of batchResults) {
      result.push(file);
      consecutiveFails = usedFallback ? consecutiveFails + 1 : 0;
      await smartEmit({ path: file.path, content: file.content, provisional: true });
    }
  }

  return { files: result, consecutiveFails };
}

// ═══════════════════════════════════════════════════════════════════════════════
// REGION 16 — FIXER (v17.0: FILE‑LEVEL ISOLATION + HARD VALIDATION)
// ═══════════════════════════════════════════════════════════════════════════════

function classifyFailure(file: StreamFile, issues: ValidationIssue[]): FailureReason {
  const types = issues.map((i) => i.type);
  if (types.includes("jsx-imbalance")) return "jsx-imbalance";
  if (types.includes("missing-import") || types.includes("unresolvable-import")) return "missing-import";
  if (types.includes("too-short") || types.includes("empty-file")) return "too-short";
  const open  = (file.content.match(/\{/g) ?? []).length;
  const close = (file.content.match(/\}/g) ?? []).length;
  if (Math.abs(open - close) > 2) return "syntax";
  return "unknown";
}

function classifyErrorCategory(issues: ValidationIssue[]): ErrorCategory {
  const hasRegenRequired = issues.some((i) => REGEN_REQUIRED_TYPES.has(i.type));
  const hasAutoFixable   = issues.some((i) => AUTO_FIX_ONLY_TYPES.has(i.type));
  if (hasRegenRequired && !hasAutoFixable) return "regen-required";
  return "auto-fixable";
}

function autoFixUseEffect(content: string): string {
  let result = content;
  result = result.replace(
    /\buseEffect\s*\(\s*(\(\s*\)\s*=>\s*\{(?:[^{}]|\{[^{}]*\})*\})\s*\)(?!\s*,)/g,
    (_, fn) => `useEffect(${fn}, [])`
  );
  result = result.replace(
    /\buseEffect\s*\(\s*(function\s*\(\s*\)\s*\{(?:[^{}]|\{[^{}]*\})*\})\s*\)(?!\s*,)/g,
    (_, fn) => `useEffect(${fn}, [])`
  );
  return result;
}

function autoFixJSXImbalance(content: string, path: string): string {
  if (!path.endsWith(".jsx")) return content;
  const openT  = (content.match(/<[A-Z][a-zA-Z0-9]*[\s>]/g) ?? []).length;
  const closeT = (content.match(/<\/[A-Z][a-zA-Z0-9]*>/g) ?? []).length;
  const selfC  = (content.match(/<[A-Z][a-zA-Z0-9]*[^>]*\/>/g) ?? []).length;
  const bal    = openT - closeT - selfC;
  if (Math.abs(bal) <= JSX_IMBALANCE_TOLERANCE) return content;

  const returnRe = /(\breturn\s*\()([\s\S]*?)(\)\s*;?\s*\n)/;
  const match = content.match(returnRe);
  if (!match) return content;

  const jsx = match[2];
  const wrapped = `${match[1]}\n    <div>\n${jsx}\n    </div>\n  ${match[3]}`;
  return content.replace(returnRe, wrapped);
}

function autoFixEmptyJsxReturn(content: string, path: string): string {
  if (!path.endsWith(".jsx")) return content;
  return content.replace(
    /\breturn\s*\(\s*\)\s*;?/g,
    `return (\n    <div style={{ padding: '2rem', color: '#f8fafc' }}>Component</div>\n  );`
  );
}

function autoRepairPass(files: StreamFile[]): { files: StreamFile[]; repairedCount: number; hooksFix: number; jsxFix: number; importsFix: number } {
  let repairedCount = 0;
  let hooksFix      = 0;
  let jsxFix        = 0;
  let importsFix    = 0;

  const s1 = files.map((f) => {
    // Drop CSS files
    if (isCssFile(f.path)) return f;
    if (!f.path.endsWith(".jsx")) return f;
    let c = f.content;
    const orig = c;

    c = stripBannedImports(c);

    const prevHooks = c;
    c = autoFixUseEffect(c);
    if (c !== prevHooks) hooksFix++;

    const prevJSX = c;
    c = autoFixEmptyJsxReturn(c, f.path);
    c = autoFixJSXImbalance(c, f.path);
    if (c !== prevJSX) jsxFix++;

    if (c !== orig) { repairedCount++; return { ...f, content: c }; }
    return f;
  });

  const { files: s2, fixedCount: importFixed } = autoResolveImports(s1);
  importsFix += importFixed;

  const { files: s3 } = normalizeJsxFiles(s2);

  const s4 = injectMissingReactImports(s3);

  const s5 = s4.map((f) => {
    if (isCssFile(f.path)) return f;
    if (!f.path.endsWith(".jsx") && !f.path.endsWith(".js")) return f;
    return { ...f, content: cleanOutput(deduplicateImportLines(removeUnusedImports(f.content))) };
  });

  return { files: s5, repairedCount, hooksFix, jsxFix, importsFix };
}

function revalidateAfterAutoFix(files: StreamFile[]): { clean: boolean; remainingErrors: ValidationIssue[]; syntaxErrors: ReturnType<typeof checkSyntax> } {
  const remainingErrors: ValidationIssue[] = [];
  for (const file of files) {
    if (BOILERPLATE_PATHS.has(file.path)) continue;
    if (isCssFile(file.path)) continue;
    const issues = validateSingleFile(file).filter((i) => i.severity === "error");
    remainingErrors.push(...issues);
  }

  const graph       = buildImportGraph(files);
  const graphIssues = annotateGraphIssues(files, graph);
  remainingErrors.push(...graphIssues.filter((i) => i.severity === "error"));

  const syntaxErrors = checkSyntax(files);

  const clean = remainingErrors.length === 0 && syntaxErrors.length === 0;
  return { clean, remainingErrors, syntaxErrors };
}

function runIntelligentAutoFix(
  files:   StreamFile[],
  metrics: PipelineMetrics,
): { fixed: StreamFile[]; resolvedCount: number; clean: boolean; remainingErrors: ValidationIssue[]; syntaxErrors: ReturnType<typeof checkSyntax> } {
  pipelineLog(`[PIPELINE][S3.5] Starting intelligent auto-fix...`);
  // Drop any CSS files before fixing
  let current = files.filter((f) => !isCssFile(f.path));
  let totalRepairedCount = 0;
  let totalHooksFix      = 0;
  let totalJsxFix        = 0;
  let totalImportsFix    = 0;
  const MAX_ITER = 3;

  for (let iter = 0; iter < MAX_ITER; iter++) {
    const { files: afterRepair, repairedCount, hooksFix, jsxFix, importsFix } = autoRepairPass(current);
    totalRepairedCount += repairedCount;
    totalHooksFix      += hooksFix;
    totalJsxFix        += jsxFix;
    totalImportsFix    += importsFix;

    const { clean, remainingErrors, syntaxErrors } = revalidateAfterAutoFix(afterRepair);

    if (clean) {
      pipelineLog(`[PIPELINE][AUTO-FIX] resolved all issues — skipping regen`);
      pipelineLog(`[PIPELINE][FIXER] auto-resolved: ${totalImportsFix} imports`);
      pipelineLog(`[PIPELINE][FIXER] jsx-fixed: ${totalJsxFix} files`);
      pipelineLog(`[PIPELINE][FIXER] hooks-fixed: ${totalHooksFix} files`);
      metrics.increment("autoFixResolvedCount", totalRepairedCount);
      metrics.increment("autoFixImports",  totalImportsFix);
      metrics.increment("autoFixJsx",      totalJsxFix);
      metrics.increment("autoFixHooks",    totalHooksFix);
      return { fixed: afterRepair, resolvedCount: totalRepairedCount, clean: true, remainingErrors: [], syntaxErrors: [] };
    }

    if (repairedCount === 0 && importsFix === 0) {
      pipelineLog(`[PIPELINE][AUTO-FIX] No progress in iteration ${iter + 1}, stopping`);
      metrics.increment("autoFixResolvedCount", totalRepairedCount);
      metrics.increment("autoFixImports",  totalImportsFix);
      metrics.increment("autoFixJsx",      totalJsxFix);
      metrics.increment("autoFixHooks",    totalHooksFix);
      return { fixed: afterRepair, resolvedCount: totalRepairedCount, clean: false, remainingErrors, syntaxErrors };
    }

    current = afterRepair;
  }

  const { clean, remainingErrors, syntaxErrors } = revalidateAfterAutoFix(current);
  pipelineLog(`[PIPELINE][AUTO-FIX] ${totalRepairedCount} issues repaired, ${remainingErrors.length + syntaxErrors.length} remain after ${MAX_ITER} iterations`);
  pipelineLog(`[PIPELINE][FIXER] auto-resolved: ${totalImportsFix} imports`);
  pipelineLog(`[PIPELINE][FIXER] jsx-fixed: ${totalJsxFix} files`);
  pipelineLog(`[PIPELINE][FIXER] hooks-fixed: ${totalHooksFix} files`);
  metrics.increment("autoFixResolvedCount", totalRepairedCount);
  metrics.increment("autoFixImports",  totalImportsFix);
  metrics.increment("autoFixJsx",      totalJsxFix);
  metrics.increment("autoFixHooks",    totalHooksFix);
  return { fixed: current, resolvedCount: totalRepairedCount, clean, remainingErrors, syntaxErrors };
}

async function regenerateBrokenFiles(
  files:   StreamFile[],
  broken:  RegenerableFile[],
  spec:    ProjectSpec,
  metrics: PipelineMetrics,
  prompt:  string,
  onPing?: () => void,
): Promise<StreamFile[]> {
  const HINTS: Record<FailureReason, string> = {
    "syntax":          "The previous version had unmatched braces. Write syntactically correct code only.",
    "missing-import":  "The previous version had unresolvable imports. Only import from: react, react-dom, or relative paths that exist in this project.",
    "jsx-imbalance":   "The previous version had mismatched JSX tags. Every opening tag must have a matching close or self-close.",
    "output-contract": "The previous version was missing export default or JSX return. Every component must export default a function returning JSX.",
    "too-short":       "The previous version was empty. Write a complete fully-implemented component.",
    "unknown":         "The previous version had unspecified issues. Write a clean complete well-structured component.",
  };

  const result = [...files];

  const eligibleBroken = broken.filter(({ file }) => {
    const attempts = _regenAttempts.get(file.path) ?? 0;
    if (attempts >= MAX_REGEN_ATTEMPTS) {
      pipelineLog(`[PIPELINE][REGEN] ${file.path} exceeded max regen attempts (${MAX_REGEN_ATTEMPTS}) — applying safe fallback`);
      metrics.increment("regenSkipped");
      const idx = result.findIndex((f) => f.path === file.path);
      if (idx !== -1) {
        result[idx] = replaceWithSafeComponent(file);
        metrics.increment("filesReplacedWithSafe");
      }
      return false;
    }
    return true;
  });

  for (const { file, reason } of eligibleBroken) {
    const issues = validateSingleFile(file);
    const category = classifyErrorCategory(issues.filter((i) => i.severity === "error"));
    if (category === "auto-fixable") {
      pipelineLog(`[PIPELINE][REGEN] Skipping regen for ${file.path} (auto-fixable: ${issues.map((i) => i.type).join(", ")})`);
      metrics.increment("regenSkipped");
      continue;
    }

    _regenAttempts.set(file.path, (_regenAttempts.get(file.path) ?? 0) + 1);

    const fileSpec: FileSpec = {
      path: file.path,
      description: `[REGEN:${reason}] ${HINTS[reason]}`,
      dependencies: [],
      is3D: false,
      isAnimation: false,
    };
    const healthy  = files.filter((f) => !broken.some((b) => b.file.path === f.path));
    const { file: regen } = await generateOneFile(fileSpec, spec, healthy, metrics, prompt, onPing);
    metrics.increment("regenCount");
    const idx = result.findIndex((f) => f.path === file.path);
    if (idx !== -1) result[idx] = regen;
    logStage("REGEN", reason, `${file.path} (${regen.content.length}c)`);
  }
  return result;
}

/**
 * v17.0: Ensure critical files (src/App.jsx, src/main.jsx) are always valid.
 */
async function enforceCriticalFileValidity(
  files:   StreamFile[],
  spec:    ProjectSpec,
  metrics: PipelineMetrics,
  prompt:  string,
  onPing?: () => void,
): Promise<StreamFile[]> {
  let result = [...files];

  for (const criticalPath of CRITICAL_FILES) {
    const file = result.find((f) => f.path === criticalPath);
    if (!file) continue;

    const validation = runHardValidation(file);
    const hasForbidden = hasForbiddenImports(file.content);

    if (!validation.passed || hasForbidden) {
      pipelineLog(`[PIPELINE][CRITICAL-FILE] ${criticalPath} is invalid — attempting force-regen`);
      metrics.increment("criticalFilesForceRegenerated");

      const fileSpec: FileSpec = {
        path: criticalPath,
        description: `Critical file — must be fully valid React component with export default, inline styles only`,
        dependencies: [],
        is3D: false,
        isAnimation: false,
      };

      const { file: regenFile } = await generateOneFile(fileSpec, spec, result.filter((f) => f.path !== criticalPath), metrics, prompt, onPing);

      const regenValid = runHardValidation(regenFile);
      const regenForbidden = hasForbiddenImports(regenFile.content);

      if (regenValid.passed && !regenForbidden) {
        pipelineLog(`[PIPELINE][CRITICAL-FILE] ${criticalPath} force-regen succeeded`);
        result = result.map((f) => f.path === criticalPath ? regenFile : f);
      } else {
        pipelineLog(`[PIPELINE][CRITICAL-FILE] ${criticalPath} force-regen also invalid — safe-replacing`);
        metrics.increment("filesReplacedWithSafe");
        result = result.map((f) => f.path === criticalPath ? replaceWithSafeComponent(f) : f);
      }
    }
  }

  return result;
}

async function runFixPipeline(
  generatedFiles: StreamFile[],
  spec:           ProjectSpec,
  metrics:        PipelineMetrics,
  prompt:         string,
  onPing?:        () => void,
): Promise<StreamFile[]> {
  // Drop CSS files at the very start of fix pipeline
  let inputFiles = generatedFiles.filter((f) => !isCssFile(f.path));

  // Step 1: Syntax check (FIRST)
  pipelineLog(`[PIPELINE][S3][STEP-1] Syntax check on raw generated output`);
  const rawSyntaxErrors = checkSyntax(inputFiles);
  if (rawSyntaxErrors.length > 0) {
    for (const e of rawSyntaxErrors) pipelineLog(`  [SYNTAX] ${e.path}: ${e.message}`);
    metrics.increment("errorCount", rawSyntaxErrors.length);
  }

  // Step 2: Semantic validation
  pipelineLog(`[PIPELINE][S3][STEP-2] Semantic validation on raw generated output`);
  const semanticResult = runSemanticValidation(inputFiles);
  if (semanticResult.errors.length > 0) {
    for (const e of semanticResult.errors) pipelineLog(`  [SEMANTIC] ${e.file}: ${e.type} — ${e.message}`);
  }

  // Step 2.5 (v17.0): Hard validation gate — isolate forbidden/invalid files immediately
  pipelineLog(`[PIPELINE][S3][STEP-2.5] Hard validation gate (forbidden imports + structural check)`);
  let files = applyHardValidationGate(semanticResult.files.filter((f) => !isCssFile(f.path)), metrics, "POST-SEMANTIC");

  // Step 3: Auto-fix
  pipelineLog(`[PIPELINE][S3][STEP-3] Auto-fix pass`);
  const {
    fixed:           autoFixed,
    clean:           autoClean,
  } = runIntelligentAutoFix(files, metrics);
  files = autoFixed;

  // Step 3.5 (v17.0): Re-apply hard validation after auto-fix
  files = applyHardValidationGate(files, metrics, "POST-AUTOFIX");

  if (autoClean) {
    pipelineLog(`[PIPELINE][S3] ✓ Auto-fix resolved all errors`);
    files = hardenOutput(files);
    files = applyHardValidationGate(files, metrics, "POST-HARDEN");
    files = await enforceCriticalFileValidity(files, spec, metrics, prompt, onPing);
    return files;
  }

  // Step 4: Import graph analysis
  pipelineLog(`[PIPELINE][S3][STEP-4] Import graph analysis`);
  const graph       = buildImportGraph(files);
  const graphIssues = annotateGraphIssues(files, graph);
  if (graphIssues.length > 0) {
    for (const gi of graphIssues) pipelineLog(`  [GRAPH] ${gi.path}: ${gi.message}`);
    metrics.increment("errorCount", graphIssues.length);
  }

  // Step 5: Normalize
  const { files: norm } = normalizeJsxFiles(files);
  files = injectMissingReactImports(norm);
  files = deduplicateFiles(files);

  // Step 5.5 (v17.0): Hard validation after normalize
  files = applyHardValidationGate(files, metrics, "POST-NORMALIZE");

  // Step 6: LLM fix for regen-required errors
  const stillBroken = files.filter((f) => {
    if (isCssFile(f.path)) return false;
    const issues = validateSingleFile(f).filter((i) => i.severity === "error");
    if (issues.length === 0) return false;
    return classifyErrorCategory(issues) === "regen-required";
  });

  let result = files;

  if (stillBroken.length === 0) {
    pipelineLog(`[PIPELINE][S3][STEP-6] All critical errors resolved — skipping LLM fix`);
  } else {
    pipelineLog(`[PIPELINE][S3][STEP-6] ${stillBroken.length} file(s) need LLM fix`);
    metrics.startTimer("fixTime");
    try {
      const fixResult = await fixWholeProjectWithRetry(
        files.map((f) => ({ path: f.path, content: f.content })),
        2, semanticResult.errors,
      );
      metrics.stopTimer("fixTime");

      if (!fixResult.ok) {
        throw new Error(`LLM fix failed: ${fixResult.reason}`);
      }

      const inputPaths  = new Set(files.map((f) => f.path));
      const outputPaths = new Set(fixResult.files.map((f) => f.path));
      if (fixResult.files.length !== files.length || ![...inputPaths].every((p) => outputPaths.has(p))) {
        throw new Error(`LLM fix changed file set`);
      }

      const fixedMap = new Map(fixResult.files.map((f) => [f.path, f.content]));
      result = files.map((f) => ({ ...f, content: cleanOutput(fixedMap.get(f.path) ?? f.content) }));

      // v17.0: Hard validation after LLM fix
      result = applyHardValidationGate(result.filter((f) => !isCssFile(f.path)), metrics, "POST-LLM-FIX");

    } catch (llmError) {
      metrics.stopTimer("fixTime");
      pipelineErr(`[PIPELINE][S3][STEP-6] LLM fix error: ${String(llmError)}`);
      throw new Error(`LLM fix stage failed: ${String(llmError)}`);
    }
  }

  // Step 7: Syntax check post-fix → targeted regen
  const postFixSyntaxErrors = checkSyntax(result);
  if (postFixSyntaxErrors.length > 0) {
    const brokenFiles: RegenerableFile[] = postFixSyntaxErrors
      .map((e) => {
        const file   = result.find((f) => f.path === e.path) ?? { path: e.path, content: "" };
        const issues = validateSingleFile(file);
        const category = classifyErrorCategory(issues.filter((i) => i.severity === "error"));
        return { file, reason: classifyFailure(file, issues), category };
      })
      .filter(({ category }) => category === "regen-required")
      .map(({ file, reason }) => ({ file, reason }));

    if (brokenFiles.length > 0) {
      pipelineErr(`[PIPELINE][S3][STEP-7] ${brokenFiles.length} regen-required error(s) — targeted regen`);
      metrics.increment("errorCount", brokenFiles.length);
      result = await regenerateBrokenFiles(result, brokenFiles, spec, metrics, prompt, onPing);
      result = applyHardValidationGate(result.filter((f) => !isCssFile(f.path)), metrics, "POST-REGEN");
    } else {
      pipelineLog(`[PIPELINE][S3][STEP-7] ${postFixSyntaxErrors.length} auto-fixable syntax error(s) — auto-fix only`);
      const { fixed: finalFixed } = runIntelligentAutoFix(result, metrics);
      result = finalFixed;
      result = applyHardValidationGate(result, metrics, "POST-FINAL-AUTOFIX");
    }

    const finalSyntaxErrors = checkSyntax(result);
    if (finalSyntaxErrors.length > 0) {
      finalSyntaxErrors.forEach((e) => pipelineLog(`  [POST-REGEN-SYNTAX] ${e.path}: ${e.message}`));
      result = result.map((f) => isFileRejected(f) ? replaceWithSafeComponent(f) : f);
    }
  }

  // Step 8: Final hardening + hard validation
  result = hardenOutput(result.filter((f) => !isCssFile(f.path)));
  result = applyHardValidationGate(result, metrics, "FINAL-HARDEN");

  // v17.0: Final guarantee — every file is valid or safe-replaced, never collapse project
  result = result.map((f) => isFileRejected(f) ? replaceWithSafeComponent(f) : f);

  // v17.0: Enforce critical file validity as absolute final step
  result = await enforceCriticalFileValidity(result, spec, metrics, prompt, onPing);

  pipelineLog(`[PIPELINE][S3] ✓ ${result.length} files ready`);
  return result;
}

async function runQualityGate(
  files:   StreamFile[],
  spec:    ProjectSpec,
  metrics: PipelineMetrics,
  prompt:  string,
  onPing?: () => void,
): Promise<StreamFile[]> {
  // Drop CSS before quality gate
  const nonCssFiles = files.filter((f) => !isCssFile(f.path));
  const report = checkGenerationQuality(nonCssFiles);
  pipelineLog(`[PIPELINE][QUALITY] ${report.totalFiles} files — ${report.invalidFiles} invalid (${(report.invalidRate * 100).toFixed(1)}%)`);
  for (const issue of report.issues) pipelineLog(`[PIPELINE][QUALITY] ${issue.path}: ${issue.type} — ${issue.message}`);

  // v17.0: Apply hard validation at quality gate entry
  let gatedFiles = applyHardValidationGate(nonCssFiles, metrics, "QUALITY-GATE");

  if (!report.passed) {
    metrics.increment("qualityGateFailures");
    metrics.increment("errorCount");
    pipelineLog(`[PIPELINE][QUALITY] Gate failed – auto-fixing and isolating bad files`);
    const { fixed: autoFixed } = runIntelligentAutoFix(gatedFiles, metrics);
    return applyHardValidationGate(autoFixed, metrics, "QUALITY-GATE-AUTOFIX");
  }

  pipelineLog(`[PIPELINE][QUALITY] ✓ Gate PASSED`);
  return gatedFiles;
}

async function buildFallbackProject(
  prompt:    string,
  spec:      ProjectSpec | null,
  safeEmit:  (f: StreamFile) => Promise<void>,
): Promise<void> {
  pipelineErr(`[PIPELINE] All retries exhausted — emitting fallback project`);
  const fallbackApp = makeFallbackComponent({
    path:        "src/App.jsx",
    description: spec?.description ?? prompt,
    dependencies: [],
    is3D:        false,
    isAnimation: false,
  });
  await safeEmit({ path: "src/App.jsx", content: fallbackApp, provisional: false, lastFixed: true });
}

// ═══════════════════════════════════════════════════════════════════════════════
// REGION 17 — EMITTER (v17.0: HARD VALIDATION AT EVERY EMIT POINT)
// ═══════════════════════════════════════════════════════════════════════════════

async function handlePipelineFailure(
  stage:     string,
  error:     unknown,
  prompt:    string,
  safeEmit:  (f: StreamFile) => Promise<void>,
  safeError: (msg: string) => void,
  safeDone:  () => void,
  metrics:   PipelineMetrics,
  onMetric?: (name: string, value: number) => void,
): Promise<void> {
  const message = (error as Error)?.message ?? "Unknown pipeline error";
  metrics.increment("errorCount");
  pipelineErr(`[PIPELINE][${stage}] FAILURE: ${message}`);
  console.error(`[PIPELINE][${stage}] Stack:`, (error as Error)?.stack);
  try { await safeEmit({ path: "src/App.jsx", content: cleanOutput(makeSpinnerApp(prompt).replace("Generating interface", "Generation failed — retrying")), provisional: false }); } catch {}
  metrics.flush(onMetric);
  safeError(`[${stage}] ${message}`);
  safeDone();
}

// ═══════════════════════════════════════════════════════════════════════════════
// REGION 18 — MAIN EXPORT: PIPELINE v17.0 (HARD VALIDATION + FILE‑LEVEL ISOLATION)
// ═══════════════════════════════════════════════════════════════════════════════

export async function streamProjectPipeline(
  prompt:    string,
  callbacks: PipelineCallbacks,
): Promise<void> {
  const { onFile, onDone, onError, onLog, onMetric, onPing } = callbacks;

  _logFn = (msg: string) => { console.log(msg); onLog?.(msg); };

  _regenAttempts.clear();

  const metrics = new PipelineMetrics();
  metrics.startTimer("totalTime");

  const emittedContent = new Map<string, string>();

  // v17.0: All emit paths go through safeEmitWithValidation — final hard gate
  const safeEmit = async (f: StreamFile) => {
    // Hard block CSS before safeEmitWithValidation
    if (isCssFile(f.path)) {
      pipelineLog(`[PIPELINE][EMIT] CSS file dropped at safeEmit: ${f.path}`);
      return;
    }
    await safeEmitWithValidation(f, onFile, metrics);
  };
  const safeDone  = () => { try { onDone();        } catch {} };
  const safeError = (msg: string) => { try { onError?.(msg); } catch {} };

  const smartEmit = async (f: StreamFile) => {
    // Hard block CSS
    if (isCssFile(f.path)) return;
    const prev = emittedContent.get(f.path);
    if (prev === f.content) return;
    emittedContent.set(f.path, f.content);
    await safeEmitWithValidation(f, onFile, metrics);
  };

  pipelineLog("🚀 ════════════════════════════════════════════════════════════════");
  pipelineLog(`🚀 PIPELINE v17.0 — Hard Validation · File‑Level Isolation · CSS-Free · Never Collapse`);
  pipelineLog(`🚀 Prompt: "${prompt.slice(0, 80)}"`);
  pipelineLog("🚀 ════════════════════════════════════════════════════════════════");

  // S0: Boilerplate
  try {
    pipelineLog("[PIPELINE][S0] Emitting boilerplate...");
    for (const f of makeBoilerplate(prompt)) await smartEmit(f);
    pipelineLog("[PIPELINE][S0] ✓ Done");
  } catch (e) {
    await handlePipelineFailure("S0", e, prompt, safeEmit, safeError, safeDone, metrics, onMetric);
    return;
  }

  // S1: Planner
  let spec: ProjectSpec | null = null;
  try {
    pipelineLog("[PIPELINE][S1] Planning...");
    metrics.startTimer("planTime");
    spec = await planProject(prompt, onPing);
    metrics.stopTimer("planTime");

    if (!spec || spec.files.length === 0) {
      pipelineLog("[PIPELINE][S1] Planning returned empty spec — emitting fallback");
      await buildFallbackProject(prompt, null, safeEmit);
      metrics.flush(onMetric); safeDone(); return;
    }
    pipelineLog(`[PIPELINE][S1] ✓ ${spec.files.length} files planned`);
  } catch (e) {
    await handlePipelineFailure("S1", e, prompt, safeEmit, safeError, safeDone, metrics, onMetric);
    return;
  }

  // S1.5: Spec Validator
  try {
    pipelineLog("[PIPELINE][S1.5] Validating ProjectSpec...");
    const sv = validateProjectSpec(spec);
    if (!sv.valid) {
      pipelineLog(`[PIPELINE][S1.5] Spec issues: ${sv.errors.join(" | ")} — continuing`);
    }
    spec.files = prioritizeFiles(spec.files);
    pipelineLog(`[PIPELINE][S1.5] ✓ Spec processed`);
  } catch (e) {
    pipelineLog(`[PIPELINE][S1.5] Spec validation error: ${String(e)} — continuing`);
  }

  // S2 + S3: Generation → Validation → Fix → Emit
  let pipelineAttempt = 0;
  let finalFiles: StreamFile[] | null = null;

  while (pipelineAttempt <= MAX_PIPELINE_RETRIES) {
    pipelineAttempt++;
    pipelineLog(`[PIPELINE][ATTEMPT] ${pipelineAttempt}/${MAX_PIPELINE_RETRIES + 1}`);
    metrics.increment("pipelineRetries", pipelineAttempt > 1 ? 1 : 0);

    // S2: Generate
    let generated: StreamFile[];
    try {
      // Filter out CSS specs — never generate CSS files
      const dataSpecs  = spec.files.filter((f) => /^src\/(data|utils)\//.test(f.path) && !isCssFile(f.path));
      const hookSpecs  = spec.files.filter((f) => f.path.startsWith("src/hooks/") && !isCssFile(f.path));
      const compSpecs  = spec.files.filter((f) => !/^src\/(data|utils|hooks)\//.test(f.path) && f.path !== "src/App.jsx" && !isCssFile(f.path));

      pipelineLog(`[PIPELINE][S2] data:${dataSpecs.length} hooks:${hookSpecs.length} components:${compSpecs.length}`);
      metrics.startTimer("generationTime");

      const acc: StreamFile[] = [];

      for (const group of [dataSpecs, hookSpecs, compSpecs]) {
        if (group.length === 0) continue;
        const { files: gf, consecutiveFails } = await generateFilesInBatches(group, spec, acc, metrics, prompt, smartEmit, onPing);
        acc.push(...gf);
        if (consecutiveFails >= CONSECUTIVE_FAIL_LIMIT) {
          pipelineErr(`[PIPELINE][S2] Fast-fail triggered`);
          metrics.increment("fallbackUsageCount"); break;
        }
      }

      const appContent = buildAppJsx(spec, acc);
      acc.push({ path: "src/App.jsx", content: appContent });
      await smartEmit({ path: "src/App.jsx", content: appContent, provisional: true });

      metrics.stopTimer("generationTime");
      pipelineLog(`[PIPELINE][S2] ✓ ${acc.length} files generated`);

      // v17.0: Apply hard validation immediately after generation — drop CSS and isolate bad files
      generated = applyHardValidationGate(acc.filter((f) => !isCssFile(f.path)), metrics, "POST-GENERATION");

    } catch (e) {
      pipelineErr(`[PIPELINE][S2] Generation error on attempt ${pipelineAttempt}: ${String(e)}`);
      if (pipelineAttempt > MAX_PIPELINE_RETRIES) {
        await buildFallbackProject(prompt, spec, safeEmit);
        metrics.flush(onMetric); safeDone(); return;
      }
      await sleepWithPing(backoffMs(pipelineAttempt), onPing);
      continue;
    }

    // Corruption filter
    if (hasCriticalCorruption(generated)) {
      metrics.increment("corruptionBlocked");
      pipelineErr(`[PIPELINE][CORRUPTION-FILTER] Critical corruption detected on attempt ${pipelineAttempt}`);
      if (pipelineAttempt > MAX_PIPELINE_RETRIES) {
        pipelineErr(`[PIPELINE][CORRUPTION-FILTER] All retries exhausted — emitting fallback`);
        await buildFallbackProject(prompt, spec, safeEmit);
        metrics.flush(onMetric); safeDone(); return;
      }
      pipelineLog(`[PIPELINE][CORRUPTION-FILTER] Retrying pipeline (attempt ${pipelineAttempt + 1})`);
      await sleepWithPing(backoffMs(pipelineAttempt), onPing);
      continue;
    }

    // Quality gate (non-blocking, just auto-fix + hard validation)
    let qualityPassed: StreamFile[];
    try {
      qualityPassed = await runQualityGate(generated, spec, metrics, prompt, onPing);
    } catch (qe) {
      pipelineErr(`[PIPELINE][QUALITY] Gate threw on attempt ${pipelineAttempt}: ${String(qe)}`);
      qualityPassed = applyHardValidationGate(generated.filter((f) => !isCssFile(f.path)), metrics, "QUALITY-GATE-FALLBACK");
    }

    // S3: Fix pipeline
    try {
      pipelineLog(`[PIPELINE][S3] Fix pipeline — ${qualityPassed.length} files`);
      buildComponentRegistry(qualityPassed);

      const fixed = await runFixPipeline(qualityPassed, spec, metrics, prompt, onPing);

      // Final pre-emit corruption check
      if (hasCriticalCorruption(fixed)) {
        throw new Error(`Critical corruption survived fix pipeline on attempt ${pipelineAttempt}`);
      }

      // v17.0: Final hard validation pass + file-level safe-replace (never collapse project)
      const hardValidated = applyHardValidationGate(fixed.filter((f) => !isCssFile(f.path)), metrics, "PRE-EMIT");
      const emittableFiles = hardValidated.map((f) => isFileRejected(f) ? replaceWithSafeComponent(f) : f);

      const replacedCount = emittableFiles.filter((f, i) => f.content !== fixed[i]?.content).length;
      if (replacedCount > 0) {
        pipelineLog(`[PIPELINE][EMITTER] Replaced ${replacedCount} invalid file(s) with safe fallback`);
        metrics.increment("filesReplacedWithSafe", replacedCount);
      }

      // v17.0: Emit final files — each file goes through safeEmitWithValidation
      let updatedCount = 0;
      for (const f of emittableFiles) {
        if (BOILERPLATE_PATHS.has(f.path)) continue;
        // Final CSS guard
        if (isCssFile(f.path)) continue;
        const prev = emittedContent.get(f.path);
        if (prev !== f.content) {
          emittedContent.set(f.path, f.content);
          await safeEmitWithValidation(
            { path: f.path, content: f.content, provisional: false, lastFixed: true },
            onFile,
            metrics,
          );
          updatedCount++;
          logStage("S3", "emit", `Updated ${f.path}`);
        }
      }
      if (updatedCount === 0) pipelineLog("[PIPELINE][S3] ✓ No changes needed");

      finalFiles = emittableFiles;
      break; // Success

    } catch (e) {
      pipelineErr(`[PIPELINE][S3] Fix/emit error on attempt ${pipelineAttempt}: ${String(e)}`);
      if (pipelineAttempt > MAX_PIPELINE_RETRIES) {
        pipelineErr(`[PIPELINE][S3] All retries exhausted — emitting fallback`);
        await buildFallbackProject(prompt, spec, safeEmit);
        metrics.flush(onMetric); safeDone(); return;
      }
      pipelineLog(`[PIPELINE] Retrying full generation+fix (attempt ${pipelineAttempt + 1})`);
      await sleepWithPing(backoffMs(pipelineAttempt), onPing);
    }
  }

  metrics.stopTimer("totalTime");
  metrics.increment("totalFiles", (finalFiles?.length ?? 0) + makeBoilerplate("").length);

  const totalTime             = metrics.get("totalTime").toFixed(1);
  const totalFiles            = metrics.get("totalFiles");
  const autoFixResolved       = metrics.get("autoFixResolvedCount");
  const regenSkipped          = metrics.get("regenSkipped");
  const pipelineRetries       = metrics.get("pipelineRetries");
  const corruptBlocked        = metrics.get("corruptionBlocked");
  const filesReplaced         = metrics.get("filesReplacedWithSafe");
  const forbiddenBlocked      = metrics.get("forbiddenImportsBlocked");
  const hardValidateBlocked   = metrics.get("hardValidationBlocked");
  const criticalForceRegen    = metrics.get("criticalFilesForceRegenerated");

  pipelineLog("✅ ════════════════════════════════════════════════════════════════");
  pipelineLog(`✅ PIPELINE v17.0 DONE — ${totalFiles} files in ${totalTime}s`);
  pipelineLog(`✅ err=${metrics.get("errorCount")} retry=${metrics.get("retryCount")} regen=${metrics.get("regenCount")} regenSkipped=${regenSkipped} fallback=${metrics.get("fallbackUsageCount")} qFail=${metrics.get("qualityGateFailures")} autoFix=${autoFixResolved} imports=${metrics.get("autoFixImports")} jsx=${metrics.get("autoFixJsx")} hooks=${metrics.get("autoFixHooks")} pipelineRetries=${pipelineRetries} corruptBlocked=${corruptBlocked} safeReplaced=${filesReplaced} forbiddenBlocked=${forbiddenBlocked} hardValidateBlocked=${hardValidateBlocked} criticalForceRegen=${criticalForceRegen}`);
  pipelineLog("✅ ════════════════════════════════════════════════════════════════");

  metrics.flush(onMetric);
  safeDone();
}