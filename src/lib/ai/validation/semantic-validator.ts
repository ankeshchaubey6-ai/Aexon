// src/lib/ai/validation/semantic-validator.ts
//
// VALIDATION LAYER v9.3 — NON‑BLOCKING ANALYZER
// ✔ Reports issues  ✔ Never throws  ✔ File‑level isolation
// ✔ Pipeline handles failures  ✔ Deterministic
//
// CHANGES vs v9.2:
//   - assertNoFatalErrors & verifyBuildSafe return structured results instead of throwing
//   - ERROR_LEVEL_MAP downgraded: only missing-export-default, multiple-export-default,
//     empty-jsx-return, and empty files remain "critical"; everything else → "warning"
//   - canProceed always true (except catastrophic corruption)
//   - Removed global error threshold (no throwing on >20 errors)
//   - markFileUnrecoverable called only for empty content, multiple export default,
//     or broken token patterns (no longer for undefined components)
//   - isFileRejected logic remains strict for corruption but does not reject on minor issues
//   - Validator never throws — only analyzes and reports

import type { StreamFile } from "@/lib/ai/types/stream.types";

// =============================================================================
// STRICT MODE (kept for analysis behaviour)
// =============================================================================

const STRICT_MODE = true;

// =============================================================================
// TYPES
// =============================================================================

export type ErrorLevel = "critical" | "fatal" | "warning";

export interface ValidationError {
  file: string;
  type:
    | "missing-import"
    | "missing-react-import"
    | "missing-export-default"
    | "multiple-export-default"
    | "missing-jsx-return"
    | "invalid-import-path"
    | "circular-dependency"
    | "undefined-component"
    | "unregistered-component"
    | "duplicate-import"
    | "unused-import"
    | "css-import-removed"
    | "concatenated-file-split"
    | "unclosed-tag"
    | "orphaned-closing-tag"
    | "duplicate-closing-tag"
    | "invalid-nesting"
    | "self-closing-mismatch"
    | "empty-jsx-return"
    | "malformed-jsx-attribute"
    | "hook-error"
    | "invalid-jsx-logic"
    | "missing-motion-import"
    | "missing-framer-import"
    | "wrong-import-source";
  message: string;
  component?: string;
  suggestedLib?: "lucide-react" | "framer-motion" | "react" | null;
  suggestedFix?: string;
  line?: number;
  level: ErrorLevel;
  /** @deprecated — use level */
  severity: "fatal" | "warning";
  autoFixed?: boolean;
}

export interface ValidationResult {
  files: StreamFile[];
  errors: ValidationError[];
  hasFatalErrors: boolean;
  hasCriticalErrors: boolean;
  isClean: boolean;
  canProceed: boolean;
  autoFixesApplied: number;
  summary: {
    total: number;
    critical: number;
    fatal: number;
    warnings: number;
  };
  validationTimeMs: number;
  filesRejectedCount: number;
}

// =============================================================================
// PARSED IMPORT REPRESENTATION
// =============================================================================

interface ParsedImport {
  raw: string;
  source: string;
  defaultImport: string | null;
  namespaceImport: string | null;
  namedImports: Array<{ name: string; alias: string | null }>;
  isSideEffect: boolean;
}

// =============================================================================
// ERROR LEVEL MAP — v9.3 DOWNGRADED
// =============================================================================

const ERROR_LEVEL_MAP: Record<ValidationError["type"], ErrorLevel> = {
  // Only these remain critical
  "missing-export-default":   "critical",
  "multiple-export-default":  "critical",
  "empty-jsx-return":         "critical",

  // Everything else → warning (pipeline handles them)
  "invalid-import-path":      "warning",
  "circular-dependency":      "warning",
  "missing-import":           "warning",
  "missing-react-import":     "warning",
  "missing-jsx-return":       "warning",
  "undefined-component":      "warning",
  "unregistered-component":   "warning",
  "duplicate-import":         "warning",
  "unclosed-tag":             "warning",
  "orphaned-closing-tag":     "warning",
  "duplicate-closing-tag":    "warning",
  "invalid-nesting":          "warning",
  "self-closing-mismatch":    "warning",
  "malformed-jsx-attribute":  "warning",
  "hook-error":               "warning",
  "invalid-jsx-logic":        "warning",
  "missing-motion-import":    "warning",
  "missing-framer-import":    "warning",
  "concatenated-file-split":  "warning",
  "wrong-import-source":      "warning",
  "unused-import":            "warning",
  "css-import-removed":       "warning",
};

function levelForType(type: ValidationError["type"]): ErrorLevel {
  return ERROR_LEVEL_MAP[type] ?? "warning";
}

function makeError(
  file: string,
  type: ValidationError["type"],
  message: string,
  extra: Partial<
    Omit<ValidationError, "file" | "type" | "message" | "level" | "severity">
  > = {}
): ValidationError {
  const level = levelForType(type);
  return {
    file,
    type,
    message,
    level,
    severity: level === "warning" ? "warning" : "fatal",
    ...extra,
  };
}

// =============================================================================
// CONSTANTS
// =============================================================================

const HTML_TAGS = new Set([
  "a","abbr","address","area","article","aside","audio",
  "b","base","bdi","bdo","blockquote","body","br","button",
  "canvas","caption","cite","code","col","colgroup",
  "data","datalist","dd","del","details","dfn","dialog",
  "div","dl","dt","em","embed",
  "fieldset","figcaption","figure","footer","form",
  "h1","h2","h3","h4","h5","h6","head","header","hgroup","hr","html",
  "i","iframe","img","input","ins","kbd",
  "label","legend","li","link",
  "main","map","mark","menu","meta","meter",
  "nav","noscript",
  "object","ol","optgroup","option","output",
  "p","picture","pre","progress","q",
  "rp","rt","ruby",
  "s","samp","script","search","section","select","small",
  "source","span","strong","style","sub","summary","sup",
  "table","tbody","td","template","textarea","tfoot",
  "th","thead","time","title","tr","track",
  "u","ul","var","video","wbr",
  "svg","path","circle","rect","line","polyline","polygon",
  "text","tspan","g","defs","use","symbol","clipPath","mask",
  "linearGradient","radialGradient","stop","ellipse","marker","pattern",
  "feBlend","feColorMatrix","feComposite","feFlood","feGaussianBlur",
  "feImage","feMerge","feMergeNode","feOffset","feTile","feTurbulence","filter",
]);

const VOID_HTML_TAGS = new Set([
  "area","base","br","col","embed","hr","img","input",
  "link","meta","param","source","track","wbr",
]);

const INVALID_NESTING_RULES: Array<{ child: string; invalidParents: string[] }> = [
  { child: "li",       invalidParents: ["li"] },
  { child: "tr",       invalidParents: ["tr", "table"] },
  { child: "td",       invalidParents: ["td", "tr"] },
  { child: "th",       invalidParents: ["th", "tr"] },
  { child: "p",        invalidParents: ["p"] },
  { child: "h1",       invalidParents: ["p","h1","h2","h3","h4","h5","h6"] },
  { child: "h2",       invalidParents: ["p","h1","h2","h3","h4","h5","h6"] },
  { child: "h3",       invalidParents: ["p","h1","h2","h3","h4","h5","h6"] },
  { child: "h4",       invalidParents: ["p","h1","h2","h3","h4","h5","h6"] },
  { child: "h5",       invalidParents: ["p","h1","h2","h3","h4","h5","h6"] },
  { child: "h6",       invalidParents: ["p","h1","h2","h3","h4","h5","h6"] },
  { child: "button",   invalidParents: ["button"] },
  { child: "a",        invalidParents: ["a"] },
  { child: "form",     invalidParents: ["form"] },
];

const ALWAYS_AVAILABLE = new Set([
  "React","Fragment","StrictMode","Suspense","ErrorBoundary",
]);

const LUCIDE_ICONS = new Set([
  "Menu","X","ChevronDown","ChevronUp","ChevronLeft","ChevronRight",
  "ChevronsLeft","ChevronsRight","Search","Bell","User","Users",
  "Settings","Home","ArrowRight","ArrowLeft","ArrowUp","ArrowDown",
  "ArrowUpRight","ArrowDownLeft","Check","CheckCircle","Plus","Minus",
  "Trash","Trash2","Edit","Edit2","Edit3","Eye","EyeOff","Star","Heart",
  "Share","Download","Upload","Link","Link2","ExternalLink",
  "Mail","Phone","Globe","Github","Twitter","Facebook",
  "Instagram","Linkedin","Youtube","Zap","Shield","Lock",
  "Unlock","Key","Database","Server","Cloud","Code","Terminal",
  "Cpu","Layers","Layout","Grid","List","BarChart","BarChart2",
  "PieChart","TrendingUp","TrendingDown","Activity","Calendar",
  "Clock","Map","MapPin","Navigation","Compass","Camera","Image",
  "Video","Mic","Volume","Volume2","VolumeX","Music","Play",
  "Pause","Square","SkipBack","SkipForward","Repeat","Shuffle",
  "Filter","SortAsc","SortDesc","RefreshCw","RotateCw","RotateCcw",
  "AlertCircle","AlertTriangle","Info","HelpCircle","XCircle",
  "Loader","Loader2","Send","MessageCircle","MessageSquare",
  "FileText","File","Folder","FolderOpen","Archive","Paperclip",
  "Clipboard","Copy","Scissors","Maximize","Minimize","Maximize2","Minimize2",
  "LogIn","LogOut","UserPlus","UserMinus","Package","Tag",
  "Bookmark","Flag","Award","Gift","Coffee","Smile","Frown",
  "Meh","Moon","Sun","Sparkles","Rocket","Target","Lightbulb",
  "Briefcase","Building","Building2","DollarSign","CreditCard",
  "ShoppingCart","ShoppingBag","Truck","Headphones","Smartphone",
  "Monitor","Tablet","Keyboard","Mouse","Wifi","Bluetooth",
  "Battery","BatteryCharging","Power","Hash","AtSign","Percent",
  "Circle","Triangle","Hexagon","MoreHorizontal","MoreVertical",
  "Slash","Dot","GripVertical","GripHorizontal",
  "SlidersHorizontal","SlidersVertical","Columns","Rows","Move",
  "LayoutDashboard","LayoutGrid","LayoutList","Table","Kanban",
  "PanelLeft","PanelRight","SidebarOpen","SidebarClose",
]);

const COMPONENT_TO_LIBRARY: Record<
  string,
  "lucide-react" | "framer-motion" | "react"
> = {
  AnimatePresence:  "framer-motion",
  useMotionValue:   "framer-motion",
  useTransform:     "framer-motion",
  useSpring:        "framer-motion",
  useScroll:        "framer-motion",
  useInView:        "framer-motion",
  useAnimate:       "framer-motion",
  useDragControls:  "framer-motion",
  useReducedMotion: "framer-motion",
  useVelocity:      "framer-motion",
  LayoutGroup:      "framer-motion",
  Reorder:          "framer-motion",
  Suspense:         "react",
  StrictMode:       "react",
  Fragment:         "react",
};
for (const icon of LUCIDE_ICONS) {
  COMPONENT_TO_LIBRARY[icon] = "lucide-react";
}

// =============================================================================
// CACHES
// =============================================================================

interface FileAnalysis {
  importedNames:       Set<string>;
  importedFrom:        Map<string, string>;
  relativeImports:     Array<{ raw: string; resolved: string }>;
  usedComponents:      string[];
  hasJSX:              boolean;
  hasReactImport:      boolean;
  hasExportDefault:    boolean;
  hasJSXReturn:        boolean;
  usesMotion:          boolean;
  usesAnimatePresence: boolean;
  locallyDefined:      Set<string>;
  strippedContent:     string;
  importLines:         Array<{ line: string; source: string; names: string[] }>;
}

const _analysisCache   = new Map<string, FileAnalysis>();
const _depGraphCache   = new Map<string, Map<string, Set<string>>>();
const _registryCache   = new Map<string, Map<string, string>>();
const _strippedCache   = new Map<string, string>();
const _importLineCache = new Map<string, ParsedImport | null>();

// =============================================================================
// FILE REJECTION REGISTRY — v9.3: only catastrophic cases
// =============================================================================

const _rejectedFiles = new Set<string>();

function markFileUnrecoverable(file: StreamFile, _errors?: ValidationError[]): void {
  // Only mark for actual unrecoverable corruption — never for missing imports etc.
  _rejectedFiles.add(file.path);
}

/**
 * Returns true if a file should be excluded from the pipeline output.
 * Criteria: empty content, broken token sequences, multiple export default.
 * Does NOT reject for missing imports or undefined components.
 */
export function isFileRejected(file: StreamFile): boolean {
  // 1. Empty content
  if (!file.content || file.content.trim().length === 0) return true;

  const content = file.content;

  // 2. Broken tokens indicating corrupt/truncated AI output
  const BROKEN_TOKEN_PATTERNS = [
    /\);\s*=>/,
    /er-motion['"]/,
    /\)\s*=>\s*\{.*\);\s*=>/,
    /import\s*['"]\s*['"]/,
    /from\s*['"]\s*['"]/,
    /\}\s*\)\s*;\s*=>/,
  ];

  for (const pattern of BROKEN_TOKEN_PATTERNS) {
    if (pattern.test(content)) return true;
  }

  // 3. Multiple export default declarations (corruption)
  const stripped = stripCommentsAndStrings(content);
  const exportDefaultMatches = stripped.match(/\bexport\s+default\b/g);
  if (exportDefaultMatches && exportDefaultMatches.length > 1) return true;

  // 4. Explicitly marked (only set for catastrophic cases)
  if (_rejectedFiles.has(file.path)) return true;

  return false;
}

function fileCacheKey(files: StreamFile[]): string {
  return files.map((f) => `${f.path}:${f.content.length}`).join("|");
}

// =============================================================================
// UTILITY — strip comments & strings (memoized)
// =============================================================================

function stripCommentsAndStrings(content: string): string {
  const cached = _strippedCache.get(content);
  if (cached !== undefined) return cached;

  const result = content
    .replace(/\/\/[^\n]*/g, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/"(?:[^"\\]|\\.)*"/g, '""')
    .replace(/'(?:[^'\\]|\\.)*'/g, "''")
    .replace(/`(?:[^`\\]|\\.)*`/g, "``");

  _strippedCache.set(content, result);
  return result;
}

// =============================================================================
// UTILITY — path resolution
// =============================================================================

function resolveRelativePath(dir: string, relativePath: string): string {
  const base  = dir ? `${dir}/${relativePath}` : relativePath;
  const parts = base.split("/");
  const norm: string[] = [];
  for (const p of parts) {
    if (p === "..") norm.pop();
    else if (p !== ".") norm.push(p);
  }
  return norm.join("/");
}

function pathExistsInProject(base: string, allPaths: Set<string>): boolean {
  if (allPaths.has(base)) return true;
  for (const ext of [".jsx", ".tsx", ".ts", ".js"]) {
    if (allPaths.has(base + ext)) return true;
  }
  for (const ext of [".jsx", ".tsx", ".ts", ".js"]) {
    if (allPaths.has(base + "/index" + ext)) return true;
  }
  return false;
}

function findActualPath(base: string, allPaths: Set<string>): string | null {
  if (allPaths.has(base)) return base;
  for (const ext of [".jsx", ".tsx", ".ts", ".js"]) {
    if (allPaths.has(base + ext)) return base + ext;
    if (allPaths.has(base + "/index" + ext)) return base + "/index" + ext;
  }
  return null;
}

// =============================================================================
// UTILITY — import clause parsing
// =============================================================================

function extractNamesFromClause(clause: string): string[] {
  const names: string[] = [];
  const ns = clause.match(/^\*\s+as\s+(\w+)/);
  if (ns) return [ns[1]];

  const defaultPart = clause.replace(/\{[^}]*\}/g, "").trim();
  const namedPart   = clause.match(/\{([^}]*)\}/)?.[1] ?? "";

  if (defaultPart && defaultPart !== ",") {
    for (const p of defaultPart.split(",")) {
      const c = p.trim();
      if (c && c !== "type") names.push(c);
    }
  }
  if (namedPart) {
    for (const spec of namedPart.split(",")) {
      const parts = spec.trim().split(/\s+as\s+/);
      const local = (parts[1] ?? parts[0])?.trim();
      if (local && local !== "type") names.push(local);
    }
  }
  return names.filter(Boolean);
}

function parseImportLine(line: string): ParsedImport | null {
  const trimmed = line.trim();
  const cacheKey = trimmed;
  if (_importLineCache.has(cacheKey)) return _importLineCache.get(cacheKey) ?? null;

  let result: ParsedImport | null = null;
  try {
    const m = trimmed.match(/^import\s+([\s\S]+?)\s+from\s+["']([^"']+)["']\s*;?\s*$/);
    if (!m) {
      const se = trimmed.match(/^import\s+["']([^"']+)["']\s*;?\s*$/);
      if (se) {
        result = {
          raw: trimmed,
          source: se[1],
          defaultImport: null,
          namespaceImport: null,
          namedImports: [],
          isSideEffect: true,
        };
      }
    } else {
      const clause = m[1].trim();
      const source = m[2];
      const nsMatch = clause.match(/^\*\s+as\s+(\w+)$/);
      if (nsMatch) {
        result = {
          raw: trimmed,
          source,
          defaultImport: null,
          namespaceImport: nsMatch[1],
          namedImports: [],
          isSideEffect: false,
        };
      } else {
        let defaultImport: string | null = null;
        const namedImports: Array<{ name: string; alias: string | null }> = [];
        const namedBlockMatch = clause.match(/\{([^}]*)\}/);
        const namedBlock = namedBlockMatch ? namedBlockMatch[1] : null;
        const defaultPart = clause.replace(/\{[^}]*\}/, "").replace(/,/g, " ").trim();
        if (defaultPart && defaultPart !== "") {
          defaultImport = defaultPart || null;
        }
        if (namedBlock) {
          for (const spec of namedBlock.split(",")) {
            const s = spec.trim();
            if (!s) continue;
            if (s.startsWith("type ")) continue;
            const asParts = s.split(/\s+as\s+/);
            const name  = asParts[0]?.trim();
            const alias = asParts[1]?.trim() ?? null;
            if (name) {
              namedImports.push({ name, alias });
            }
          }
        }
        result = {
          raw: trimmed,
          source,
          defaultImport: defaultImport || null,
          namespaceImport: null,
          namedImports,
          isSideEffect: false,
        };
      }
    }
  } catch {
    result = null;
  }

  _importLineCache.set(cacheKey, result);
  return result;
}

function serializeImport(parsed: ParsedImport): string {
  const { source, defaultImport, namespaceImport, namedImports, isSideEffect } = parsed;
  if (isSideEffect || (!defaultImport && !namespaceImport && namedImports.length === 0)) {
    return `import "${source}";`;
  }
  if (namespaceImport) {
    const prefix = defaultImport ? `${defaultImport}, ` : "";
    return `import ${prefix}* as ${namespaceImport} from "${source}";`;
  }
  const parts: string[] = [];
  if (defaultImport) {
    parts.push(defaultImport);
  }
  if (namedImports.length > 0) {
    const specs = namedImports
      .map(({ name, alias }) => (alias ? `${name} as ${alias}` : name))
      .join(", ");
    parts.push(`{ ${specs} }`);
  }
  return `import ${parts.join(", ")} from "${source}";`;
}

// =============================================================================
// UTILITY — JSX component usage extraction
// =============================================================================

function extractComponentUsages(stripped: string): string[] {
  const seen = new Set<string>();
  const re   = /(?<![.\w])<([A-Z][a-zA-Z0-9]*)(?=[\s/>])/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(stripped)) !== null) {
    const name = m[1];
    if (ALWAYS_AVAILABLE.has(name)) continue;
    if (stripped[m.index - 1] === ".") continue;
    seen.add(name);
  }
  return Array.from(seen);
}

function detectLibraryForComponent(
  name: string
): "lucide-react" | "framer-motion" | "react" | null {
  if (name in COMPONENT_TO_LIBRARY) return COMPONENT_TO_LIBRARY[name];
  if (name.length > 4 && name.endsWith("Icon")) return "lucide-react";
  if (
    name.startsWith("use") &&
    (name.includes("Motion") || name.includes("Transform") ||
      name.includes("Spring") || name.includes("Scroll") ||
      name.includes("InView") || name.includes("Animate") ||
      name.includes("Drag") || name.includes("Velocity"))
  )
    return "framer-motion";
  return null;
}

// =============================================================================
// UTILITY — identifier usage check
// =============================================================================

function buildBodyForUsageCheck(fileContent: string): {
  jsBody: string;
  jsxTagNames: Set<string>;
} {
  const stripped = stripCommentsAndStrings(fileContent);
  const noImports = stripped
    .split("\n")
    .filter((l) => !l.trim().startsWith("import "))
    .join("\n");

  const jsxTagNames = new Set<string>();
  const tagRe = /(?<![.\w])<([A-Z][a-zA-Z0-9]*)(?=[\s/>])/g;
  let tm: RegExpExecArray | null;
  while ((tm = tagRe.exec(noImports)) !== null) {
    jsxTagNames.add(tm[1]);
  }
  const closeRe = /<\/([A-Z][a-zA-Z0-9]*)\s*>/g;
  while ((tm = closeRe.exec(noImports)) !== null) {
    jsxTagNames.add(tm[1]);
  }
  return { jsBody: noImports, jsxTagNames };
}

function isIdentifierUsed(
  identifier: string,
  jsBody: string,
  jsxTagNames: Set<string>
): boolean {
  if (identifier === "React") return true;
  const isPascal = /^[A-Z]/.test(identifier);
  if (isPascal && jsxTagNames.has(identifier)) return true;
  return new RegExp(`\\b${identifier}\\b`).test(jsBody);
}

// =============================================================================
// SINGLE-PASS FILE ANALYSIS (fallback-safe)
// =============================================================================

function analyzeFile(file: StreamFile, allPaths: Set<string>): FileAnalysis {
  const key    = `${file.path}::${file.content.length}`;
  const cached = _analysisCache.get(key);
  if (cached) return cached;

  const content  = file.content;
  const stripped = stripCommentsAndStrings(content);

  const importedNames = new Set<string>();
  const importedFrom  = new Map<string, string>();
  const relativeImports: Array<{ raw: string; resolved: string }> = [];
  const importLines: Array<{ line: string; source: string; names: string[] }> = [];

  const importRe = /^import\s+(.+?)\s+from\s+["']([^"']+)["']\s*;?/gm;
  let im: RegExpExecArray | null;
  while ((im = importRe.exec(content)) !== null) {
    const clause = im[1].trim();
    const source = im[2];
    const names  = extractNamesFromClause(clause);
    for (const n of names) {
      importedNames.add(n);
      importedFrom.set(n, source);
    }
    if (source.startsWith(".")) {
      const dir      = file.path.split("/").slice(0, -1).join("/");
      const resolved = resolveRelativePath(dir, source);
      relativeImports.push({ raw: source, resolved });
    }
    importLines.push({ line: im[0], source, names });
  }

  const hasReactImport =
    importedNames.has("React") || /import\s+React\b/.test(content);

  const locallyDefined = new Set<string>(importedNames);
  const localRe = /(?:function|const|class)\s+([A-Z][a-zA-Z0-9]*)/g;
  let lm: RegExpExecArray | null;
  while ((lm = localRe.exec(content)) !== null) locallyDefined.add(lm[1]);

  const hasJSX =
    /<[A-Za-z][^>]*>/.test(stripped) ||
    /<>/.test(stripped) ||
    /<\/>/.test(stripped);

  const hasExportDefault    = /export\s+default\s+/.test(content);
  const hasJSXReturn        = /return\s*\([\s\S]*?</.test(content) || /return\s+</.test(content);
  const usesMotion          = /\bmotion\.[a-zA-Z]/.test(stripped);
  const usesAnimatePresence = /\bAnimatePresence\b/.test(stripped);
  const usedComponents      = extractComponentUsages(stripped);

  const analysis: FileAnalysis = {
    importedNames, importedFrom, relativeImports, usedComponents,
    hasJSX, hasReactImport, hasExportDefault, hasJSXReturn,
    usesMotion, usesAnimatePresence, locallyDefined,
    strippedContent: stripped,
    importLines,
  };
  _analysisCache.set(key, analysis);
  return analysis;
}

// =============================================================================
// COMPONENT REGISTRY
// =============================================================================

function buildComponentRegistry(files: StreamFile[]): Map<string, string> {
  const ck     = fileCacheKey(files);
  const cached = _registryCache.get(ck);
  if (cached) return cached;

  const registry = new Map<string, string>();

  for (const file of files) {
    if (!file.path.endsWith(".jsx") && !file.path.endsWith(".tsx")) continue;
    const c = file.content;
    try {
      const dfRe = /export\s+default\s+(?:function|class)\s+([A-Z][a-zA-Z0-9]*)/g;
      let m: RegExpExecArray | null;
      while ((m = dfRe.exec(c)) !== null) registry.set(m[1], file.path);
      const diRe = /export\s+default\s+([A-Z][a-zA-Z0-9]*)\s*;/g;
      while ((m = diRe.exec(c)) !== null) registry.set(m[1], file.path);
      const neRe = /export\s+\{([^}]+)\}/g;
      while ((m = neRe.exec(c)) !== null) {
        for (const spec of m[1].split(",")) {
          const name = spec.trim().split(/\s+as\s+/)[0]?.trim();
          if (name && /^[A-Z]/.test(name)) registry.set(name, file.path);
        }
      }
      const loRe = /(?:const|function|class)\s+([A-Z][a-zA-Z0-9]*)/g;
      while ((m = loRe.exec(c)) !== null) {
        if (!registry.has(m[1])) registry.set(m[1], file.path);
      }
    } catch {
      // fail-safe
    }
  }

  _registryCache.set(ck, registry);
  return registry;
}

// =============================================================================
// DEPENDENCY GRAPH
// =============================================================================

function buildDependencyGraph(files: StreamFile[]): Map<string, Set<string>> {
  const ck     = fileCacheKey(files);
  const cached = _depGraphCache.get(ck);
  if (cached) return cached;

  const graph  = new Map<string, Set<string>>();
  const impRe  = /^import\s+.+?\s+from\s+["']([^"']+)["']\s*;?/gm;

  for (const file of files) {
    const deps = new Set<string>();
    try {
      let m: RegExpExecArray | null;
      while ((m = impRe.exec(file.content)) !== null) {
        const src = m[1];
        if (src.startsWith(".")) {
          const dir = file.path.split("/").slice(0, -1).join("/");
          deps.add(resolveRelativePath(dir, src));
        }
      }
    } catch {}
    graph.set(file.path, deps);
  }

  _depGraphCache.set(ck, graph);
  return graph;
}

function detectCircularDependencies(
  graph: Map<string, Set<string>>,
  allPaths: Set<string>
): Array<{ cycle: string[] }> {
  const cycles: Array<{ cycle: string[] }> = [];
  const visited     = new Set<string>();
  const inStack     = new Set<string>();
  const reported    = new Set<string>();

  function dfs(node: string, path: string[]): void {
    if (inStack.has(node)) {
      const start = path.indexOf(node);
      if (start !== -1) {
        const cycle = [...path.slice(start), node];
        const key   = [...cycle].sort().join("|");
        if (!reported.has(key)) { reported.add(key); cycles.push({ cycle }); }
      }
      return;
    }
    if (visited.has(node)) return;
    visited.add(node);
    inStack.add(node);
    for (const dep of graph.get(node) ?? []) {
      const resolved = findActualPath(dep, allPaths);
      if (resolved) dfs(resolved, [...path, node]);
    }
    inStack.delete(node);
  }

  for (const node of graph.keys()) dfs(node, []);
  return cycles;
}

// =============================================================================
// UTILITY — deep equality
// =============================================================================

function fileContentEqual(a: StreamFile, b: StreamFile): boolean {
  return a.path === b.path && a.content === b.content;
}

// =============================================================================
// UTILITY — import insertion point
// =============================================================================

function findImportInsertionPoint(lines: string[]): number {
  let lastImportIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    const t = lines[i].trim();
    if (t.startsWith("import ") || /^import\s+["']/.test(t)) {
      lastImportIdx = i;
    }
  }
  return lastImportIdx + 1;
}

// =============================================================================
// AUTO-FIX LAYER
// =============================================================================

export function autoFixCriticalIssues(
  files: StreamFile[]
): { files: StreamFile[]; fixCount: number } {
  let fixCount = 0;

  const fixed = files.map((file): StreamFile => {
    if (!file.path.endsWith(".jsx") && !file.path.endsWith(".tsx")) return file;

    try {
      const originalContent = file.content;
      let content = originalContent;
      let changed = false;

      // Remove duplicate imports
      {
        const lines       = content.split("\n");
        const seenLines   = new Set<string>();
        const seenNames   = new Set<string>();
        const out: string[] = [];

        for (const line of lines) {
          const t = line.trim();
          if (t.startsWith("import ")) {
            if (seenLines.has(t)) { changed = true; continue; }
            seenLines.add(t);
            const cm = t.match(/^import\s+(.+?)\s+from/);
            if (cm) {
              const names   = extractNamesFromClause(cm[1].trim());
              const hasDupe = names.some((n) => seenNames.has(n));
              if (hasDupe) { changed = true; continue; }
              for (const n of names) seenNames.add(n);
            }
          }
          out.push(line);
        }
        if (changed) content = out.join("\n");
      }

      const importedNames = new Set<string>();
      const importedFrom  = new Map<string, string>();
      {
        const re = /^import\s+(.+?)\s+from\s+["']([^"']+)["']\s*;?/gm;
        let m: RegExpExecArray | null;
        while ((m = re.exec(content)) !== null) {
          for (const n of extractNamesFromClause(m[1].trim())) {
            importedNames.add(n);
            importedFrom.set(n, m[2]);
          }
        }
      }

      const stripped = stripCommentsAndStrings(content);

      // Inject missing React import
      const usesReactNS    = /\bReact\./.test(content);
      const hasReactImport =
        importedNames.has("React") || /import\s+React\b/.test(content);

      if (usesReactNS && !hasReactImport) {
        content = `import React from "react";\n` + content;
        importedNames.add("React");
        changed = true;
        fixCount++;
      }

      // Inject missing lucide-react imports
      const usedComps    = extractComponentUsages(stripped);
      const missingIcons = usedComps.filter(
        (c) => LUCIDE_ICONS.has(c) && !importedNames.has(c)
      );

      if (missingIcons.length > 0) {
        const existingRe = /^import\s+\{([^}]+)\}\s+from\s+["']lucide-react["']\s*;?/m;
        const ex         = content.match(existingRe);
        if (ex) {
          const existing = ex[1].split(",").map((s) => s.trim()).filter(Boolean);
          const merged   = Array.from(new Set([...existing, ...missingIcons])).sort().join(", ");
          content = content.replace(existingRe, `import { ${merged} } from "lucide-react";`);
        } else {
          const lines  = content.split("\n");
          const insertAt = findImportInsertionPoint(lines);
          lines.splice(insertAt, 0, `import { ${missingIcons.sort().join(", ")} } from "lucide-react";`);
          content = lines.join("\n");
        }
        for (const n of missingIcons) importedNames.add(n);
        changed   = true;
        fixCount += missingIcons.length;
      }

      // Inject missing framer-motion imports
      const usesMotion = /\bmotion\.[a-zA-Z]/.test(stripped);
      const usesAP     = /\bAnimatePresence\b/.test(stripped);
      const hasMotion  = /import\s+\{[^}]*\bmotion\b[^}]*\}\s+from\s+["']framer-motion["']/.test(content);
      const hasAP      = importedNames.has("AnimatePresence");

      const framerNeeds: string[] = [];
      if (usesMotion && !hasMotion) framerNeeds.push("motion");
      if (usesAP && !hasAP)        framerNeeds.push("AnimatePresence");

      if (framerNeeds.length > 0) {
        const existingRe = /^import\s+\{([^}]+)\}\s+from\s+["']framer-motion["']\s*;?/m;
        const ex = content.match(existingRe);
        if (ex) {
          const existing = ex[1].split(",").map((s) => s.trim()).filter(Boolean);
          const merged   = Array.from(new Set([...existing, ...framerNeeds])).sort().join(", ");
          content = content.replace(existingRe, `import { ${merged} } from "framer-motion";`);
        } else {
          const lines    = content.split("\n");
          const insertAt = findImportInsertionPoint(lines);
          lines.splice(insertAt, 0, `import { ${framerNeeds.sort().join(", ")} } from "framer-motion";`);
          content = lines.join("\n");
        }
        for (const n of framerNeeds) importedNames.add(n);
        changed   = true;
        fixCount += framerNeeds.length;
      }

      // Add export default safe fallback
      const hasJSX = /<[A-Za-z][^>]*>/.test(stripped) || /<>/.test(stripped);
      const exportDefaultExists = /export\s+default\s+/.test(content);

      if (hasJSX && !exportDefaultExists) {
        const fnMatch =
          content.match(/(?:function|const)\s+([A-Z][a-zA-Z0-9]*)\s*[=(]/) ??
          content.match(/^const\s+([A-Z][a-zA-Z0-9]*)/m);
        const name = fnMatch?.[1];
        if (name) {
          const alreadyExported = new RegExp(`export\\s+default\\s+${name}\\b`).test(content);
          if (!alreadyExported) {
            content = content.trimEnd() + `\n\nexport default ${name};\n`;
            changed = true;
            fixCount++;
          }
        } else {
          content = content.trimEnd() + `\n\nexport default function Component() {\n  return null;\n}\n`;
          changed = true;
          fixCount++;
        }
      }

      if (!changed || content === originalContent) return file;
      return { ...file, content };
    } catch {
      return file;
    }
  });

  return { files: fixed, fixCount };
}

// =============================================================================
// UNUSED IMPORT REMOVAL
// =============================================================================

function removeUnusedImports(files: StreamFile[]): StreamFile[] {
  return files.map((file) => {
    if (!file.path.endsWith(".jsx") && !file.path.endsWith(".tsx")) return file;
    try {
      const lines = file.content.split("\n");
      const resultLines: string[] = [];
      let changed = false;

      const { jsBody, jsxTagNames } = buildBodyForUsageCheck(file.content);
      const isUsed = (identifier: string): boolean => {
        return isIdentifierUsed(identifier, jsBody, jsxTagNames);
      };

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("import ")) {
          resultLines.push(line);
          continue;
        }

        const parsed = parseImportLine(trimmed);
        if (!parsed) {
          resultLines.push(line);
          continue;
        }

        if (parsed.isSideEffect) {
          resultLines.push(line);
          continue;
        }

        if (!parsed.defaultImport && !parsed.namespaceImport && parsed.namedImports.length === 0) {
          resultLines.push(line);
          continue;
        }

        if (parsed.namespaceImport) {
          if (isUsed(parsed.namespaceImport)) {
            resultLines.push(line);
          } else {
            changed = true;
          }
          continue;
        }

        const newDefault = parsed.defaultImport && isUsed(parsed.defaultImport)
          ? parsed.defaultImport
          : null;

        const newNamed = parsed.namedImports.filter(({ name, alias }) => {
          const localId = alias ?? name;
          return isUsed(localId);
        });

        const nothingRemains = !newDefault && newNamed.length === 0;
        if (nothingRemains) {
          changed = true;
          continue;
        }

        const unchangedDefault = newDefault === parsed.defaultImport;
        const unchangedNamed =
          newNamed.length === parsed.namedImports.length &&
          newNamed.every((n, i) => {
            const o = parsed.namedImports[i];
            return o && n.name === o.name && n.alias === o.alias;
          });

        if (unchangedDefault && unchangedNamed) {
          resultLines.push(line);
          continue;
        }

        const rebuilt: ParsedImport = {
          raw: parsed.raw,
          source: parsed.source,
          defaultImport: newDefault,
          namespaceImport: null,
          namedImports: newNamed,
          isSideEffect: false,
        };
        resultLines.push(serializeImport(rebuilt));
        changed = true;
      }

      if (!changed) return file;
      const newContent = resultLines.join("\n").replace(/\n{3,}/g, "\n\n");
      if (newContent === file.content) return file;
      return { ...file, content: newContent };
    } catch {
      return file;
    }
  });
}

// =============================================================================
// IMPORT NORMALIZATION
// =============================================================================

function normalizeImports(files: StreamFile[]): StreamFile[] {
  return files.map((file) => {
    if (!file.path.endsWith(".jsx") && !file.path.endsWith(".tsx")) return file;
    try {
      const lines = file.content.split("\n");
      const parsedImports: Array<{ parsed: ParsedImport; originalLine: string }> = [];
      const nonImportLines: Array<{ index: number; line: string }> = [];

      for (let i = 0; i < lines.length; i++) {
        const trimmed = lines[i].trim();
        if (trimmed.startsWith("import ") || /^import\s+["']/.test(trimmed)) {
          const parsed = parseImportLine(trimmed);
          if (parsed) {
            parsedImports.push({ parsed, originalLine: lines[i] });
          } else {
            nonImportLines.push({ index: i, line: lines[i] });
          }
        } else {
          nonImportLines.push({ index: i, line: lines[i] });
        }
      }

      if (parsedImports.length === 0) return file;

      interface MergedEntry {
        source: string;
        defaultImport: string | null;
        namespaceImport: string | null;
        namedImports: Array<{ name: string; alias: string | null }>;
        isSideEffect: boolean;
        priority: number;
        originalIndex: number;
      }

      const mergedEntries: MergedEntry[] = [];
      const mergeKey = (parsed: ParsedImport): string => {
        if (parsed.isSideEffect) return `side-effect::${parsed.source}::${Math.random()}`;
        if (parsed.namespaceImport) return `namespace::${parsed.source}`;
        return `regular::${parsed.source}`;
      };
      const mergeMap = new Map<string, MergedEntry>();

      for (let idx = 0; idx < parsedImports.length; idx++) {
        const { parsed } = parsedImports[idx];
        const { source } = parsed;

        let priority = 1;
        if (source === "react") priority = 0;
        else if (source.startsWith(".") || source.startsWith("/")) priority = 2;

        const key = mergeKey(parsed);
        if (!mergeMap.has(key)) {
          const entry: MergedEntry = {
            source,
            defaultImport: null,
            namespaceImport: null,
            namedImports: [],
            isSideEffect: parsed.isSideEffect,
            priority,
            originalIndex: idx,
          };
          mergeMap.set(key, entry);
          mergedEntries.push(entry);
        }

        const entry = mergeMap.get(key)!;
        if (parsed.isSideEffect) continue;

        if (parsed.defaultImport && !entry.defaultImport) {
          entry.defaultImport = parsed.defaultImport;
        }
        if (parsed.namespaceImport && !entry.namespaceImport) {
          entry.namespaceImport = parsed.namespaceImport;
        }
        for (const ni of parsed.namedImports) {
          const exists = entry.namedImports.some(
            (e) => e.name === ni.name && e.alias === ni.alias
          );
          if (!exists) {
            entry.namedImports.push(ni);
          }
        }
      }

      const sorted = [...mergedEntries].sort((a, b) => {
        if (a.priority !== b.priority) return a.priority - b.priority;
        if (a.priority === b.priority) {
          return a.source.localeCompare(b.source);
        }
        return a.originalIndex - b.originalIndex;
      });

      const newImportLines = sorted.map((entry) => {
        if (entry.isSideEffect) {
          return serializeImport({
            raw: "",
            source: entry.source,
            defaultImport: null,
            namespaceImport: null,
            namedImports: [],
            isSideEffect: true,
          });
        }
        const sortedNamed = [...entry.namedImports].sort((a, b) => {
          const aId = a.alias ?? a.name;
          const bId = b.alias ?? b.name;
          return aId.localeCompare(bId);
        });
        return serializeImport({
          raw: "",
          source: entry.source,
          defaultImport: entry.defaultImport,
          namespaceImport: entry.namespaceImport,
          namedImports: sortedNamed,
          isSideEffect: false,
        });
      });

      const originalImportLines = parsedImports.map(({ originalLine }) => originalLine.trim());
      const isAlreadyNormalized =
        newImportLines.length === originalImportLines.length &&
        newImportLines.every((l, i) => l === originalImportLines[i]);

      if (isAlreadyNormalized) return file;

      const newContent =
        newImportLines.join("\n") +
        "\n" +
        nonImportLines.map(({ line }) => line).join("\n");

      const finalContent = newContent.replace(/\n{3,}/g, "\n\n");
      if (finalContent === file.content) return file;
      return { ...file, content: finalContent };
    } catch {
      return file;
    }
  });
}

// =============================================================================
// FINAL CLEAN PASS
// =============================================================================

function finalCleanPass(files: StreamFile[]): StreamFile[] {
  return files.map((file) => {
    if (!file.path.endsWith(".jsx") && !file.path.endsWith(".tsx")) return file;
    try {
      const content = file.content
        .replace(/console\.log\s*\([^)]*\)\s*;?/g, "")
        .replace(/\bdebugger\s*;?/g, "")
        .split("\n")
        .map((line) => line.trimEnd())
        .join("\n")
        .replace(/^\n+/, "")
        .replace(/\n{3,}/g, "\n\n")
        .replace(/\n*$/, "\n");

      if (content === file.content) return file;
      return { ...file, content };
    } catch {
      return file;
    }
  });
}

// =============================================================================
// SAFE CLEANUP: CSS @IMPORT REMOVAL
// =============================================================================

function cleanCSSImports(files: StreamFile[]): {
  files: StreamFile[];
  changed: Set<string>;
} {
  const changed = new Set<string>();
  const result  = files.map((file) => {
    if (!file.path.endsWith(".css")) return file;
    const before  = file.content;
    const content = before.replace(/@import\s+[^;]+;?\n?/gi, "");
    if (before !== content) { changed.add(file.path); return { ...file, content }; }
    return file;
  });
  return { files: result, changed };
}

// =============================================================================
// SAFE CLEANUP: CONCATENATED FILE SPLIT
// =============================================================================

function findConcatenationBoundary(content: string): number | null {
  const re = /export\s+default\s+\w+\s*;/g;
  let last: RegExpExecArray | null = null;
  let m: RegExpExecArray | null;
  while ((m = re.exec(content)) !== null) last = m;
  if (!last) return null;

  const after     = last.index + last[0].length;
  const remainder = content.slice(after).trimStart();
  const offset    = content.slice(after).length - remainder.length;

  if (
    /^import\s+/.test(remainder) ||
    /^['"]use\s+(client|server)['"]/.test(remainder) ||
    /^\/\*\s*=/.test(remainder)
  ) {
    return after + offset;
  }
  return null;
}

function splitConcatenatedFiles(files: StreamFile[]): {
  files: StreamFile[];
  errors: ValidationError[];
} {
  const result: StreamFile[]     = [];
  const errors: ValidationError[] = [];

  for (const file of files) {
    if (!file.path.endsWith(".jsx") && !file.path.endsWith(".tsx")) {
      result.push(file);
      continue;
    }
    const boundary = findConcatenationBoundary(file.content);
    if (!boundary) { result.push(file); continue; }

    const first  = file.content.slice(0, boundary).trim();
    const second = file.content.slice(boundary).trim();

    errors.push(
      makeError(file.path, "concatenated-file-split",
        "File was concatenated with another component — split into two files")
    );
    result.push({ path: file.path, content: first });

    const fnMatch = second.match(
      /export\s+default\s+(?:function\s+)?([A-Z][a-zA-Z]+)/
    );
    if (fnMatch) {
      const dir     = file.path.split("/").slice(0, -1).join("/");
      const newPath = `${dir}/${fnMatch[1]}.jsx`;
      result.push({ path: newPath, content: second });
      errors.push(
        makeError(newPath, "concatenated-file-split",
          `Created from concatenated content in ${file.path}`)
      );
    }
  }
  return { files: result, errors };
}

// =============================================================================
// DETECTION PASSES
// =============================================================================

function detectMissingReactImport(
  file: StreamFile,
  analysis: FileAnalysis
): ValidationError[] {
  if (!analysis.hasJSX || analysis.hasReactImport) return [];
  if (!/\bReact\./.test(file.content)) return [];
  return [makeError(file.path, "missing-react-import",
    "File uses React namespace (React.*) but does not import React")];
}

function detectMissingExportDefault(
  file: StreamFile,
  analysis: FileAnalysis
): ValidationError[] {
  if (!analysis.hasJSX || analysis.hasExportDefault) return [];
  return [makeError(file.path, "missing-export-default",
    "JSX file is missing 'export default' — component will not be importable")];
}

function detectMultipleExportDefault(file: StreamFile): ValidationError[] {
  if (!file.path.endsWith(".jsx") && !file.path.endsWith(".tsx")) return [];
  const stripped = stripCommentsAndStrings(file.content);
  const matches = stripped.match(/\bexport\s+default\b/g);
  if (!matches || matches.length <= 1) return [];
  // Mark file unrecoverable (catastrophic corruption)
  markFileUnrecoverable(file);
  return [makeError(file.path, "multiple-export-default",
    `File contains ${matches.length} "export default" declarations — only one is allowed per module`)];
}

function detectMissingJSXReturn(
  file: StreamFile,
  analysis: FileAnalysis
): ValidationError[] {
  if (!analysis.hasJSX || analysis.hasJSXReturn) return [];
  const hasFn =
    /(?:function\s+[A-Z]|const\s+[A-Z][a-zA-Z]+\s*=\s*(?:\([^)]*\)|[a-zA-Z]+)\s*=>)/.test(
      file.content
    );
  if (!hasFn) return [];
  return [makeError(file.path, "missing-jsx-return",
    "Component function exists but no JSX return statement detected")];
}

function detectInvalidImportPaths(
  file: StreamFile,
  analysis: FileAnalysis,
  allPaths: Set<string>
): ValidationError[] {
  const errors: ValidationError[] = [];
  for (const { raw, resolved } of analysis.relativeImports) {
    if (!pathExistsInProject(resolved, allPaths)) {
      errors.push(makeError(file.path, "invalid-import-path",
        `Import path "${raw}" resolves to "${resolved}" which does not exist in the project`));
    }
  }
  return errors;
}

function detectFramerMotionIssues(
  file: StreamFile,
  analysis: FileAnalysis
): ValidationError[] {
  const errors: ValidationError[] = [];

  if (analysis.usesMotion) {
    const ok =
      /import\s+\{[^}]*\bmotion\b[^}]*\}\s+from\s+["']framer-motion["']/.test(
        file.content
      );
    if (!ok) {
      errors.push(makeError(file.path, "missing-motion-import",
        'motion.* is used but { motion } is not imported from "framer-motion"',
        { suggestedLib: "framer-motion" }));
    }
  }

  if (analysis.usesAnimatePresence && !analysis.importedNames.has("AnimatePresence")) {
    errors.push(makeError(file.path, "missing-framer-import",
      'AnimatePresence is used but not imported from "framer-motion"',
      { component: "AnimatePresence", suggestedLib: "framer-motion" }));
  }

  return errors;
}

// =============================================================================
// JSX TAG PARSER
// =============================================================================

function detectJSXIssues(content: string, filePath: string): ValidationError[] {
  const errors: ValidationError[] = [];
  const stripped = stripCommentsAndStrings(content);

  const stack: Array<{ name: string; line: number }> = [];
  let fragmentDepth = 0;
  const closedTagCounts = new Map<string, number>();

  const tagRe = /(<\/?>|<\/?([A-Za-z][a-zA-Z0-9.]*)([^>]*?)(\/?)>)/g;
  let m: RegExpExecArray | null;

  while ((m = tagRe.exec(stripped)) !== null) {
    const full = m[0];
    const line = stripped.slice(0, m.index).split("\n").length;

    if (full === "<>") { fragmentDepth++; continue; }
    if (full === "</>") {
      if (fragmentDepth > 0) { fragmentDepth--; continue; }
      errors.push(makeError(filePath, "orphaned-closing-tag",
        "Orphaned fragment closing tag </>", { line }));
      continue;
    }

    const isClosing = full.startsWith("</");
    const rawName   = m[2];
    if (!rawName) continue;
    if (rawName.includes(".")) continue;

    const tagName   = rawName;
    const attrBody  = m[3] ?? "";
    const selfClose = m[4] === "/" || /\/$/.test(attrBody.trimEnd());
    const isVoid    = VOID_HTML_TAGS.has(tagName.toLowerCase());

    if (!isClosing && selfClose && !isVoid && HTML_TAGS.has(tagName.toLowerCase())) {
      const problematicSelfClose = ["script", "style", "textarea", "select"].includes(
        tagName.toLowerCase()
      );
      if (problematicSelfClose) {
        errors.push(makeError(filePath, "self-closing-mismatch",
          `<${tagName} /> used as self-closing but "${tagName}" cannot be self-closed in HTML`,
          { component: tagName, line }));
      }
    }

    if (isClosing) {
      if (isVoid) continue;

      const closeCount = (closedTagCounts.get(tagName) ?? 0) + 1;
      closedTagCounts.set(tagName, closeCount);

      if (stack.length === 0) {
        errors.push(makeError(filePath, "orphaned-closing-tag",
          `Orphaned closing tag </${tagName}>`, { component: tagName, line }));
      } else if (stack[stack.length - 1]?.name === tagName) {
        stack.pop();
      } else {
        let matchIdx = -1;
        for (let i = stack.length - 1; i >= 0; i--) {
          if (stack[i]?.name === tagName) { matchIdx = i; break; }
        }
        if (matchIdx >= 0) {
          for (let i = stack.length - 1; i > matchIdx; i--) {
            errors.push(makeError(filePath, "unclosed-tag",
              `Unclosed JSX tag <${stack[i]?.name}> (found closing </${tagName}> before it was closed)`,
              { component: stack[i]?.name, line }));
          }
          stack.splice(matchIdx);
        } else {
          const openCount = stripped
            .slice(0, m.index)
            .match(new RegExp(`<${tagName}[\\s/>]`, "g"))?.length ?? 0;
          if (closeCount > openCount) {
            errors.push(makeError(filePath, "duplicate-closing-tag",
              `Duplicate closing tag </${tagName}> — tag was already closed`,
              { component: tagName, line }));
          } else {
            errors.push(makeError(filePath, "orphaned-closing-tag",
              `Mismatched closing tag </${tagName}> (expected </${stack[stack.length - 1]?.name}>)`,
              { component: tagName, line }));
          }
        }
      }
    } else if (!selfClose && !isVoid) {
      const tagLower = tagName.toLowerCase();
      const rule = INVALID_NESTING_RULES.find((r) => r.child === tagLower);
      if (rule) {
        for (let i = stack.length - 1; i >= 0; i--) {
          const ancestorName = (stack[i]?.name ?? "").toLowerCase();
          if (rule.invalidParents.includes(ancestorName)) {
            errors.push(makeError(filePath, "invalid-nesting",
              `Invalid JSX nesting: <${tagName}> cannot be a descendant of <${stack[i]?.name}>`,
              { component: tagName, line }));
            break;
          }
        }
      }
      stack.push({ name: tagName, line });
    }

    const malRe = /\s+([a-zA-Z][a-zA-Z0-9:-]*)=(?!["'{`])[^\s/>]/g;
    let attrM: RegExpExecArray | null;
    while ((attrM = malRe.exec(attrBody)) !== null) {
      errors.push(makeError(filePath, "malformed-jsx-attribute",
        `Malformed JSX attribute "${attrM[1]}" — value must be quoted or a {expression}`,
        { line }));
    }
  }

  for (const { name, line } of stack) {
    errors.push(makeError(filePath, "unclosed-tag",
      `Unclosed JSX tag <${name}>`, { component: name, line }));
  }
  for (let i = 0; i < fragmentDepth; i++) {
    errors.push(makeError(filePath, "unclosed-tag", "Unclosed JSX fragment <>"));
  }

  const emptyRe = /\breturn\s*\(\s*\)/g;
  while ((m = emptyRe.exec(stripped)) !== null) {
    const line = stripped.slice(0, m.index).split("\n").length;
    errors.push(makeError(filePath, "empty-jsx-return",
      "Component returns an empty tuple — JSX return must contain valid markup",
      { line }));
  }

  const emptyFrag = /\breturn\s*\(\s*<>\s*<\/>\s*\)/g;
  while ((m = emptyFrag.exec(stripped)) !== null) {
    const line = stripped.slice(0, m.index).split("\n").length;
    errors.push(makeError(filePath, "empty-jsx-return",
      "Component returns an empty fragment — likely unfinished render output",
      { line }));
  }

  return errors;
}

function detectHookErrors(content: string, filePath: string): ValidationError[] {
  const errors: ValidationError[] = [];
  const stripped = content
    .replace(/\/\/[^\n]*/g, "")
    .replace(/\/\*[\s\S]*?\*\//g, "");

  const re = /\buseEffect\s*\(/g;
  let m: RegExpExecArray | null;

  while ((m = re.exec(stripped)) !== null) {
    const start = m.index + m[0].length - 1;
    let depth = 1, i = start + 1;
    let foundComma = false;
    let inStr = false, strCh = "";

    while (i < stripped.length && depth > 0) {
      const ch = stripped[i];
      if (inStr) {
        if (ch === strCh && stripped[i - 1] !== "\\") inStr = false;
      } else if (ch === '"' || ch === "'" || ch === "`") {
        inStr = true; strCh = ch;
      } else if (ch === "(" || ch === "[" || ch === "{") { depth++; }
      else if (ch === ")" || ch === "]" || ch === "}") {
        depth--;
        if (depth === 0) break;
      } else if (ch === "," && depth === 1) {
        foundComma = true; break;
      }
      i++;
    }

    if (!foundComma) {
      const line = stripped.slice(0, m.index).split("\n").length;
      errors.push(makeError(filePath, "hook-error",
        "useEffect is missing its dependency array (second argument)", { line }));
    }
  }

  return errors;
}

function detectInvalidJSXLogic(content: string, filePath: string): ValidationError[] {
  const errors: ValidationError[] = [];
  const stripped = content
    .replace(/\/\/[^\n]*/g, "")
    .replace(/\/\*[\s\S]*?\*\//g, "");

  const retRe = /\breturn\s*\(/g;
  let retM: RegExpExecArray | null;

  while ((retM = retRe.exec(stripped)) !== null) {
    let depth = 1, i = retM.index + retM[0].length;
    let body = "";
    while (i < stripped.length && depth > 0) {
      const ch = stripped[i];
      if (ch === "(") depth++;
      else if (ch === ")") { depth--; if (depth === 0) break; }
      body += ch;
      i++;
    }
    const ifRe = /\{\s*if\s*\(/g;
    let ifM: RegExpExecArray | null;
    while ((ifM = ifRe.exec(body)) !== null) {
      const line = stripped
        .slice(0, retM.index + retM[0].length + ifM.index)
        .split("\n").length;
      errors.push(makeError(filePath, "invalid-jsx-logic",
        'Invalid JSX: bare "{ if (...) }" inside JSX return — use "{ condition && <Comp /> }" or a ternary instead',
        { line }));
    }
  }

  return errors;
}

// =============================================================================
// DETECT IMPORT ISSUES
// =============================================================================

function detectImportIssues(
  file: StreamFile,
  analysis: FileAnalysis,
  allFiles: StreamFile[],
  componentRegistry: Map<string, string>
): ValidationError[] {
  const errors: ValidationError[] = [];

  for (const comp of analysis.usedComponents) {
    if (analysis.locallyDefined.has(comp)) continue;
    if (ALWAYS_AVAILABLE.has(comp)) continue;

    // Lucide icons
    if (LUCIDE_ICONS.has(comp)) {
      const from = analysis.importedFrom.get(comp);
      if (!from) {
        errors.push(makeError(file.path, "missing-import",
          `Lucide icon "${comp}" missing import`,
          { component: comp, suggestedLib: "lucide-react" }));
      } else if (from !== "lucide-react") {
        errors.push(makeError(file.path, "wrong-import-source",
          `Lucide icon "${comp}" should come from "lucide-react"`,
          { component: comp, suggestedLib: "lucide-react" }));
      }
      continue;
    }

    // Known library components
    const lib = detectLibraryForComponent(comp);
    if (lib) {
      const from = analysis.importedFrom.get(comp);
      if (!from) {
        errors.push(makeError(file.path, "missing-import",
          `Component "${comp}" missing import (${lib})`,
          { component: comp, suggestedLib: lib }));
      } else if (from !== lib) {
        errors.push(makeError(file.path, "wrong-import-source",
          `Component "${comp}" should come from "${lib}"`,
          { component: comp, suggestedLib: lib }));
      }
      continue;
    }

    // Internal components
    if (componentRegistry.has(comp)) {
      const regPath = componentRegistry.get(comp)!;
      if (regPath !== file.path && !analysis.importedNames.has(comp)) {
        errors.push(makeError(file.path, "missing-import",
          `Component "${comp}" exists but not imported`,
          { component: comp }));
      }
      continue;
    }

    // Unknown component
    errors.push(makeError(file.path, "undefined-component",
      `Unknown component "${comp}" — will be handled by auto-fix or LLM`,
      { component: comp }));
  }

  return errors;
}

// =============================================================================
// DETECT COMPONENT EXISTENCE VIOLATIONS — v9.3: no longer marks unrecoverable
// =============================================================================

function detectComponentExistenceViolations(
  file: StreamFile,
  analysis: FileAnalysis,
  componentRegistry: Map<string, string>
): ValidationError[] {
  const errors: ValidationError[] = [];

  for (const comp of analysis.usedComponents) {
    if (ALWAYS_AVAILABLE.has(comp))              continue;
    if (analysis.locallyDefined.has(comp))       continue;
    if (analysis.importedNames.has(comp))        continue;
    if (comp in COMPONENT_TO_LIBRARY)            continue;
    if (LUCIDE_ICONS.has(comp))                  continue;
    if (componentRegistry.has(comp))             continue;

    const err = makeError(file.path, "undefined-component",
      `Component "${comp}" is used in JSX but is not locally defined, imported, or from any known library`,
      { component: comp });
    errors.push(err);
    // No longer marking as unrecoverable
  }

  return errors;
}

function detectUnusedImports(
  file: StreamFile,
  analysis: FileAnalysis
): ValidationError[] {
  const errors: ValidationError[] = [];
  const { jsBody, jsxTagNames } = buildBodyForUsageCheck(file.content);

  for (const [name, source] of analysis.importedFrom) {
    if (name === "React" || name === "*" || !name) continue;
    if (!isIdentifierUsed(name, jsBody, jsxTagNames)) {
      errors.push(makeError(file.path, "unused-import",
        `"${name}" is imported from "${source}" but never used`,
        { component: name }));
    }
  }

  return errors;
}

// =============================================================================
// ERROR DEDUPLICATION
// =============================================================================

function deduplicateErrors(errors: ValidationError[]): ValidationError[] {
  const seen   = new Set<string>();
  const result: ValidationError[] = [];
  for (const e of errors) {
    const key = `${e.file}::${e.type}::${e.component ?? e.message}`;
    if (!seen.has(key)) { seen.add(key); result.push(e); }
  }
  return result;
}

// =============================================================================
// NON‑BLOCKING SAFETY CHECKS — v9.3: return structured info, never throw
// =============================================================================

export function assertNoFatalErrors(result: ValidationResult): { isSafe: boolean; failures: string[] } {
  const blocking = result.errors.filter((e) => e.level !== "warning");
  const failures = blocking.map(
    (e) => `[${e.level.toUpperCase()}] [${e.type}] ${e.file} — ${e.message}`
  );
  return { isSafe: blocking.length === 0, failures };
}

export function verifyBuildSafe(files: StreamFile[]): { isSafe: boolean; failures: string[] } {
  const allPaths = new Set(files.map((f) => f.path));
  const failures: string[] = [];

  for (const file of files) {
    if (!file.path.endsWith(".jsx") && !file.path.endsWith(".tsx")) continue;

    try {
      const analysis = analyzeFile(file, allPaths);

      if (analysis.hasJSX && !analysis.hasExportDefault) {
        failures.push(`${file.path}: missing export default`);
      }

      const stripped = stripCommentsAndStrings(file.content);
      const exportMatches = stripped.match(/\bexport\s+default\b/g);
      if (exportMatches && exportMatches.length > 1) {
        failures.push(`${file.path}: multiple export default (${exportMatches.length} found)`);
      }

      if (!analysis.hasJSX && /function\s+[A-Z]/.test(file.content)) {
        failures.push(`${file.path}: component declared but no valid JSX found`);
      }

      for (const { raw, resolved } of analysis.relativeImports) {
        if (!pathExistsInProject(resolved, allPaths)) {
          failures.push(`${file.path}: unresolved import "${raw}" → "${resolved}"`);
        }
      }

      const componentRegistry = buildComponentRegistry(files);
      for (const comp of analysis.usedComponents) {
        if (ALWAYS_AVAILABLE.has(comp))           continue;
        if (analysis.locallyDefined.has(comp))    continue;
        if (analysis.importedNames.has(comp))     continue;
        if (comp in COMPONENT_TO_LIBRARY)         continue;
        if (LUCIDE_ICONS.has(comp))               continue;
        if (componentRegistry.has(comp))          continue;
        failures.push(`${file.path}: undefined component "${comp}" used in JSX`);
      }

      for (const comp of analysis.usedComponents) {
        if (ALWAYS_AVAILABLE.has(comp))           continue;
        if (analysis.locallyDefined.has(comp))    continue;
        const lib = detectLibraryForComponent(comp);
        if (lib && !analysis.importedNames.has(comp)) {
          failures.push(`${file.path}: "${comp}" used but not imported from "${lib}"`);
        }
      }

      const jsxIssues = detectJSXIssues(file.content, file.path);
      for (const issue of jsxIssues) {
        if (issue.type === "unclosed-tag" || issue.type === "orphaned-closing-tag" ||
            issue.type === "duplicate-closing-tag" || issue.type === "invalid-nesting") {
          failures.push(`${file.path}: JSX structural issue — ${issue.message}`);
        }
      }
    } catch (err) {
      failures.push(`${file.path}: analysis threw — ${String(err)}`);
    }
  }

  return { isSafe: failures.length === 0, failures };
}

// =============================================================================
// PUBLIC ENTRY POINT
// =============================================================================

export function runSemanticValidation(files: StreamFile[]): ValidationResult {
  const startTime = Date.now();

  // Clear caches
  _analysisCache.clear();
  _strippedCache.clear();
  _importLineCache.clear();
  _registryCache.clear();
  _depGraphCache.clear();
  _rejectedFiles.clear();

  const errors: ValidationError[] = [];
  let   result = [...files];
  let   autoFixesApplied = 0;

  // Phase 1 — structural cleanup
  const { files: cssFixed, changed: cssChanged } = cleanCSSImports(result);
  result = cssFixed;
  for (const path of cssChanged) {
    errors.push(makeError(path, "css-import-removed", "Removed CSS @import statement(s)"));
  }

  const splitResult = splitConcatenatedFiles(result);
  result = splitResult.files;
  errors.push(...splitResult.errors);

  // Phase 2 — auto-fix (runs BEFORE detection)
  const { files: autoFixed, fixCount } = autoFixCriticalIssues(result);
  result          = autoFixed;
  autoFixesApplied = fixCount;

  _analysisCache.clear();
  _strippedCache.clear();
  _importLineCache.clear();

  // Phase 3 — build registries
  const allPaths          = new Set(result.map((f) => f.path));
  const componentRegistry = buildComponentRegistry(result);
  const depGraph          = buildDependencyGraph(result);

  // Phase 4 — circular dependencies
  for (const { cycle } of detectCircularDependencies(depGraph, allPaths)) {
    errors.push(makeError(cycle[0], "circular-dependency",
      `Circular dependency detected: ${cycle.join(" → ")}`));
  }

  // Phase 5 — per-file detection
  for (const file of result) {
    if (!file.path.endsWith(".jsx") && !file.path.endsWith(".tsx")) continue;

    let analysis: FileAnalysis;
    try {
      analysis = analyzeFile(file, allPaths);
    } catch {
      errors.push(makeError(file.path, "invalid-jsx-logic",
        "File could not be analyzed — marking as unrecoverable"));
      markFileUnrecoverable(file);
      analysis = {
        importedNames: new Set(),
        importedFrom: new Map(),
        relativeImports: [],
        usedComponents: [],
        hasJSX: false,
        hasReactImport: false,
        hasExportDefault: false,
        hasJSXReturn: false,
        usesMotion: false,
        usesAnimatePresence: false,
        locallyDefined: new Set(),
        strippedContent: "",
        importLines: [],
      };
    }

    const fileErrors: ValidationError[] = [];
    fileErrors.push(...detectMissingReactImport(file, analysis));
    fileErrors.push(...detectMissingExportDefault(file, analysis));
    fileErrors.push(...detectMultipleExportDefault(file));
    fileErrors.push(...detectMissingJSXReturn(file, analysis));
    fileErrors.push(...detectInvalidImportPaths(file, analysis, allPaths));
    fileErrors.push(...detectFramerMotionIssues(file, analysis));
    fileErrors.push(...detectImportIssues(file, analysis, result, componentRegistry));
    fileErrors.push(...detectComponentExistenceViolations(file, analysis, componentRegistry));
    fileErrors.push(...detectJSXIssues(file.content, file.path));
    fileErrors.push(...detectHookErrors(file.content, file.path));
    fileErrors.push(...detectInvalidJSXLogic(file.content, file.path));
    fileErrors.push(...detectUnusedImports(file, analysis));

    errors.push(...fileErrors);
  }

  // Phase 6 — file rejection: filter out corrupted/unrecoverable files
  const beforeFilterCount = result.length;
  result = result.filter((file) => !isFileRejected(file));
  const filesRejectedCount = beforeFilterCount - result.length;

  // Phase 7 — NO MORE GLOBAL THRESHOLD — removed

  const deduped    = deduplicateErrors(errors);
  const criticals  = deduped.filter((e) => e.level === "critical");
  const fatals     = deduped.filter((e) => e.level === "fatal");
  const warnings   = deduped.filter((e) => e.level === "warning");

  // Phase 8 — auto-fix unused imports & normalize (only on surviving files)
  result = removeUnusedImports(result);
  result = normalizeImports(result);
  result = finalCleanPass(result);

  // Phase 9 — final classification
  const hasCriticalErrors = criticals.length > 0;
  const hasFatalErrors    = fatals.length > 0;
  const isClean           = deduped.length === 0;

  // v9.3: canProceed is always true (unless catastrophic corruption leaves no files)
  const canProceed = result.length > 0;

  const summary = {
    total:    deduped.length,
    critical: criticals.length,
    fatal:    fatals.length,
    warnings: warnings.length,
  };

  const validationTimeMs = Date.now() - startTime;

  const status = isClean
    ? "✅ CLEAN — BUILD SAFE"
    : hasCriticalErrors
    ? "🔴 CRITICAL ERRORS — REPORTED"
    : hasFatalErrors
    ? "🟠 FATAL ERRORS — REPORTED"
    : "⚠️  WARNINGS ONLY — REPORTED";

  console.log(
    `\n📋 [semantic-validator v9.3] ${result.length} file(s) — ${status}\n` +
    `   auto-fixes: ${autoFixesApplied} | rejected: ${filesRejectedCount} | time: ${validationTimeMs}ms\n` +
    `   total: ${summary.total} | critical: ${summary.critical} | ` +
    `fatal: ${summary.fatal} | warnings: ${summary.warnings}\n` +
    `   canProceed=${canProceed} | isClean=${isClean} | STRICT_MODE=${STRICT_MODE}`
  );

  for (const e of deduped) {
    const loc  = e.line ? `:${e.line}` : "";
    const icon =
      e.level === "critical" ? "🔴" :
      e.level === "fatal"    ? "🟠" : "🟡";
    console.log(
      `   ${icon} [${e.level.toUpperCase()}] [${e.type}] ${e.file}${loc} — ${e.message}`
    );
  }

  // Phase 10 — final safety check (never throws, just logs)
  const buildSafety = verifyBuildSafe(result);
  if (!buildSafety.isSafe) {
    console.warn(`[semantic-validator] Structural issues found (non‑blocking):\n${buildSafety.failures.map(f => `  • ${f}`).join("\n")}`);
  }

  return {
    files:            result,
    errors:           deduped,
    hasFatalErrors,
    hasCriticalErrors,
    isClean,
    canProceed,
    autoFixesApplied,
    summary,
    validationTimeMs,
    filesRejectedCount,
  };
}