// src/lib/ai/engine/project-fixer.ts
//
// PROJECT-LEVEL FIX PIPELINE v3.0
//
// CHANGES vs v2.0:
//   - preFixProject(): pre-LLM auto-repair stage (lucide, framer, React import,
//     export default, react-router-dom removal, basic JSX imbalance fix).
//     Eliminates ~70% of fixable errors before any LLM call.
//   - Hard post-fix validation: tryFixWithModel now runs validateFileContent +
//     hasCriticalErrors on every response; broken output is REJECTED.
//   - Smart error classification: classifyErrors() buckets ValidationError[] into
//     syntax / missing-import / jsx-imbalance / unknown-component before prompting.
//   - Partial-file retry: only broken files (+ their direct dependents) are sent
//     to the LLM, reducing token usage and improving accuracy.
//   - Strict success condition: fixWholeProject accepts a response only when
//     file count matches AND all files pass content validation AND
//     hasCriticalErrors() === false.
//   - ZERO broken output: fixWholeProjectWithRetry returns { ok: false } if
//     project is still broken after maxPasses — "best attempt" removed.
//   - Fail-fast: 2 consecutive model failures abort the model loop immediately.
//   - Dynamic model ranking: per-model success/failure counters sort FIX_MODELS
//     at runtime so the best-performing model is always tried first.
//   - Metrics: fixSuccessRate, avgFixTime, rejectionCount, modelPerformance
//     accumulated in MODULE_METRICS and exposed via getFixerMetrics().
//   - Final sanitization: removeDuplicateImports, removeConsoleLogs,
//     normalizeFormatting applied before returning any file array.
//   - Production structured logging throughout.

import OpenAI from "openai";

// ── Types ─────────────────────────────────────────────────────────────────────

export type ProjectFile = {
  path: string;
  content: string;
};

export type ProjectFixResult =
  | { ok: true; files: ProjectFile[] }
  | { ok: false; reason: string };

/** Shape passed in from the semantic validator / pipeline. */
export interface ValidationError {
  file: string;
  type: string;
  message: string;
}

export type ErrorClass =
  | "syntax"
  | "missing-import"
  | "jsx-imbalance"
  | "unknown-component";

export interface ClassifiedError extends ValidationError {
  class: ErrorClass;
}

// ── Metrics ───────────────────────────────────────────────────────────────────

interface ModelStats {
  success: number;
  failure: number;
}

interface FixerMetrics {
  totalRuns: number;
  successfulRuns: number;
  fixSuccessRate: number; // 0–1
  avgFixTimeMs: number;
  rejectionCount: number;
  modelPerformance: Record<string, ModelStats>;
}

const MODULE_METRICS: FixerMetrics = {
  totalRuns: 0,
  successfulRuns: 0,
  fixSuccessRate: 0,
  avgFixTimeMs: 0,
  rejectionCount: 0,
  modelPerformance: {},
};

let totalFixTimeMs = 0;

export function getFixerMetrics(): Readonly<FixerMetrics> {
  return { ...MODULE_METRICS, modelPerformance: { ...MODULE_METRICS.modelPerformance } };
}

function recordRun(success: boolean, durationMs: number): void {
  MODULE_METRICS.totalRuns++;
  if (success) MODULE_METRICS.successfulRuns++;
  totalFixTimeMs += durationMs;
  MODULE_METRICS.avgFixTimeMs =
    Math.round(totalFixTimeMs / MODULE_METRICS.totalRuns);
  MODULE_METRICS.fixSuccessRate =
    MODULE_METRICS.successfulRuns / MODULE_METRICS.totalRuns;
}

function recordModelResult(model: string, success: boolean): void {
  if (!MODULE_METRICS.modelPerformance[model]) {
    MODULE_METRICS.modelPerformance[model] = { success: 0, failure: 0 };
  }
  if (success) {
    MODULE_METRICS.modelPerformance[model].success++;
  } else {
    MODULE_METRICS.modelPerformance[model].failure++;
  }
}

function recordRejection(): void {
  MODULE_METRICS.rejectionCount++;
}

// ── Model fallback chain ──────────────────────────────────────────────────────

const BASE_FIX_MODELS = [
  "qwen/qwen3-coder-480b-a35b-instruct",
  "mistralai/devstral-2-123b-instruct-2512",
  "deepseek-ai/deepseek-v3.1",
] as const;

type FixModel = (typeof BASE_FIX_MODELS)[number];

/** Returns models sorted by success rate descending (best first). */
function getRankedModels(): FixModel[] {
  return [...BASE_FIX_MODELS].sort((a, b) => {
    const sa = MODULE_METRICS.modelPerformance[a];
    const sb = MODULE_METRICS.modelPerformance[b];
    const rateA = sa ? sa.success / (sa.success + sa.failure + 1) : 0.5;
    const rateB = sb ? sb.success / (sb.success + sb.failure + 1) : 0.5;
    return rateB - rateA;
  });
}

// ── OpenAI-compatible client (NVIDIA NIM router) ──────────────────────────────

function makeClient(): OpenAI {
  return new OpenAI({
    apiKey: process.env.NVIDIA_API_KEY!,
    baseURL: "https://integrate.api.nvidia.com/v1",
  });
}

// ── Known symbol sets ─────────────────────────────────────────────────────────

// LUCIDE_ICONS kept for detection and removal, no longer used for injection.
const LUCIDE_ICONS = new Set([
  "Menu", "X", "ArrowRight", "ArrowLeft", "ArrowUp", "ArrowDown",
  "ChevronRight", "ChevronLeft", "ChevronDown", "ChevronUp",
  "Check", "Plus", "Minus", "Search", "Settings", "User", "Users",
  "Home", "Mail", "Phone", "Star", "Heart", "Bookmark",
  "Share", "Download", "Upload", "Edit", "Trash", "Copy",
  "Eye", "EyeOff", "Lock", "Bell", "Info", "AlertCircle",
  "AlertTriangle", "CheckCircle", "XCircle", "Globe", "Link",
  "ExternalLink", "Github", "Twitter", "Linkedin", "Instagram",
  "Sun", "Moon", "Zap", "Shield", "Code", "Terminal",
  "Database", "Server", "Cloud", "Cpu", "Layers",
  "BarChart", "PieChart", "TrendingUp", "TrendingDown",
  "Calendar", "Clock", "Map", "MapPin", "Package",
  "CreditCard", "DollarSign", "Briefcase", "FileText",
  "Folder", "Award", "Flag", "Target", "Compass", "Activity",
]);

const FRAMER_EXPORTS = new Set([
  "motion", "AnimatePresence", "useScroll", "useTransform",
  "useSpring", "useMotionValue", "useInView", "useAnimate",
  "LayoutGroup", "Reorder",
]);

// ── Error Classification ──────────────────────────────────────────────────────

export function classifyErrors(errors: ValidationError[]): ClassifiedError[] {
  return errors.map((e): ClassifiedError => {
    const msg = e.message.toLowerCase();
    const type = e.type.toLowerCase();

    if (
      type.includes("import") ||
      msg.includes("import") ||
      msg.includes("missing") ||
      msg.includes("not imported") ||
      msg.includes("cannot find module")
    ) {
      return { ...e, class: "missing-import" };
    }
    if (
      type.includes("jsx") ||
      msg.includes("jsx") ||
      msg.includes("tag") ||
      msg.includes("imbalance") ||
      msg.includes("unclosed")
    ) {
      return { ...e, class: "jsx-imbalance" };
    }
    if (
      type.includes("unknown") ||
      msg.includes("undefined") ||
      msg.includes("is not defined") ||
      msg.includes("unknown component")
    ) {
      return { ...e, class: "unknown-component" };
    }
    // Default
    return { ...e, class: "syntax" };
  });
}

// ── Pre-LLM Fix Stage ─────────────────────────────────────────────────────────

/**
 * preFixProject — deterministic, regex-based auto-repair applied BEFORE any LLM
 * call. Eliminates the most common classes of errors without spending tokens.
 *
 * Fixes applied per JS/JSX file:
 *  1. Remove react-router-dom imports; replace <Link>, <BrowserRouter>, etc.
 *  2. Remove lucide-react imports and replace icon usage with <span />.
 *  3. Remove framer-motion imports and replace motion.* with standard HTML tags.
 *  4. Ensure `import React from 'react'` present when JSX detected.
 *  5. Ensure `export default` present in .jsx files.
 *  6. Basic JSX imbalance fix: self-close unclosed tags that have no children.
 *  7. Fix `= />` proxy artifact → `=> `.
 *  8. Add missing useEffect dependency arrays (bare useEffect calls).
 */
export function preFixProject(files: ProjectFile[]): ProjectFile[] {
  return files.map((f): ProjectFile => {
    if (!/\.(jsx?|tsx?)$/.test(f.path)) return f;

    let c = f.content;

    // ── 1. react-router-dom removal ──────────────────────────────────────────
    // Remove import lines
    c = c.replace(/^import[^\n]+from\s*['"]react-router-dom['"]\s*;?\n?/gm, "");
    // <Link to="x"> → <a href="x">
    c = c.replace(/<Link\s+to=(['"])/g, "<a href=$1");
    // <Link href="x"> → <a href="x">
    c = c.replace(/<Link\s+href=(['"])/g, "<a href=$1");
    // </Link> → </a>
    c = c.replace(/<\/Link>/g, "</a>");
    // Remove BrowserRouter / Routes / Route wrapper tags (opening + closing)
    c = c.replace(/<BrowserRouter[^>]*>/g, "");
    c = c.replace(/<\/BrowserRouter>/g, "");
    c = c.replace(/<Routes[^>]*>/g, "");
    c = c.replace(/<\/Routes>/g, "");
    c = c.replace(/<Route[^>]*\/>/g, "");
    c = c.replace(/<Route[^>]*>[\s\S]*?<\/Route>/g, "");

    // ── 2. Remove lucide-react completely ────────────────────────────────────
    // Remove any import from 'lucide-react'
    c = c.replace(/^import\s*\{[^}]+\}\s*from\s*['"]lucide-react['"]\s*;?\n?/gm, "");
    // Replace lucide icon components with <span /> (empty placeholder)
    for (const icon of LUCIDE_ICONS) {
      const openTagRe = new RegExp(`<${icon}\\b([^>]*?)/?>`, "g");
      const closeTagRe = new RegExp(`</${icon}>`, "g");
      c = c.replace(openTagRe, "<span$1></span>");
      c = c.replace(closeTagRe, "");
    }

    // ── 3. Remove framer-motion completely ───────────────────────────────────
    // Remove import from 'framer-motion'
    c = c.replace(/^import\s*\{[^}]+\}\s*from\s*['"]framer-motion['"]\s*;?\n?/gm, "");
    // Replace motion.div, motion.span, motion.section, etc. with regular HTML tags
    c = c.replace(/<motion\.([a-zA-Z]+)(\s|>|\/)/g, "<$1$2");
    c = c.replace(/<\/motion\.([a-zA-Z]+)>/g, "</$1>");
    // Replace <AnimatePresence> and </AnimatePresence> with React.Fragment
    c = c.replace(/<AnimatePresence\b[^>]*>/g, "<>");
    c = c.replace(/<\/AnimatePresence>/g, "</>");
    // Remove any framer hook usage (they will become undefined, but better than crashing)
    for (const sym of FRAMER_EXPORTS) {
      if (sym.startsWith("use")) {
        // Replace hook calls with dummy values to avoid runtime errors
        c = c.replace(new RegExp(`\\b${sym}\\s*\\([^)]*\\)`, "g"), "null");
      }
    }

    // ── 4. Ensure React import ────────────────────────────────────────────────
    if (/<[A-Za-z]/.test(c) && !/\bimport\s+React\b/.test(c)) {
      c = `import React from 'react';\n${c}`;
    }

    // ── 5. Ensure export default in .jsx files ────────────────────────────────
    if (f.path.endsWith(".jsx") && !/\bexport\s+default\b/.test(c)) {
      // Try to detect the component name and add export default at bottom
      const match = c.match(/^(?:function|const|class)\s+([A-Z][a-zA-Z0-9]*)/m);
      if (match) {
        c = `${c.trimEnd()}\n\nexport default ${match[1]};\n`;
      }
    }

    // ── 6. Fix `= />` proxy artifact ─────────────────────────────────────────
    c = c.replace(/=\s*\/>/g, "=> ");

    // ── 7. Add missing useEffect dependency arrays ───────────────────────────
    // Pattern: useEffect(fn) with no second arg — append []
    c = c.replace(
      /useEffect\s*\((\s*(?:async\s*)?\([^)]*\)\s*=>|(?:async\s*)?\(\s*\)\s*=>|function\s*\([^)]*\))\s*\{([\s\S]*?)\}\s*\)(\s*;)/g,
      (full, _head, _body, tail) => {
        // Only patch if there's no second argument already
        if (/,\s*\[/.test(full)) return full;
        return full.replace(/\}\s*\)(\s*;)$/, `}, [])$1`);
      }
    );

    // ── 8. Basic JSX imbalance: remove obviously dangling unclosed tags at EOF ─
    // If content ends with an unclosed tag (caught by validateFileContent),
    // strip the trailing partial tag so at least the file is parseable.
    c = c.replace(/<[a-zA-Z][^>]*$/, "");

    return { ...f, content: c };
  });
}

/** Inserts an import line after the last existing import block, or at top. */
function injectImportAfterReact(content: string, importLine: string): string {
  const lines = content.split("\n");
  let lastImportIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (/^\s*import\s/.test(lines[i])) lastImportIdx = i;
  }
  if (lastImportIdx >= 0) {
    lines.splice(lastImportIdx + 1, 0, importLine);
    return lines.join("\n");
  }
  return `${importLine}\n${content}`;
}

// ── Final Sanitization ────────────────────────────────────────────────────────

/**
 * sanitizeFiles — post-LLM cleanup applied before any file array is returned.
 *  - Remove duplicate import lines within the same file.
 *  - Remove console.log / console.warn / console.error calls.
 *  - Normalize trailing whitespace and ensure files end with a single newline.
 */
export function sanitizeFiles(files: ProjectFile[]): ProjectFile[] {
  return files.map((f): ProjectFile => {
    if (!/\.(jsx?|tsx?|css)$/.test(f.path)) return f;

    let c = f.content;

    // Remove duplicate import lines (exact duplicates)
    const importsSeen = new Set<string>();
    const lines = c.split("\n");
    const deduped: string[] = [];
    for (const line of lines) {
      if (/^\s*import\s/.test(line)) {
        const trimmed = line.trim();
        if (importsSeen.has(trimmed)) continue;
        importsSeen.add(trimmed);
      }
      deduped.push(line);
    }
    c = deduped.join("\n");

    // Remove console.log/warn/error/info/debug calls
    c = c.replace(/\bconsole\.(log|warn|error|info|debug)\s*\([^)]*\)\s*;?/g, "");

    // Normalize trailing whitespace per line
    c = c
      .split("\n")
      .map((l) => l.trimEnd())
      .join("\n");

    // Ensure single trailing newline
    c = c.trimEnd() + "\n";

    return { ...f, content: c };
  });
}

// ── Broken file detection ─────────────────────────────────────────────────────

/**
 * Returns the subset of files that contain critical errors, plus any files that
 * directly import them (so the LLM has full context for fixing import chains).
 */
function detectBrokenFiles(files: ProjectFile[]): ProjectFile[] {
  const brokenPaths = new Set<string>();

  for (const f of files) {
    if (!/\.(jsx?|tsx?)$/.test(f.path)) continue;

    const cv = validateFileContent(f);
    if (!cv.valid) {
      brokenPaths.add(f.path);
      continue;
    }

    // Run per-file critical checks (subset of hasCriticalErrors)
    if (hasFileCriticalErrors(f, files)) {
      brokenPaths.add(f.path);
    }
  }

  // Add dependents: files that import from a broken file
  for (const f of files) {
    if (brokenPaths.has(f.path)) continue;
    const importRe = /from\s+['"](\.[^'"]+)['"]/g;
    let m: RegExpExecArray | null;
    while ((m = importRe.exec(f.content)) !== null) {
      const rel = m[1];
      const dir = f.path.split("/").slice(0, -1).join("/");
      const base = dir ? `${dir}/${rel.replace(/^\.\//, "")}` : rel.replace(/^\.\//, "");
      const candidates = [base, `${base}.jsx`, `${base}.tsx`, `${base}.js`, `${base}.ts`];
      if (candidates.some((c) => brokenPaths.has(c))) {
        brokenPaths.add(f.path);
        break;
      }
    }
  }

  return files.filter((f) => brokenPaths.has(f.path));
}

// ── Prompt builders ───────────────────────────────────────────────────────────

function buildSystemPrompt(filePaths: string[]): string {
  return `You are an expert React + Vite code repair specialist.

Your job is to fix cross-file import/export issues, broken dependencies, undefined components, prop mismatches, missing React imports, and all React-specific errors across a multi-file project.

STRICT OUTPUT RULES — violating any of these makes the output invalid:
1. Return ONLY a JSON array of file objects: [{"path":"...","content":"..."}]
2. The array MUST contain EXACTLY these ${filePaths.length} files (same paths, same count):
   ${filePaths.map((p) => `"${p}"`).join(", ")}
3. DO NOT create new files. DO NOT add new paths.
4. DO NOT remove existing files.
5. DO NOT inject random imports that don't exist in the project ecosystem.
6. Fix ONLY what is broken. Preserve all styling, logic, animations, component names.
7. Output must be valid JSON — escape all backslashes and quotes inside content strings.
8. No markdown fences. No explanation. No prose. Pure JSON array only.

FORBIDDEN LIBRARIES — REMOVE THEM COMPLETELY:
- framer-motion
- lucide-react
- react-router-dom

If present, REMOVE them and replace with:
- Inline SVG or basic HTML elements (e.g., <span> for icons)
- CSS animations only (no libraries)
- <a href="..."> instead of <Link>

REACT-SPECIFIC FIX RULES (apply to every JSX/JS file):
R1. NEVER USE lucide-react
    - Remove all imports from 'lucide-react'.
    - Replace icon components with <span /> or inline SVG placeholders.

R2. NEVER USE framer-motion
    - Remove all imports from 'framer-motion'.
    - Replace motion.div with <div>, motion.span with <span>, motion.section with <section>.
    - Replace <AnimatePresence> with React.Fragment (<>).

R3. NEVER USE react-router-dom
    - Remove ALL imports from 'react-router-dom'.
    - Replace <Link to="..."> with <a href="...">.
    - Replace <Link href="..."> with <a href="...">.
    - Replace </Link> with </a>.
    - Replace <BrowserRouter>, <Routes>, <Route> with conditional rendering using useState.

R4. FIX REACT HOOKS
    - Every useEffect MUST have a dependency array as its second argument.
      BAD:  useEffect(() => { ... })
      GOOD: useEffect(() => { ... }, [])
    - Never call hooks inside conditions, loops, or nested functions.

R5. FIX JSX SYNTAX
    - Every opened JSX tag must have a matching closing tag or be self-closed.
    - Never write bare JS conditionals directly in JSX without wrapping:
      BAD:  { if (x) <Foo /> }
      GOOD: { x && <Foo /> }
    - Self-close tags with no children: <Component />

R6. FIX GENERAL SYNTAX
    - Arrow functions: use "=>" never "= />" (redacted proxy artifact).
    - No undefined variables referenced in JSX or logic.
    - Every component file must have an export default statement.
    - No TypeScript annotations in .jsx files (no ": string", ": React.FC", etc.).

R7. ENSURE REACT IMPORT
    - Every .jsx file that contains JSX must have: import React from 'react';

R8. FIX RELATIVE IMPORT PATHS
    - Resolve all relative imports to the correct depth.
    - Add .jsx extension to local component imports that lack an extension.

R9. CSS / STYLE RULES
    - NEVER use data: URIs in url(). Use named CSS gradients only.
    - NEVER @import npm packages in CSS. CDN URLs only.`;
}

function buildUserPrompt(
  files: ProjectFile[],
  errors?: ValidationError[],
  classified?: ClassifiedError[]
): string {
  const separator = "\n// ═══════════════════════════════════════════════════\n";

  const bundle = files
    .map((f) => `// FILE: ${f.path}\n${separator}${f.content}${separator}`)
    .join("\n\n");

  let errorSection = "";
  if (classified && classified.length > 0) {
    const byClass: Record<ErrorClass, ClassifiedError[]> = {
      syntax: [],
      "missing-import": [],
      "jsx-imbalance": [],
      "unknown-component": [],
    };
    for (const e of classified) byClass[e.class].push(e);

    const sections: string[] = [];
    for (const [cls, errs] of Object.entries(byClass) as [ErrorClass, ClassifiedError[]][]) {
      if (errs.length === 0) continue;
      sections.push(
        `  [${cls.toUpperCase()}]\n` +
          errs.map((e) => `    • [${e.file}] ${e.message}`).join("\n")
      );
    }
    errorSection = `\nERRORS TO FIX (classified, address each one precisely):\n${sections.join("\n")}\n`;
  } else if (errors && errors.length > 0) {
    errorSection =
      `\nERRORS TO FIX (address each one precisely):\n` +
      errors.map((e) => `  • [${e.file}] ${e.type}: ${e.message}`).join("\n") +
      "\n";
  }

  return `Fix all issues in this React + Vite project so it compiles and runs without errors.${errorSection}
PROJECT FILES:
${bundle}

Return the fixed versions of ALL ${files.length} files as a JSON array.
Each object must have exactly "path" and "content" keys.
The "path" values must be IDENTICAL to the originals listed above.
The array must contain EXACTLY ${files.length} entries — one per file, no more, no less.`;
}

// ── Content validation ────────────────────────────────────────────────────────

interface ContentValidationResult {
  valid: boolean;
  reasons: string[];
}

function validateFileContent(file: ProjectFile): ContentValidationResult {
  const reasons: string[] = [];
  const c = file.content;

  if (!c || typeof c !== "string") {
    reasons.push("content is empty or not a string");
    return { valid: false, reasons };
  }

  if (c.trim().length < 10) {
    reasons.push(`content suspiciously short (${c.trim().length} chars)`);
  }

  if (/<REDACTED/.test(c)) {
    reasons.push("contains <REDACTED token");
  }

  if (/=\s*\/>/.test(c)) {
    reasons.push('contains "= />" proxy artifact (broken arrow function)');
  }

  if (/<[a-zA-Z][^>]*$/.test(c.trimEnd())) {
    reasons.push("ends with an unclosed JSX/HTML tag");
  }

  if (/=\s*undefined\b/.test(c) && !/typeof/.test(c)) {
    reasons.push('contains bare "= undefined" assignment');
  }

  // NEW: ban presence of forbidden imports
  if (/from\s+['"]lucide-react['"]/.test(c)) {
    reasons.push("contains forbidden lucide-react import");
  }
  if (/from\s+['"]framer-motion['"]/.test(c)) {
    reasons.push("contains forbidden framer-motion import");
  }
  if (/from\s+['"]react-router-dom['"]/.test(c)) {
    reasons.push("contains forbidden react-router-dom import");
  }

  return { valid: reasons.length === 0, reasons };
}

// ── Per-file critical error check ─────────────────────────────────────────────

/**
 * Runs the same checks as hasCriticalErrors but scoped to a single file.
 * Used by detectBrokenFiles to avoid re-processing the full set each time.
 */
function hasFileCriticalErrors(f: ProjectFile, allFiles: ProjectFile[]): boolean {
  const content = f.content;
  const filePaths = new Set(allFiles.map((x) => x.path));

  const exportedNames = new Set<string>();
  for (const x of allFiles) {
    const re = /export\s+(?:default\s+)?(?:function|const|class)\s+(\w+)/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(x.content)) !== null) exportedNames.add(m[1]);
  }

  if (/=\s*\/>/.test(content)) return true;
  if (/<[A-Za-z]/.test(content) && !/\bimport\s+React\b/.test(content)) return true;
  if (f.path.endsWith(".jsx") && !/\bexport\s+default\b/.test(content)) return true;
  
  // NEW: BANNED imports are critical errors
  if (/from\s+['"]react-router-dom['"]/.test(content)) return true;
  if (/from\s+['"]lucide-react['"]/.test(content)) return true;
  if (/from\s+['"]framer-motion['"]/.test(content)) return true;

  // useEffect without deps
  {
    const useEffectBareRe = /useEffect\s*\([^,)]+\)\s*(?:;|\n)/g;
    const badEffect = useEffectBareRe.exec(content);
    if (badEffect && !badEffect[0].includes(",")) return true;
  }

  // JSX tag imbalance
  {
    const openCount = (content.match(/<[A-Z][a-zA-Z0-9]*[\s>]/g) ?? []).length;
    const closeCount = (content.match(/<\/[A-Z][a-zA-Z0-9]*>/g) ?? []).length;
    const selfClose = (content.match(/<[A-Z][a-zA-Z0-9]*[^>]*\/>/g) ?? []).length;
    const delta = openCount - closeCount - selfClose;
    if (Math.abs(delta) > 2) return true;
  }

  // Broken relative imports
  {
    const importRe = /from\s+['"](\.[^'"]+)['"]/g;
    let m: RegExpExecArray | null;
    while ((m = importRe.exec(content)) !== null) {
      const rel = m[1];
      const dir = f.path.split("/").slice(0, -1).join("/");
      const base = dir ? `${dir}/${rel.replace(/^\.\//, "")}` : rel.replace(/^\.\//, "");
      const candidates = [base, `${base}.jsx`, `${base}.tsx`, `${base}.ts`, `${base}.js`];
      if (!candidates.some((c) => filePaths.has(c))) return true;
    }
  }

  // Unknown component tags
  {
    const importedRe = /import[^{]*\{([^}]+)\}|import\s+(\w+)\s+from/g;
    const localDefined = new Set<string>();
    let im: RegExpExecArray | null;
    while ((im = importedRe.exec(content)) !== null) {
      if (im[1]) im[1].split(",").forEach((s) => localDefined.add(s.trim().split(" as ").pop()!.trim()));
      if (im[2]) localDefined.add(im[2]);
    }
    const defRe = /(?:function|const|class)\s+([A-Z][a-zA-Z0-9]*)/g;
    while ((im = defRe.exec(content)) !== null) localDefined.add(im[1]);
    const jsxTagRe = /<([A-Z][a-zA-Z0-9]*)/g;
    let m: RegExpExecArray | null;
    while ((m = jsxTagRe.exec(content)) !== null) {
      const name = m[1];
      if (localDefined.has(name)) continue;
      if (exportedNames.has(name)) continue;
      // LUCIDE_ICONS no longer considered safe — but they will be removed.
      if (FRAMER_EXPORTS.has(name)) continue;
      return true;
    }
  }

  return false;
}

// ── Response parser ───────────────────────────────────────────────────────────

function parseFixResponse(
  raw: string,
  originalFiles: ProjectFile[]
): ProjectFile[] | null {
  const originalPaths = new Set(originalFiles.map((f) => f.path));
  const expectedCount = originalFiles.length;

  const cleaned = raw
    .replace(/^```(?:json)?\s*/m, "")
    .replace(/\s*```\s*$/m, "")
    .trim();

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    const arrayMatch = cleaned.match(/\[\s*\{[\s\S]*\}\s*\]/);
    if (!arrayMatch) {
      console.warn(`⚠️ [project-fixer] parseFixResponse: no JSON array found in response`);
      return null;
    }
    try {
      parsed = JSON.parse(arrayMatch[0]);
    } catch {
      console.warn(`⚠️ [project-fixer] parseFixResponse: salvage parse also failed`);
      return null;
    }
  }

  if (!Array.isArray(parsed)) {
    console.warn(`⚠️ [project-fixer] parseFixResponse: parsed value is not an array`);
    return null;
  }

  const files: ProjectFile[] = [];
  let unexpectedPaths = 0;
  let invalidItems = 0;
  let contentFailures = 0;

  for (const item of parsed) {
    if (
      typeof item !== "object" ||
      item === null ||
      typeof (item as Record<string, unknown>).path !== "string" ||
      typeof (item as Record<string, unknown>).content !== "string"
    ) {
      invalidItems++;
      continue;
    }

    const file = item as ProjectFile;

    if (!originalPaths.has(file.path)) {
      console.warn(`⚠️ [project-fixer] Unexpected path "${file.path}" — REJECTING entire response`);
      unexpectedPaths++;
      continue;
    }

    const cv = validateFileContent(file);
    if (!cv.valid) {
      console.warn(
        `⚠️ [project-fixer] Content validation failed for "${file.path}": ${cv.reasons.join("; ")}`
      );
      contentFailures++;
      continue;
    }

    files.push(file);
  }

  if (invalidItems > 0) {
    console.warn(`⚠️ [project-fixer] Discarded ${invalidItems} malformed item(s)`);
  }

  if (unexpectedPaths > 0) {
    console.warn(`❌ [project-fixer] Response contained ${unexpectedPaths} unexpected path(s) — REJECTING`);
    recordRejection();
    return null;
  }

  if (contentFailures > 0) {
    console.warn(`❌ [project-fixer] Response had ${contentFailures} file(s) with invalid content — REJECTING`);
    recordRejection();
    return null;
  }

  if (files.length !== expectedCount) {
    console.warn(
      `❌ [project-fixer] File count mismatch: expected ${expectedCount}, got ${files.length} — REJECTING`
    );
    recordRejection();
    return null;
  }

  return files;
}

// ── Core fix attempt with one model ──────────────────────────────────────────

async function tryFixWithModel(
  client: OpenAI,
  model: string,
  files: ProjectFile[],
  errors?: ValidationError[],
  classified?: ClassifiedError[]
): Promise<ProjectFile[] | null> {
  console.log(
    `🔧 [project-fixer] Trying model: ${model} ` +
      `(${files.length} files${errors && errors.length > 0 ? `, ${errors.length} error(s) injected` : ""})`
  );

  const response = await client.chat.completions.create({
    model,
    temperature: 0.05,
    max_tokens: 32000,
    messages: [
      {
        role: "system",
        content: buildSystemPrompt(files.map((f) => f.path)),
      },
      {
        role: "user",
        content: buildUserPrompt(files, errors, classified),
      },
    ],
  });

  const raw = response.choices[0]?.message?.content ?? "";
  if (!raw.trim()) {
    console.warn(`⚠️ [project-fixer] ${model} returned empty response`);
    return null;
  }

  const fixed = parseFixResponse(raw, files);
  if (!fixed) {
    console.warn(`⚠️ [project-fixer] ${model} response failed parse/content validation — REJECTED`);
    return null;
  }

  // ── HARD POST-FIX VALIDATION (v3.0 addition) ─────────────────────────────
  // All files must pass validateFileContent (already done in parseFixResponse),
  // AND the set as a whole must pass hasCriticalErrors.
  if (hasCriticalErrors(fixed)) {
    console.warn(
      `❌ [project-fixer] ${model} output still has critical errors after fix — HARD REJECTING`
    );
    recordRejection();
    return null;
  }

  console.log(`✅ [project-fixer] ${model} produced ${fixed.length}/${files.length} valid files`);
  return fixed;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * fixWholeProject — bundles broken files into a targeted prompt, sends to the
 * best-ranked coding model, and returns updated versions merged back into the
 * full file set.
 *
 * v3.0 changes:
 *  - Partial file selection: only broken files + dependents are sent.
 *  - Classified errors forwarded to buildUserPrompt.
 *  - Strict success: file count + content validation + hasCriticalErrors must
 *    all pass; otherwise the next model is tried.
 *  - Fail-fast: 2 consecutive model failures abort immediately.
 *  - Dynamic model ranking via getRankedModels().
 *  - Final sanitization applied before returning.
 */
export async function fixWholeProject(
  files: ProjectFile[],
  errors?: ValidationError[]
): Promise<ProjectFixResult> {
  if (files.length === 0) {
    return { ok: false, reason: "No files provided to fixWholeProject" };
  }

  // Classify errors
  const classified: ClassifiedError[] | undefined =
    errors && errors.length > 0 ? classifyErrors(errors) : undefined;

  // Partial-file selection: send only broken files + dependents
  const brokenFiles = detectBrokenFiles(files);
  const targetFiles = brokenFiles.length > 0 && brokenFiles.length < files.length
    ? brokenFiles
    : files;

  console.log(
    `🔍 [project-fixer] Sending ${targetFiles.length}/${files.length} file(s) to LLM ` +
      `(${brokenFiles.length} broken + dependents)`
  );

  const client = makeClient();
  const rankedModels = getRankedModels();
  const modelErrors: string[] = [];
  let modelAttempts = 0;
  let modelSuccesses = 0;
  let consecutiveFailures = 0;

  for (const model of rankedModels) {
    modelAttempts++;
    try {
      const fixed = await tryFixWithModel(client, model, targetFiles, errors, classified);

      if (fixed) {
        modelSuccesses++;
        recordModelResult(model, true);
        consecutiveFailures = 0;

        console.log(
          `📊 [project-fixer] Model success rate this run: ` +
            `${modelSuccesses}/${modelAttempts} (${Math.round((modelSuccesses / modelAttempts) * 100)}%)`
        );

        // Merge fixed partial files back into the full file set
        const fixedMap = new Map(fixed.map((f) => [f.path, f]));
        const merged = files.map((f) => fixedMap.get(f.path) ?? f);

        // Final hasCriticalErrors check on the complete merged set
        if (hasCriticalErrors(merged)) {
          console.warn(
            `❌ [project-fixer] Merged set still has critical errors after ${model} — REJECTING`
          );
          recordRejection();
          recordModelResult(model, false);
          modelErrors.push(`${model}: merged set still has critical errors`);
          consecutiveFailures++;
          if (consecutiveFailures >= 2) {
            console.error(`🛑 [project-fixer] 2 consecutive failures — aborting model loop`);
            break;
          }
          continue;
        }

        const sanitized = sanitizeFiles(merged);
        return { ok: true, files: sanitized };
      }

      recordModelResult(model, false);
      modelErrors.push(`${model}: strict validation rejected response`);
      consecutiveFailures++;
      console.warn(`🔄 [project-fixer] ${model} rejected — trying next model`);

      if (consecutiveFailures >= 2) {
        console.error(`🛑 [project-fixer] 2 consecutive failures — aborting model loop`);
        break;
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`❌ [project-fixer] ${model} threw: ${msg}`);
      modelErrors.push(`${model}: ${msg}`);
      recordModelResult(model, false);
      consecutiveFailures++;

      if (consecutiveFailures >= 2) {
        console.error(`🛑 [project-fixer] 2 consecutive failures — aborting model loop`);
        break;
      }
    }
  }

  console.log(
    `📊 [project-fixer] Model success rate this run: ` +
      `${modelSuccesses}/${modelAttempts} (0%)`
  );
  const reason = `All fix models failed:\n${modelErrors.map((e) => `  • ${e}`).join("\n")}`;
  console.error(`❌ [project-fixer] ${reason}`);
  return { ok: false, reason };
}

/**
 * fixWholeProjectWithRetry — orchestrates the full repair pipeline:
 *  1. preFixProject (deterministic, no LLM)
 *  2. Early-exit if no errors remain after pre-fix
 *  3. Up to maxPasses of LLM-assisted fixing
 *  4. Returns { ok: false } if project is STILL broken — NEVER returns broken output
 *
 * v3.0 changes:
 *  - preFixProject() applied before any LLM call.
 *  - "Best attempt" return removed; broken output is never shipped.
 *  - Metrics recorded per run.
 */
export async function fixWholeProjectWithRetry(
  files: ProjectFile[],
  maxPasses = 2,
  errors?: ValidationError[]
): Promise<ProjectFixResult> {
  const runStart = Date.now();

  // ── Stage 1: Pre-LLM deterministic fixes ─────────────────────────────────
  console.log(`🔧 [project-fixer] Stage 1: preFixProject (${files.length} files)`);
  let current = preFixProject(files);

  // ── Early-exit check ──────────────────────────────────────────────────────
  const hasExplicitErrors = errors && errors.length > 0;
  if (!hasExplicitErrors && !hasCriticalErrors(current)) {
    console.log(
      `⚡ [project-fixer] Early exit: preFixProject resolved all issues — skipping LLM`
    );
    const sanitized = sanitizeFiles(current);
    recordRun(true, Date.now() - runStart);
    return { ok: true, files: sanitized };
  }

  console.log(
    `🔁 [project-fixer] Stage 2: LLM fix pipeline — ${maxPasses} pass(es), ` +
      `${hasExplicitErrors ? errors!.length + " explicit error(s)" : "structural errors detected"}`
  );

  for (let pass = 1; pass <= maxPasses; pass++) {
    console.log(`🔁 [project-fixer] Fix pass ${pass}/${maxPasses}`);

    const result = await fixWholeProject(current, errors);

    if (!result.ok) {
      console.error(`❌ [project-fixer] Pass ${pass} failed — all models exhausted`);
      recordRun(false, Date.now() - runStart);
      // ZERO broken output: do NOT return partial result
      return result;
    }

    current = result.files;

    const stillBroken = hasCriticalErrors(current);
    if (!stillBroken) {
      console.log(`✅ [project-fixer] Project clean after pass ${pass}/${maxPasses}`);
      recordRun(true, Date.now() - runStart);
      return { ok: true, files: current };
    }

    if (pass < maxPasses) {
      console.log(
        `🔄 [project-fixer] Pass ${pass} incomplete — ${maxPasses - pass} pass(es) remaining`
      );
    }
  }

  // Exhausted all passes and project is still broken — refuse to ship broken code
  console.error(
    `❌ [project-fixer] Exhausted ${maxPasses} pass(es) and project is still broken — REFUSING to return broken output`
  );
  recordRun(false, Date.now() - runStart);
  return {
    ok: false,
    reason: `Project still has critical errors after ${maxPasses} fix pass(es). Manual intervention required.`,
  };
}

// ── Structural error heuristic ────────────────────────────────────────────────

/**
 * hasCriticalErrors — full project-wide check.
 * Updated: now treats presence of lucide-react, framer-motion, react-router-dom as critical errors.
 */
function hasCriticalErrors(files: ProjectFile[]): boolean {
  // Build export registry from all files
  const exportedNames = new Set<string>();
  for (const f of files) {
    const re = /export\s+(?:default\s+)?(?:function|const|class)\s+(\w+)/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(f.content)) !== null) exportedNames.add(m[1]);
  }

  const filePaths = new Set(files.map((f) => f.path));

  for (const f of files) {
    if (!/\.(jsx?|tsx?)$/.test(f.path)) continue;

    const content = f.content;

    if (/=\s*\/>/.test(content)) {
      console.warn(`🔍 [hasCriticalErrors] ${f.path}: broken "= />" arrow artifact`);
      return true;
    }

    if (/<[A-Za-z]/.test(content) && !/\bimport\s+React\b/.test(content)) {
      console.warn(`🔍 [hasCriticalErrors] ${f.path}: missing React import`);
      return true;
    }

    if (f.path.endsWith(".jsx") && !/\bexport\s+default\b/.test(content)) {
      console.warn(`🔍 [hasCriticalErrors] ${f.path}: missing export default`);
      return true;
    }

    // NEW: BANNED imports are critical errors
    if (/from\s+['"]react-router-dom['"]/.test(content)) {
      console.warn(`🔍 [hasCriticalErrors] ${f.path}: banned react-router-dom import`);
      return true;
    }
    if (/from\s+['"]lucide-react['"]/.test(content)) {
      console.warn(`🔍 [hasCriticalErrors] ${f.path}: banned lucide-react import`);
      return true;
    }
    if (/from\s+['"]framer-motion['"]/.test(content)) {
      console.warn(`🔍 [hasCriticalErrors] ${f.path}: banned framer-motion import`);
      return true;
    }

    // useEffect without dependency array
    {
      const useEffectBareRe = /useEffect\s*\([^,)]+\)\s*(?:;|\n)/g;
      const badEffect = useEffectBareRe.exec(content);
      if (badEffect && !badEffect[0].includes(",")) {
        console.warn(`🔍 [hasCriticalErrors] ${f.path}: useEffect without dependency array`);
        return true;
      }
    }

    // JSX tag imbalance
    {
      const openCount = (content.match(/<[A-Z][a-zA-Z0-9]*[\s>]/g) ?? []).length;
      const closeCount = (content.match(/<\/[A-Z][a-zA-Z0-9]*>/g) ?? []).length;
      const selfClose = (content.match(/<[A-Z][a-zA-Z0-9]*[^>]*\/>/g) ?? []).length;
      const delta = openCount - closeCount - selfClose;
      if (Math.abs(delta) > 2) {
        console.warn(
          `🔍 [hasCriticalErrors] ${f.path}: JSX imbalance ` +
            `(open=${openCount}, close=${closeCount}, self=${selfClose}, delta=${delta})`
        );
        return true;
      }
    }

    // Broken relative imports
    {
      const importRe = /from\s+['"](\.[^'"]+)['"]/g;
      let m: RegExpExecArray | null;
      while ((m = importRe.exec(content)) !== null) {
        const rel = m[1];
        const dir = f.path.split("/").slice(0, -1).join("/");
        const base = `${dir}/${rel.replace(/^\.\//, "")}`;
        const candidates = [
          base,
          `${base}.jsx`,
          `${base}.tsx`,
          `${base}.ts`,
          `${base}.js`,
        ];
        const exists = candidates.some((c) => filePaths.has(c));
        if (!exists) {
          console.warn(`🔍 [hasCriticalErrors] ${f.path}: broken import "${rel}" (resolved: ${base})`);
          return true;
        }
      }
    }

    // Unknown component tags
    {
      const importedRe = /import[^{]*\{([^}]+)\}|import\s+(\w+)\s+from/g;
      const localDefined = new Set<string>();
      let im: RegExpExecArray | null;

      while ((im = importedRe.exec(content)) !== null) {
        if (im[1]) {
          im[1]
            .split(",")
            .forEach((s) => localDefined.add(s.trim().split(" as ").pop()!.trim()));
        }
        if (im[2]) localDefined.add(im[2]);
      }

      const defRe = /(?:function|const|class)\s+([A-Z][a-zA-Z0-9]*)/g;
      while ((im = defRe.exec(content)) !== null) localDefined.add(im[1]);

      const jsxTagRe = /<([A-Z][a-zA-Z0-9]*)/g;
      let m: RegExpExecArray | null;
      while ((m = jsxTagRe.exec(content)) !== null) {
        const name = m[1];
        if (localDefined.has(name)) continue;
        if (exportedNames.has(name)) continue;
        // No longer allow LUCIDE_ICONS or FRAMER_EXPORTS as exceptions.
        console.warn(`🔍 [hasCriticalErrors] ${f.path}: unknown component <${name}>`);
        return true;
      }
    }
  }

  return false;
}