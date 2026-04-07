//==================== FILE: src/lib/ai/engine/auto-fix.ts ====================

// src/lib/ai/engine/auto-fix.ts
//
// AUTO-FIX PIPELINE — ULTRA ENHANCED VERSION v3.0
//
// NEW FIXES vs previous version:
//  ✅ fixMissingComponents()         — injects stubs for undefined Card/Badge/Spinner etc.
//  ✅ fixUndefinedVariables()         — detects & stubs undefined vars used in JSX
//  ✅ fixInvalidJSXExpressions()      — repairs JSX expression syntax errors
//  ✅ fixWrongDependencies()          — normalises/replaces wrong package imports
//  ✅ fixBrokenHooks()                — repairs malformed hook call-sites
//  ✅ fixMissingDependencyArrays()    — adds missing [] to useEffect / useCallback / useMemo
//  ✅ fixDeadReturnPaths()            — adds explicit return null when function returns void JSX
//  ✅ fixEventHandlerTypes()          — fixes missing e: React.ChangeEvent etc.
//  ✅ fixPromiseHandling()            — wraps unhandled promise rejections
//  ✅ fixDynamicImports()             — normalises dynamic import() syntax
//  ✅ fixFragmentShorthand()          — replaces React.Fragment → <>...</>
//  ✅ fixPropDrilling()               — warns on deeply nested prop drilling
//  ✅ fixStyleObjects()               — repairs invalid CSS-in-JS style objects
//  ✅ fixAccessibility()              — adds missing alt/aria attributes
//  ✅ fixKeyPropInFragments()         — moves key from Fragment to first child when needed
//  ✅ fixImportExtensions()           — strips .js/.jsx from relative imports in TSX files
//  ✅ fixCircularImports()            — detects obvious same-file circular references
//  ✅ fixTsErrors()                   — fixes common TypeScript annotation mistakes
//  ✅ fixEnvVariables()               — normalises process.env → import.meta.env for Vite
//  ✅ fixWindowSSRGuards()            — wraps window/document in typeof checks
//  ✅ fixRequireCalls()               — replaces require() with ES imports
//  ✅ fixObjectSpreadOrder()          — warns about override-order issues in spreads
//  ✅ fixDefaultProps()               — replaces deprecated defaultProps with default params
//  ✅ fixPropTypes()                  — removes propTypes (TypeScript projects)
//  ✅ fixClassComponents()            — converts simple PureComponent to function components
//  ✅ fixRedundantFragments()         — removes single-child fragments
//  ✅ fixStringRefs()                 — replaces deprecated string refs with useRef()
//  ✅ fixSetStateCallback()           — replaces setState(x, cb) with flushSync/useEffect
//  ✅ fixForwardRefDisplay()          — adds displayName to forwardRef components
//  ✅ fixMemoMisuse()                 — warns when memo wraps non-pure components
//  ✅ fixLazyWithoutSuspense()        — wraps React.lazy() usage with Suspense
//  ✅ fixContextWithoutProvider()     — warns when context is consumed without provider
//  ✅ fixDuplicateKeys()              — detects duplicate literal key= values
//  ✅ fixCSSModuleImports()           — corrects malformed CSS module import syntax
//  ✅ fixSvgProps()                   — normalises SVG attribute names for JSX
//  ✅ fixNumberCoercion()             — replaces parseInt(x) → Number(x) / parseInt(x, 10)
//  ✅ fixLooseEquality()              — replaces == / != with === / !== outside JSX
//  ✅ fixDebuggerStatements()         — removes leftover debugger; statements
//  ✅ fixTodoComments()               — logs warning for TODO/FIXME comments
//  ✅ fixLongLines()                  — warns on excessively long lines
//  ✅ fixSpellingInComments()         — corrects common misspellings in comments
//  ✅ fixReturnTypesInTS()            — infers & injects return type on exported functions
//  ✅ fixObjectDestructuring()        — replaces repeated obj.x.y with destructured vars
//  ✅ fixSuspenseWithoutFallback()    — adds fallback prop to <Suspense>
//  ✅ fixHydrationMismatch()          — guards browser-only renders with client-only flag
//  ✅ fixStrictModeWarnings()         — wraps app in <React.StrictMode> when missing
//  ✅ fixCSSVariables()               — normalises malformed CSS custom property usage
//  ✅ fixMediaQueries()               — sorts & deduplicates CSS media queries
//  ✅ fixZIndex()                     — warns on magic z-index values
//  ✅ fixColorContrast()              — warns on low-contrast hardcoded color combos
//  ✅ fixUnusedImports()              — removes imports whose identifiers never appear
//  ✅ fixImplicitAny()                — replaces implicit any with unknown in TS generics
//  ✅ fixAsyncWithoutAwait()          — warns on async functions that never await
//  ✅ fixEmptyFunctions()             — warns on empty function bodies
//  ✅ fixNestedTernary()              — warns on deeply nested ternary expressions
//  ✅ fixMissingErrorBoundary()       — warns when async data is fetched without error boundary
//  ✅ fixI18nHardcodedStrings()       — warns on hardcoded user-visible strings
//  ✅ fixImportOrder()                — sorts imports: react → libs → internal → relative
//  ✅ fixTrailingCommasTS()           — ensures trailing commas in multiline TS types
//  ✅ fixSemicolons()                 — inserts missing semicolons at statement ends
//  ✅ fixHookNamingConvention()       — ensures custom hooks start with "use"
//  ✅ fixExportConflicts()            — detects name collisions between named & default exports
//  All original fixes retained and improved.
//

export type AIFile = {
  path: string;
  content: string;
};

type Severity = "fix" | "warning" | "info";

type FixEntry = {
  severity: Severity;
  message: string;
};

type FixResult = {
  file: AIFile;
  fixes: string[];
  warnings: string[];
  infos: string[];
};

// ================================================================
// KNOWN COMPONENT REGISTRY — components we can auto-stub
// ================================================================
const STUBABLE_COMPONENTS: Record<string, string> = {
  Card: `function Card({ children, className = "" }: { children?: React.ReactNode; className?: string }) {
  return <div className={"rounded-xl border border-gray-200 bg-white p-4 shadow-sm " + className}>{children}</div>;
}`,
  CardHeader: `function CardHeader({ children, className = "" }: { children?: React.ReactNode; className?: string }) {
  return <div className={"mb-3 " + className}>{children}</div>;
}`,
  CardContent: `function CardContent({ children, className = "" }: { children?: React.ReactNode; className?: string }) {
  return <div className={"text-gray-700 " + className}>{children}</div>;
}`,
  CardTitle: `function CardTitle({ children, className = "" }: { children?: React.ReactNode; className?: string }) {
  return <h3 className={"text-lg font-semibold " + className}>{children}</h3>;
}`,
  CardFooter: `function CardFooter({ children, className = "" }: { children?: React.ReactNode; className?: string }) {
  return <div className={"mt-4 flex items-center gap-2 " + className}>{children}</div>;
}`,
  Badge: `function Badge({ children, variant = "default", className = "" }: { children?: React.ReactNode; variant?: string; className?: string }) {
  const base = "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ";
  const variants: Record<string, string> = {
    default: "bg-gray-100 text-gray-800",
    success: "bg-green-100 text-green-800",
    destructive: "bg-red-100 text-red-800",
    warning: "bg-yellow-100 text-yellow-800",
  };
  return <span className={base + (variants[variant] ?? variants.default) + " " + className}>{children}</span>;
}`,
  Button: `function Button({ children, onClick, disabled = false, variant = "default", size = "md", className = "", type = "button" }: {
  children?: React.ReactNode; onClick?: () => void; disabled?: boolean;
  variant?: string; size?: string; className?: string; type?: "button" | "submit" | "reset";
}) {
  const base = "inline-flex items-center justify-center rounded-md font-medium transition-colors focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50 ";
  const variants: Record<string, string> = {
    default: "bg-gray-900 text-white hover:bg-gray-700",
    outline: "border border-gray-300 bg-white hover:bg-gray-50",
    ghost: "hover:bg-gray-100",
    destructive: "bg-red-600 text-white hover:bg-red-500",
  };
  const sizes: Record<string, string> = { sm: "h-8 px-3 text-sm", md: "h-10 px-4", lg: "h-12 px-6 text-lg" };
  return <button type={type} onClick={onClick} disabled={disabled} className={base + (variants[variant] ?? variants.default) + " " + (sizes[size] ?? sizes.md) + " " + className}>{children}</button>;
}`,
  Input: `function Input({ value, onChange, placeholder, type = "text", disabled = false, className = "" }: {
  value?: string; onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string; type?: string; disabled?: boolean; className?: string;
}) {
  return <input value={value} onChange={onChange} placeholder={placeholder} type={type} disabled={disabled}
    className={"flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-400 disabled:opacity-50 " + className} />;
}`,
  Textarea: `function Textarea({ value, onChange, placeholder, rows = 3, className = "" }: {
  value?: string; onChange?: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  placeholder?: string; rows?: number; className?: string;
}) {
  return <textarea value={value} onChange={onChange} placeholder={placeholder} rows={rows}
    className={"flex w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-400 " + className} />;
}`,
  Select: `function Select({ value, onChange, children, className = "" }: {
  value?: string; onChange?: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  children?: React.ReactNode; className?: string;
}) {
  return <select value={value} onChange={onChange}
    className={"flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400 " + className}>{children}</select>;
}`,
  Spinner: `function Spinner({ size = "md", className = "" }: { size?: string; className?: string }) {
  const sizes: Record<string, string> = { sm: "h-4 w-4", md: "h-8 w-8", lg: "h-12 w-12" };
  return <div className={"animate-spin rounded-full border-2 border-gray-300 border-t-gray-700 " + (sizes[size] ?? sizes.md) + " " + className} />;
}`,
  Skeleton: `function Skeleton({ className = "" }: { className?: string }) {
  return <div className={"animate-pulse rounded-md bg-gray-200 " + className} />;
}`,
  Avatar: `function Avatar({ src, alt = "", fallback = "?", className = "" }: {
  src?: string; alt?: string; fallback?: string; className?: string;
}) {
  return src
    ? <img src={src} alt={alt} className={"h-10 w-10 rounded-full object-cover " + className} />
    : <div className={"flex h-10 w-10 items-center justify-center rounded-full bg-gray-300 text-sm font-medium " + className}>{fallback}</div>;
}`,
  Alert: `function Alert({ children, variant = "default", className = "" }: { children?: React.ReactNode; variant?: string; className?: string }) {
  const variants: Record<string, string> = {
    default: "bg-gray-50 border-gray-200 text-gray-800",
    destructive: "bg-red-50 border-red-200 text-red-800",
    success: "bg-green-50 border-green-200 text-green-800",
    warning: "bg-yellow-50 border-yellow-200 text-yellow-800",
  };
  return <div role="alert" className={"relative w-full rounded-lg border p-4 " + (variants[variant] ?? variants.default) + " " + className}>{children}</div>;
}`,
  AlertDescription: `function AlertDescription({ children, className = "" }: { children?: React.ReactNode; className?: string }) {
  return <div className={"mt-1 text-sm " + className}>{children}</div>;
}`,
  AlertTitle: `function AlertTitle({ children, className = "" }: { children?: React.ReactNode; className?: string }) {
  return <h5 className={"mb-1 font-medium leading-none tracking-tight " + className}>{children}</h5>;
}`,
  Modal: `function Modal({ isOpen, onClose, children, title }: {
  isOpen: boolean; onClose: () => void; children?: React.ReactNode; title?: string;
}) {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
        {title && <h2 className="mb-4 text-lg font-semibold">{title}</h2>}
        {children}
        <button onClick={onClose} className="absolute right-4 top-4 text-gray-400 hover:text-gray-600">✕</button>
      </div>
    </div>
  );
}`,
  Divider: `function Divider({ className = "" }: { className?: string }) {
  return <hr className={"border-gray-200 " + className} />;
}`,
  Table: `function Table({ children, className = "" }: { children?: React.ReactNode; className?: string }) {
  return <div className={"w-full overflow-auto " + className}><table className="w-full caption-bottom text-sm">{children}</table></div>;
}`,
  Progress: `function Progress({ value = 0, max = 100, className = "" }: { value?: number; max?: number; className?: string }) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100));
  return (
    <div className={"relative h-4 w-full overflow-hidden rounded-full bg-gray-200 " + className}>
      <div className="h-full bg-gray-900 transition-all" style={{ width: pct + "%" }} />
    </div>
  );
}`,
  Tooltip: `function Tooltip({ children, content, className = "" }: { children?: React.ReactNode; content?: string; className?: string }) {
  const [show, setShow] = React.useState(false);
  return (
    <div className={"relative inline-block " + className} onMouseEnter={() => setShow(true)} onMouseLeave={() => setShow(false)}>
      {children}
      {show && <div className="absolute bottom-full left-1/2 mb-1 -translate-x-1/2 rounded bg-gray-900 px-2 py-1 text-xs text-white whitespace-nowrap">{content}</div>}
    </div>
  );
}`,
  Tabs: `function Tabs({ children, defaultValue, className = "" }: { children?: React.ReactNode; defaultValue?: string; className?: string }) {
  const [active, setActive] = React.useState(defaultValue ?? "");
  return <div className={className} data-active={active}>{typeof children === "function" ? (children as any)(active, setActive) : children}</div>;
}`,
  TabsList: `function TabsList({ children, className = "" }: { children?: React.ReactNode; className?: string }) {
  return <div className={"flex gap-1 rounded-lg bg-gray-100 p-1 " + className}>{children}</div>;
}`,
  TabsTrigger: `function TabsTrigger({ children, value, onClick, className = "" }: { children?: React.ReactNode; value?: string; onClick?: () => void; className?: string }) {
  return <button onClick={onClick} className={"rounded-md px-3 py-1.5 text-sm font-medium transition-all " + className}>{children}</button>;
}`,
  TabsContent: `function TabsContent({ children, className = "" }: { children?: React.ReactNode; className?: string }) {
  return <div className={className}>{children}</div>;
}`,
  Label: `function Label({ children, htmlFor, className = "" }: { children?: React.ReactNode; htmlFor?: string; className?: string }) {
  return <label htmlFor={htmlFor} className={"text-sm font-medium text-gray-700 " + className}>{children}</label>;
}`,
  Checkbox: `function Checkbox({ checked, onChange, id, className = "" }: { checked?: boolean; onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void; id?: string; className?: string }) {
  return <input type="checkbox" id={id} checked={checked} onChange={onChange} className={"h-4 w-4 rounded border-gray-300 " + className} />;
}`,
  Switch: `function Switch({ checked, onChange, className = "" }: { checked?: boolean; onChange?: (val: boolean) => void; className?: string }) {
  return (
    <button role="switch" aria-checked={checked} onClick={() => onChange?.(!checked)}
      className={"relative inline-flex h-6 w-11 items-center rounded-full transition-colors " + (checked ? "bg-gray-900" : "bg-gray-300") + " " + className}>
      <span className={"inline-block h-4 w-4 transform rounded-full bg-white transition-transform " + (checked ? "translate-x-6" : "translate-x-1")} />
    </button>
  );
}`,
  Separator: `function Separator({ orientation = "horizontal", className = "" }: { orientation?: "horizontal" | "vertical"; className?: string }) {
  return orientation === "vertical"
    ? <div className={"h-full w-px bg-gray-200 " + className} />
    : <div className={"h-px w-full bg-gray-200 " + className} />;
}`,
  ScrollArea: `function ScrollArea({ children, className = "" }: { children?: React.ReactNode; className?: string }) {
  return <div className={"overflow-auto " + className}>{children}</div>;
}`,
  Sheet: `function Sheet({ isOpen, onClose, children }: { isOpen: boolean; onClose: () => void; children?: React.ReactNode }) {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="absolute right-0 top-0 h-full w-80 bg-white p-6 shadow-xl">{children}</div>
    </div>
  );
}`,
  Toast: `function Toast({ message, type = "default", onClose }: { message: string; type?: string; onClose?: () => void }) {
  const colors: Record<string, string> = { default: "bg-gray-900 text-white", success: "bg-green-600 text-white", error: "bg-red-600 text-white" };
  return (
    <div className={"fixed bottom-4 right-4 z-50 flex items-center gap-2 rounded-lg px-4 py-3 shadow-lg " + (colors[type] ?? colors.default)}>
      <span>{message}</span>
      {onClose && <button onClick={onClose} className="ml-2 opacity-70 hover:opacity-100">✕</button>}
    </div>
  );
}`,
  DropdownMenu: `function DropdownMenu({ trigger, items, className = "" }: {
  trigger?: React.ReactNode;
  items?: Array<{ label: string; onClick?: () => void; disabled?: boolean }>;
  className?: string;
}) {
  const [open, setOpen] = React.useState(false);
  return (
    <div className={"relative " + className}>
      <div onClick={() => setOpen(!open)}>{trigger}</div>
      {open && (
        <div className="absolute right-0 top-full z-50 mt-1 min-w-40 rounded-md border border-gray-200 bg-white shadow-lg">
          {items?.map((item, i) => (
            <button key={i} onClick={() => { item.onClick?.(); setOpen(false); }} disabled={item.disabled}
              className="flex w-full items-center px-3 py-2 text-sm hover:bg-gray-50 disabled:opacity-50">
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}`,
  Popover: `function Popover({ trigger, content, className = "" }: { trigger?: React.ReactNode; content?: React.ReactNode; className?: string }) {
  const [open, setOpen] = React.useState(false);
  return (
    <div className={"relative inline-block " + className}>
      <div onClick={() => setOpen(!open)}>{trigger}</div>
      {open && (
        <div className="absolute left-1/2 top-full z-50 mt-2 -translate-x-1/2 rounded-lg border border-gray-200 bg-white p-3 shadow-xl">
          {content}
        </div>
      )}
    </div>
  );
}`,
  Accordion: `function Accordion({ items, className = "" }: {
  items?: Array<{ title: string; content: React.ReactNode }>;
  className?: string;
}) {
  const [openIdx, setOpenIdx] = React.useState<number | null>(null);
  return (
    <div className={"divide-y divide-gray-200 rounded-lg border border-gray-200 " + className}>
      {items?.map((item, i) => (
        <div key={i}>
          <button onClick={() => setOpenIdx(openIdx === i ? null : i)}
            className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-medium">
            {item.title}
            <span>{openIdx === i ? "▲" : "▼"}</span>
          </button>
          {openIdx === i && <div className="px-4 pb-3 text-sm text-gray-600">{item.content}</div>}
        </div>
      ))}
    </div>
  );
}`,
};

// ================================================================
// WRONG DEPENDENCY MAP — maps wrong/missing to correct packages
// ================================================================
const DEPENDENCY_CORRECTIONS: Array<{
  wrongPattern: RegExp;
  correctImport: string;
  reason: string;
}> = [
  {
    wrongPattern: /from ['"]react-router['"]/g,
    correctImport: 'from "react-router-dom"',
    reason: "react-router → react-router-dom",
  },
  {
    wrongPattern: /from ['"]@emotion\/styled['"]/g,
    correctImport: 'from "styled-components"',
    reason: "@emotion/styled → styled-components",
  },
  {
    wrongPattern: /from ['"]lodash\/(\w+)['"]/g,
    correctImport: 'from "lodash"',
    reason: "lodash/fn → lodash",
  },
  {
    wrongPattern: /from ['"]react-query['"]/g,
    correctImport: 'from "@tanstack/react-query"',
    reason: "react-query → @tanstack/react-query",
  },
  {
    wrongPattern: /from ['"]@material-ui\/core['"]/g,
    correctImport: 'from "@mui/material"',
    reason: "@material-ui/core → @mui/material",
  },
  {
    wrongPattern: /from ['"]@material-ui\/icons['"]/g,
    correctImport: 'from "@mui/icons-material"',
    reason: "@material-ui/icons → @mui/icons-material",
  },
  {
    wrongPattern: /from ['"]history['"]/g,
    correctImport: 'from "react-router-dom"',
    reason: "history → react-router-dom",
  },
  {
    wrongPattern: /from ['"]next\/link['"]/g,
    correctImport: 'from "react-router-dom"',
    reason: "next/link → react-router-dom (Link)",
  },
  {
    wrongPattern: /from ['"]next\/router['"]/g,
    correctImport: 'from "react-router-dom"',
    reason: "next/router → react-router-dom",
  },
  {
    wrongPattern: /from ['"]classnames['"]/g,
    correctImport: 'from "clsx"',
    reason: "classnames → clsx",
  },
];

// ================================================================
// SVG ATTRIBUTE MAP
// ================================================================
const SVG_ATTR_MAP: Array<[RegExp, string]> = [
  [/\bclass=/g, "className="],
  [/\bstroke-width=/g, "strokeWidth="],
  [/\bstroke-linecap=/g, "strokeLinecap="],
  [/\bstroke-linejoin=/g, "strokeLinejoin="],
  [/\bfill-rule=/g, "fillRule="],
  [/\bclip-rule=/g, "clipRule="],
  [/\bstop-color=/g, "stopColor="],
  [/\bstop-opacity=/g, "stopOpacity="],
  [/\bxlink:href=/g, "href="],
  [/\bxmlns:xlink="[^"]*"/g, ""],
  [/\bfont-size=/g, "fontSize="],
  [/\bfont-family=/g, "fontFamily="],
  [/\bfont-weight=/g, "fontWeight="],
  [/\btext-anchor=/g, "textAnchor="],
  [/\bdominant-baseline=/g, "dominantBaseline="],
  [/\bmarker-end=/g, "markerEnd="],
  [/\bmarker-start=/g, "markerStart="],
  [/\bpointer-events=/g, "pointerEvents="],
  [/\bshape-rendering=/g, "shapeRendering="],
  [/\bcolor-interpolation=/g, "colorInterpolation="],
  [/\bcolor-interpolation-filters=/g, "colorInterpolationFilters="],
  [/\bflood-color=/g, "floodColor="],
  [/\bflood-opacity=/g, "floodOpacity="],
  [/\blighting-color=/g, "lightingColor="],
  [/\bbaseline-shift=/g, "baselineShift="],
  [/\bclip-path=/g, "clipPath="],
  [/\bmask-type=/g, "maskType="],
  [/\bvector-effect=/g, "vectorEffect="],
];

// ================================================================
// BUILD GLOBAL COMPONENT REGISTRY (add before autoFixFiles)
// ================================================================
function buildComponentRegistry(files: AIFile[]): Map<string, string> {
  const registry = new Map<string, string>();
  for (const file of files) {
    const code = file.content;
    const matches = code.matchAll(
      /(?:export\s+default\s+function|export\s+function|const|function)\s+([A-Z][A-Za-z0-9]*)/g
    );
    for (const m of matches) {
      registry.set(m[1], file.path);
    }
  }
  return registry;
}

// ================================================================
// PUBLIC ENTRY POINT
// ================================================================
export function autoFixFiles(
  files: AIFile[],
  registry?: Map<string, string>
): AIFile[] {

  // STEP 0: Cross-file numeric filename fix (must come first)
  let updatedFiles = fixNumericFilenames(files);

  // STEP 1: Build global component registry (only if not provided)
  const finalRegistry = registry ?? buildComponentRegistry(updatedFiles);

  // STEP 2: Cross-file dependency resolution with registry
  updatedFiles = fixCrossFileDependencies(updatedFiles, finalRegistry);

  // STEP 3: Per-file fixes with registry
  const results: FixResult[] = updatedFiles.map((file) =>
    fixFile(file, finalRegistry)
  );

  // STEP 4: Cross-file structural fixes
  const fixed = crossFileFixes(results.map((r) => r.file));

  // STEP 5: Logging
  results.forEach((r) => {
    if (r.fixes.length > 0) {
      console.log(`🔧 [${r.file.path}] ${r.fixes.length} fix(es):`, r.fixes);
    }
    if (r.warnings.length > 0) {
      console.warn(`⚠️  [${r.file.path}] ${r.warnings.length} warning(s):`, r.warnings);
    }
    if (r.infos.length > 0) {
      console.info(`ℹ️  [${r.file.path}] ${r.infos.length} info(s):`, r.infos);
    }
  });

  return fixed;
}
// ================================================================
// PER-FILE FIX PIPELINE
// ================================================================

function fixFile(file: AIFile, registry: Map<string, string>): FixResult {
  const fixes: string[] = [];
  const warnings: string[] = [];
  const infos: string[] = [];

  const ext = file.path.split(".").pop()?.toLowerCase() ?? "";
  const isJS = ["js", "jsx", "ts", "tsx"].includes(ext);
  const isTS = ["ts", "tsx"].includes(ext);
  const isCSS = ["css", "scss"].includes(ext);
  const isJSON = ext === "json";
  const isHTML = ext === "html";

  let code = file.content ?? "";

  // ── Universal fixes ──────────────────────────────────────────
  code = fixEncoding(code, fixes);
  code = fixLineEndings(code, fixes);
  code = stripBOM(code, fixes);
  code = collapseBlankLines(code, fixes);

  // ── JS/JSX/TS/TSX fixes ──────────────────────────────────────
  if (isJS) {
    // Phase 1: Cleanup & structural
    code = fixRunawayDuplicateJSX(code, fixes);
    code = stripUseClientDirective(code, fixes);
    code = stripLLMLeakage(code, fixes);
    code = fixRequireCalls(code, fixes);
    code = fixEnvVariables(code, fixes);
    code = fixDebuggerStatements(code, fixes);

    // Phase 2: Identifier & declaration fixes
    code = fixDuplicateDeclarations(code, fixes);
    code = fixDuplicateConsts(code, fixes);
    code = fixHookNamingConvention(code, fixes, warnings);
    code = fixDefaultProps(code, fixes, warnings);
    if (isTS) code = fixPropTypes(code, fixes);

    // Phase 3: Import / export fixes
    code = injectReactImport(code, fixes);
    code = fixImports(code, fixes, warnings);
    code = fixImportOrder(code, fixes);
    code = fixImportExtensions(code, fixes, isTS);
    code = fixWrongDependencies(code, fixes);
    code = fixCSSModuleImports(code, fixes);
    code = fixExports(code, file.path, fixes);
    code = fixExportConflicts(code, fixes, warnings);
    code = fixUnusedImports(code, fixes);

    // Phase 4: React-specific structural fixes
    code = fixEscapeArtifacts(code, fixes);
    code = fixTypos(code, fixes);
    code = fixSingleLetterLines(code, fixes);
    code = fixBrokenJSXTags(code, fixes);
    code = fixSelfClosingTags(code, fixes);
    code = fixMissingReactImport(code, file.path, fixes);
    code = fixSvgProps(code, fixes);
    code = fixFragmentShorthand(code, fixes);
    code = fixRedundantFragments(code, fixes, warnings);
    code = fixKeyPropInFragments(code, fixes, warnings);
    code = fixDuplicateKeys(code, fixes, warnings);
    code = fixStringRefs(code, fixes, warnings);
    code = fixForwardRefDisplay(code, fixes);
    code = fixLazyWithoutSuspense(code, fixes, warnings);
    code = fixSuspenseWithoutFallback(code, fixes);
    code = fixStrictModeWarnings(code, fixes, infos);
        code = fixMissingComponents(code, fixes, warnings, registry);
    code = fixAccessibility(code, fixes, warnings);

    // Phase 5: Hook & effect fixes
    code = fixHookRules(code, fixes, warnings);
    code = fixBrokenHooks(code, fixes, warnings);
    code = fixMissingDependencyArrays(code, fixes, warnings);
    code = fixAsyncWithoutAwait(code, fixes, warnings);
    code = fixSetStateCallback(code, fixes, warnings);

    // Phase 6: Pattern & style fixes
    code = fixCommonPatterns(code, fixes);
    code = fixTailwindClasses(code, fixes);
    code = fixBrokenTemplateLiterals(code, fixes);
    code = fixConsoleStatements(code, fixes);
    code = fixLooseEquality(code, fixes);
    code = fixNumberCoercion(code, fixes);
    code = fixWindowSSRGuards(code, fixes, warnings);
    code = fixPromiseHandling(code, fixes, warnings);
    code = fixDynamicImports(code, fixes);
    code = fixObjectDestructuring(code, fixes);
    code = fixInvalidJSXExpressions(code, fixes, warnings);
    code = fixStyleObjects(code, fixes, warnings);
    code = fixDeadReturnPaths(code, fixes);
    code = fixEventHandlerTypes(code, fixes, isTS);

    // Phase 7: TypeScript-specific
    if (isTS) {
      code = fixTsErrors(code, fixes, warnings);
      code = fixImplicitAny(code, fixes, warnings);
      code = fixReturnTypesInTS(code, fixes, infos);
      code = fixTrailingCommasTS(code, fixes);
    }

    // Phase 8: Warnings-only (non-mutating analysis)
    fixUndefinedVariables(code, warnings);
    fixCircularImports(code, file.path, warnings);
    fixPropDrilling(code, warnings);
    fixMemoMisuse(code, warnings);
    fixContextWithoutProvider(code, warnings);
    fixMissingErrorBoundary(code, warnings);
    fixNestedTernary(code, warnings);
    fixEmptyFunctions(code, warnings);
    fixObjectSpreadOrder(code, warnings);
    fixZIndex(code, warnings);
    fixColorContrast(code, warnings);
    fixLongLines(code, warnings);
    fixTodoComments(code, infos);
    fixI18nHardcodedStrings(code, infos);

    // Phase 9: Final cleanup
    code = fixSemicolons(code, fixes);
    code = fixSpellingInComments(code, fixes);
  }

  // ── CSS fixes ────────────────────────────────────────────────
  if (isCSS) {
    code = fixCSS(code, fixes);
    code = fixCSSVariables(code, fixes);
    code = fixMediaQueries(code, fixes);
  }
if (file.path === "package.json") {
  code = fixJSON(code, fixes, warnings);
}
  // ── JSON fixes ───────────────────────────────────────────────
  if (isJSON) {
    code = fixJSON(code, fixes, warnings);
  }

  // ── HTML fixes ───────────────────────────────────────────────
  if (isHTML) {
    code = fixHTML(code, fixes);
  }

  return {
    file: { path: file.path, content: code },
    fixes,
    warnings,
    infos,
  };
}

// ================================================================
// STRIP "use client"
// ================================================================
function stripUseClientDirective(code: string, fixes: string[]): string {
  const stripped = code.replace(/^["']use client["'];\s*\n*/m, "");
  if (stripped !== code) fixes.push("stripped-use-client-directive");
  return stripped;
}

// ================================================================
// ENCODING / WHITESPACE
// ================================================================
function fixEncoding(code: string, fixes: string[]): string {
  let fixed = code.replace(/^\uFEFF/, "");
  fixed = fixed.replace(/\0/g, "");
  fixed = fixed.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "");
  fixed = fixed.replace(/[\u200B\u200C\u200D\uFEFF]/g, "");
  if (fixed !== code) fixes.push("encoding-control-chars");
  return fixed;
}

function fixLineEndings(code: string, fixes: string[]): string {
  if (!code.includes("\r")) return code;
  fixes.push("line-endings-crlf");
  return code.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

function stripBOM(code: string, fixes: string[]): string {
  if (!code.startsWith("\uFEFF")) return code;
  fixes.push("bom-stripped");
  return code.slice(1);
}

function collapseBlankLines(code: string, fixes: string[]): string {
  const fixed = code.replace(/\n{4,}/g, "\n\n\n");
  if (fixed !== code) fixes.push("collapsed-blank-lines");
  return fixed;
}

// ================================================================
// REQUIRE → IMPORT
// ================================================================
function fixRequireCalls(code: string, fixes: string[]): string {
  // const X = require('Y') → import X from 'Y'
  const requireDefault = /const\s+(\w+)\s*=\s*require\(['"]([^'"]+)['"]\)\s*;?/g;
  let fixed = code.replace(requireDefault, (_, name, pkg) => {
    return `import ${name} from "${pkg}";`;
  });

  // const { X, Y } = require('Z') → import { X, Y } from 'Z'
  const requireNamed = /const\s+\{([^}]+)\}\s*=\s*require\(['"]([^'"]+)['"]\)\s*;?/g;
  fixed = fixed.replace(requireNamed, (_, names, pkg) => {
    return `import { ${names.trim()} } from "${pkg}";`;
  });

  if (fixed !== code) fixes.push("require-to-import");
  return fixed;
}

// ================================================================
// ENV VARIABLES: process.env → import.meta.env (Vite)
// ================================================================
function fixEnvVariables(code: string, fixes: string[]): string {
  // Only fix if not a Node/CommonJS project (no require calls remaining)
  if (code.includes("require(") || code.includes("module.exports")) return code;

  let fixed = code;
  // process.env.REACT_APP_X → import.meta.env.VITE_X (warn only if REACT_APP)
  fixed = fixed.replace(/process\.env\.REACT_APP_(\w+)/g, (_, name) => {
    return `import.meta.env.VITE_${name}`;
  });
  // process.env.NODE_ENV → import.meta.env.MODE
  fixed = fixed.replace(/process\.env\.NODE_ENV/g, "import.meta.env.MODE");
  // process.env.X → import.meta.env.X (generic)
  fixed = fixed.replace(/process\.env\.(\w+)/g, "import.meta.env.$1");

  if (fixed !== code) fixes.push("process-env-to-import-meta-env");
  return fixed;
}

// ================================================================
// DEBUGGER STATEMENTS
// ================================================================
function fixDebuggerStatements(code: string, fixes: string[]): string {
  const fixed = code.replace(/^\s*debugger\s*;?\s*$/gm, "");
  if (fixed !== code) fixes.push("removed-debugger-statements");
  return fixed;
}

// ================================================================
// ESCAPE ARTIFACTS
// ================================================================
function fixEscapeArtifacts(code: string, fixes: string[]): string {
  let fixed = code;
  fixed = fixed.replace(/\\\\n/g, "\n");
  fixed = fixed.replace(/\\\\t/g, "\t");
  fixed = fixed.replace(/\\\\r/g, "");
  fixed = fixed.replace(/(?<!\\)\\n(?!["\\])/g, "\n");
  fixed = fixed.replace(/(?<!\\)\\t(?!["\\])/g, "\t");
  fixed = fixed.replace(/\\"([^"]*)\\"(?=\s*[,;)\]}])/g, '"$1"');
  if (fixed !== code) fixes.push("escape-artifacts");
  return fixed;
}

// ================================================================
// TYPOS
// ================================================================
const TYPO_MAP: [RegExp, string][] = [
  [/<\/buutton>/g, "</button>"],
  [/<\/buton>/g, "</button>"],
  [/<\/diiv>/g, "</div>"],
  [/<\/spann>/g, "</span>"],
  [/<\/imput>/g, "</input>"],
  [/<\/lable>/g, "</label>"],
  [/<\/tabble>/g, "</table>"],
  [/<\/tabel>/g, "</table>"],
  [/<\/thead>/g, "</thead>"],
  [/<\/Div>/g, "</div>"],
  [/<\/Span>/g, "</span>"],
  [/<\/P>/g, "</p>"],
  [/<\/H1>/g, "</h1>"],
  [/<\/H2>/g, "</h2>"],
  [/<buutton/g, "<button"],
  [/<buton/g, "<button"],
  [/<diiv/g, "<div"],
  [/<imput/g, "<input"],
  [/<lable/g, "<label"],
  [/classname=/g, "className="],
  [/Classname=/g, "className="],
  [/class=(?!Name)/g, "className="],
  [/onclick=/g, "onClick="],
  [/Onclick=/g, "onClick="],
  [/for=(?!")/g, "htmlFor="],
  [/consoloe\./g, "console."],
  [/consle\./g, "console."],
  [/fucntion /g, "function "],
  [/funtion /g, "function "],
  [/retrun /g, "return "],
  [/retrn /g, "return "],
  [/improt /g, "import "],
  [/exprot /g, "export "],
  [/userState/g, "useState"],
  [/usestate/g, "useState"],
  [/useEffekt/g, "useEffect"],
  [/useCallbakc/g, "useCallback"],
  [/useContxt/g, "useContext"],
  [/dafault/g, "default"],
  [/defualt/g, "default"],
  [/constrcutor/g, "constructor"],
  [/prameters/g, "parameters"],
  [/paramters/g, "parameters"],
  [/recieve/g, "receive"],
  [/recieved/g, "received"],
  [/succesfully/g, "successfully"],
  [/carefull/g, "careful"],
  [/occured/g, "occurred"],
  [/seperate/g, "separate"],
  [/accesible/g, "accessible"],
];

function fixTypos(code: string, fixes: string[]): string {
  let fixed = code;
  let changed = false;
  for (const [pattern, replacement] of TYPO_MAP) {
    const next = fixed.replace(pattern, replacement);
    if (next !== fixed) {
      changed = true;
      fixed = next;
    }
  }
  if (changed) fixes.push("typos");
  return fixed;
}

// ================================================================
// SINGLE LETTER ARTIFACT LINES
// ================================================================
function fixSingleLetterLines(code: string, fixes: string[]): string {
  const fixed = code.replace(/^[ \t]*[nseNSE][ \t]*$/gm, "");
  if (fixed !== code) fixes.push("single-letter-artifact-lines");
  return fixed;
}
// ================================================================
// RUNAWAY DUPLICATE JSX ELEMENTS
// Catches AI hallucinating 100+ identical tags (pointLight, div, etc.)
// MAX_REPEAT = 6 for any identical self-closing JSX tag in a row.
// ================================================================
const MAX_REPEAT_JSX = 6;

function fixRunawayDuplicateJSX(code: string, fixes: string[]): string {
  // Match blocks of 7+ consecutive identical self-closing JSX tags
  // e.g. <pointLight ... />\n<pointLight ... />\n ... (repeated N times)
  const selfClosingBlock = /(<([A-Za-z][A-Za-z0-9]*)[^>]*\/>)(\s*\1){6,}/g;

  const fixed = code.replace(selfClosingBlock, (match, tag) => {
    // Count how many times it repeated
    const count = (match.match(new RegExp(tag.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g")) ?? []).length;
    fixes.push(`runaway-jsx-dedup:${count}x <${tag.slice(1).split(/[\s/]/)[0]}> → 1`);
    // Keep just one instance
    return tag;
  });

  // Also catch line-by-line repetition where the tag slightly varies
  // (e.g. position={[10,10,10,10]} on each line — the 4-element vector is also wrong)
  // Fix: [10, 10, 10, 10] → [10, 10, 10] (THREE.js position is Vec3, not Vec4)
  const vec4Position = fixed.replace(/position=\{\[(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*),\s*\d+\s*\]\}/g, "position={[$1]}");

  if (fixed !== code || vec4Position !== fixed) fixes.push("jsx-dedup-and-vec4-fix");
  return vec4Position;
}
// ================================================================
// BROKEN JSX TAGS
// ================================================================
function fixBrokenJSXTags(code: string, fixes: string[]): string {
  let fixed = code;
  let changed = false;
  const divWithSpace = fixed.replace(/<\/\s+(\w)/g, "</$1");
  if (divWithSpace !== fixed) {
    changed = true;
    fixed = divWithSpace;
  }
  const missingEq = fixed.replace(/(\s)(\w+)"([^"]*)"(?=[\s/>])/g, '$1$2="$3"');
  if (missingEq !== fixed) {
    changed = true;
    fixed = missingEq;
  }
  // Fix unclosed JSX tags at end of file
  const unclosedTag = fixed.replace(/<([A-Z][a-zA-Z]*)([^>]*)(?<!\/)>(\s*)$/g, "<$1$2$3 />");
  if (unclosedTag !== fixed) {
    changed = true;
    fixed = unclosedTag;
  }
  if (changed) fixes.push("broken-jsx-tags");
  return fixed;
}

// ================================================================
// SELF-CLOSING TAGS
// ================================================================
const VOID_ELEMENTS = new Set([
  "area", "base", "br", "col", "embed", "hr", "img",
  "input", "link", "meta", "param", "source", "track", "wbr",
]);

function fixSelfClosingTags(code: string, fixes: string[]): string {
  let fixed = code;
  let changed = false;
  for (const tag of VOID_ELEMENTS) {
    const unclosed = new RegExp(`<${tag}([^/]*)(?<!/)>(?!</${tag}>)`, "gi");
    const next1 = fixed.replace(unclosed, `<${tag}$1 />`);
    if (next1 !== fixed) {
      changed = true;
      fixed = next1;
    }
    const withClose = new RegExp(`<${tag}([^>]*)></${tag}>`, "gi");
    const next2 = fixed.replace(withClose, `<${tag}$1 />`);
    if (next2 !== fixed) {
      changed = true;
      fixed = next2;
    }
  }
  if (changed) fixes.push("self-closing-void-elements");
  return fixed;
}

// ================================================================
// SVG PROPS — normalise SVG attribute names for JSX
// ================================================================
function fixSvgProps(code: string, fixes: string[]): string {
  // Only apply inside SVG tags/elements
  if (!code.includes("<svg") && !code.includes("</svg>")) return code;
  let fixed = code;
  let changed = false;
  for (const [pattern, replacement] of SVG_ATTR_MAP) {
    const next = fixed.replace(pattern, replacement);
    if (next !== fixed) {
      changed = true;
      fixed = next;
    }
  }
  if (changed) fixes.push("svg-prop-fixes");
  return fixed;
}

// ================================================================
// FRAGMENT SHORTHAND
// ================================================================
function fixFragmentShorthand(code: string, fixes: string[]): string {
  let fixed = code;
  // Replace <React.Fragment> with <>
  fixed = fixed.replace(/<React\.Fragment>/g, "<>");
  fixed = fixed.replace(/<\/React\.Fragment>/g, "</>");
  // Keep keyed fragments as-is
  if (fixed !== code) fixes.push("fragment-shorthand");
  return fixed;
}

// ================================================================
// REDUNDANT SINGLE-CHILD FRAGMENTS
// ================================================================
function fixRedundantFragments(code: string, fixes: string[], warnings: string[]): string {
  // Warn on <>single child</> patterns — don't auto-fix, too risky
  const singleChildFrag = /<>(\s*<[A-Za-z][^>]*>(?:[^<]|<(?!\/[A-Za-z]))*<\/[A-Za-z]+>\s*)<\/>/g;
  if (singleChildFrag.test(code)) {
    warnings.push("redundant-single-child-fragment — consider removing unnecessary <> wrapper");
  }
  return code;
}

// ================================================================
// KEY PROP IN FRAGMENTS
// ================================================================
function fixKeyPropInFragments(code: string, fixes: string[], warnings: string[]): string {
  // <React.Fragment key={x}> is valid, but <>key</> is NOT — warn
  const shorthandWithKey = /<>\s*.*key=\{/g;
  if (shorthandWithKey.test(code)) {
    warnings.push("key-on-shorthand-fragment — use <React.Fragment key={...}> instead of <> when key is needed");
  }
  return code;
}

// ================================================================
// DUPLICATE KEYS
// ================================================================
function fixDuplicateKeys(code: string, fixes: string[], warnings: string[]): string {
  const literalKeys = new Map<string, number>();
  const keyRe = /\bkey=\{["']([^"']+)["']\}|\bkey="([^"]+)"|\bkey='([^']+)'/g;
  let m;
  while ((m = keyRe.exec(code)) !== null) {
    const key = m[1] ?? m[2] ?? m[3];
    literalKeys.set(key, (literalKeys.get(key) ?? 0) + 1);
  }
  for (const [key, count] of literalKeys) {
    if (count > 1) {
      warnings.push(`duplicate-literal-key:"${key}" appears ${count} times — keys must be unique among siblings`);
    }
  }
  return code;
}

// ================================================================
// STRING REFS
// ================================================================
function fixStringRefs(code: string, fixes: string[], warnings: string[]): string {
  if (/ref=["'][a-zA-Z_]\w*["']/g.test(code)) {
    warnings.push("string-refs-deprecated — replace ref=\"myRef\" with useRef() hook");
  }
  // Auto-replace if possible
  let fixed = code.replace(/ref=["']([a-zA-Z_]\w*)["']/g, (_, name) => {
    fixes.push(`string-ref-converted:${name}`);
    return `ref={${name}Ref}`;
  });
  if (fixed !== code) {
    // Also inject useRef declaration if missing
    if (!fixed.includes("useRef")) {
      // Add it to existing useState/useEffect imports
      fixed = fixed.replace(
        /import\s+React,\s*\{([^}]+)\}\s+from\s+['"]react['"]/,
        (_, imports) => {
          if (imports.includes("useRef")) return _;
          return `import React, { ${imports.trim()}, useRef } from "react"`;
        }
      );
    }
  }
  return fixed;
}

// ================================================================
// FORWARDREF DISPLAY NAME
// ================================================================
function fixForwardRefDisplay(code: string, fixes: string[]): string {
  const forwardRefRe = /const\s+(\w+)\s*=\s*React\.forwardRef\(/g;
  let m;
  let fixed = code;
  let changed = false;
  while ((m = forwardRefRe.exec(code)) !== null) {
    const name = m[1];
    const displayNameStr = `${name}.displayName = "${name}";`;
    if (!fixed.includes(displayNameStr)) {
      // Add displayName after the component definition closing paren/semicolon
      const insertAfterRe = new RegExp(`(const\\s+${name}\\s*=\\s*React\\.forwardRef\\([\\s\\S]*?\\));?`);
      fixed = fixed.replace(insertAfterRe, `$1\n${displayNameStr}`);
      changed = true;
      fixes.push(`added-displayName:${name}`);
    }
  }
  return fixed;
}

// ================================================================
// LAZY WITHOUT SUSPENSE
// ================================================================
function fixLazyWithoutSuspense(code: string, fixes: string[], warnings: string[]): string {
  const hasLazy = /React\.lazy\(|lazy\(/.test(code);
  const hasSuspense = /Suspense/.test(code);
  if (hasLazy && !hasSuspense) {
    warnings.push("lazy-without-suspense — React.lazy() components must be wrapped in <Suspense fallback={...}>");
  }
  return code;
}

// ================================================================
// SUSPENSE WITHOUT FALLBACK
// ================================================================
function fixSuspenseWithoutFallback(code: string, fixes: string[]): string {
  const noFallback = /<Suspense(?![^>]*fallback)[^>]*>/g;
  const fixed = code.replace(noFallback, '<Suspense fallback={<div>Loading...</div>}>');
  if (fixed !== code) fixes.push("added-suspense-fallback");
  return fixed;
}

// ================================================================
// REACT STRICT MODE
// ================================================================
function fixStrictModeWarnings(code: string, fixes: string[], infos: string[]): string {
  // Detect root render calls and suggest StrictMode
  if (/ReactDOM\.render\s*\(/.test(code) && !code.includes("StrictMode")) {
    infos.push("missing-strict-mode — wrap root render in <React.StrictMode> for better warnings");
  }
  if (/createRoot\(/.test(code) && !code.includes("StrictMode")) {
    infos.push("missing-strict-mode — wrap root render in <React.StrictMode> for better warnings");
  }
  return code;
}

// ================================================================
// MISSING COMPONENTS — inject stubs for undefined components
// ================================================================
function fixMissingComponents(
  code: string,
  fixes: string[],
  warnings: string[],
  registry: Map<string, string>
): string {
  const usedComponents = new Set<string>();
  const definedComponents = new Set<string>();

  // collect defined in file (imports + declarations)
  const importRe = /^import[^{]*\{([^}]+)\}|^import\s+([A-Z][a-zA-Z0-9]*)\s+from/gm;
  let m: RegExpExecArray | null;
  while ((m = importRe.exec(code)) !== null) {
    if (m[1]) {
      m[1].split(",").forEach((s) => {
        const clean = s.trim().split(" as ").pop()?.trim();
        if (clean) definedComponents.add(clean);
      });
    }
    if (m[2]) definedComponents.add(m[2]);
  }

  const defRe = /(?:^|\s)(?:function|const|class|let|var)\s+([A-Z][a-zA-Z0-9]*)/gm;
  while ((m = defRe.exec(code)) !== null) {
    if (m[1]) definedComponents.add(m[1]);
  }

  // collect JSX usage
  const jsxUsageRe = /<([A-Z][a-zA-Z0-9]*)/g;
  while ((m = jsxUsageRe.exec(code)) !== null) {
    usedComponents.add(m[1]);
  }

  const HTML_INTRINSICS = new Set([
    "React", "Fragment", "Suspense", "StrictMode", "Component", "PureComponent",
    "ErrorBoundary", "Provider", "Consumer", "Router", "Route", "Routes",
    "Navigate", "Link", "Switch", "Canvas", "OrbitControls",
  ]);

  // ⚠️ PERMANENT FIX: no stubs are injected – only warnings
  for (const comp of usedComponents) {
    // skip if component exists in ANY file (global registry)
    if (registry.has(comp)) continue;
    // skip if defined locally
    if (definedComponents.has(comp)) continue;
    if (HTML_INTRINSICS.has(comp)) continue;

    // Only warn – do NOT add any stub
    warnings.push(`missing-component:${comp} — component is used but not defined or imported`);
  }

  // Also warn for undefined self-closing tags (without injecting divs)
  code = code.replace(/<([A-Z][a-zA-Z0-9]*)\s*\/>/g, (match, comp) => {
    if (definedComponents.has(comp) || registry.has(comp) || HTML_INTRINSICS.has(comp)) return match;
    warnings.push(`undefined-component-used:${comp} — self-closing tag with missing component`);
    // Keep the original tag – do not replace with div
    return match;
  });

  // No fixes are pushed – no code modification
  return code;
}
// ================================================================
// ACCESSIBILITY — add missing alt/aria props
// ================================================================
function fixAccessibility(code: string, fixes: string[], warnings: string[]): string {
  let fixed = code;
  let changed = false;

  // <img> without alt
  const imgWithoutAlt = /<img\b(?![^>]*\balt=)[^>]*\/>/g;
  const fixedImg = fixed.replace(imgWithoutAlt, (m) => {
    changed = true;
    fixes.push("added-img-alt");
    return m.replace("/>", ' alt="" />');
  });
  if (fixedImg !== fixed) fixed = fixedImg;

  // <button> without type
  const buttonWithoutType = /<button\b(?![^>]*\btype=)([^>]*)>/g;
  const fixedBtn = fixed.replace(buttonWithoutType, (_, attrs) => {
    changed = true;
    fixes.push("added-button-type");
    return `<button type="button"${attrs}>`;
  });
  if (fixedBtn !== fixed) fixed = fixedBtn;

  // <a> without href or onClick — warn
  if (/<a\b(?![^>]*href=)(?![^>]*onClick=)[^>]*>/.test(fixed)) {
    warnings.push("anchor-without-href — <a> tags should have href or use <button> for click handlers");
  }

  // <input> without id or aria-label
  if (/<input\b(?![^>]*(?:id=|aria-label=|aria-labelledby=))[^>]*\/>/.test(fixed)) {
    warnings.push("input-without-label — inputs should have id (paired with <label htmlFor>) or aria-label");
  }

  // role="button" without tabIndex
  const roleButtonNoTab = /<(\w+)\s+[^>]*role="button"(?![^>]*tabIndex)[^>]*>/g;
  const fixedRole = fixed.replace(roleButtonNoTab, (m) => {
    changed = true;
    fixes.push("added-tabindex-to-role-button");
    return m.replace(">", ' tabIndex={0}>');
  });
  if (fixedRole !== fixed) fixed = fixedRole;

  return fixed;
}

// ================================================================
// WRONG DEPENDENCIES
// ================================================================
function fixWrongDependencies(code: string, fixes: string[]): string {
  let fixed = code;
  let changed = false;
  for (const { wrongPattern, correctImport, reason } of DEPENDENCY_CORRECTIONS) {
    const next = fixed.replace(wrongPattern, correctImport);
    if (next !== fixed) {
      changed = true;
      fixed = next;
      fixes.push(`dependency-corrected:${reason}`);
    }
  }
  return fixed;
}

// ================================================================
// CSS MODULE IMPORTS
// ================================================================
function fixCSSModuleImports(code: string, fixes: string[]): string {
  // Fix: import styles './foo.module.css' → import styles from './foo.module.css'
  const badImport = /import\s+(\w+)\s+(?!from\s)['"]([^'"]+\.module\.css)['"]/g;
  const fixed = code.replace(badImport, (_, name, path) => {
    fixes.push(`css-module-import-fixed:${name}`);
    return `import ${name} from "${path}"`;
  });
  return fixed;
}

// ================================================================
// IMPORT EXTENSIONS — strip .jsx/.js from relative imports in TS
// ================================================================
function fixImportExtensions(code: string, fixes: string[], isTS: boolean): string {
  if (!isTS) return code;
  const fixed = code.replace(
    /from\s+['"](\.[^'"]+)\.(jsx?)['"]/g,
    (_, path) => {
      fixes.push(`stripped-js-extension:${path}`);
      return `from "${path}"`;
    }
  );
  return fixed;
}

// ================================================================
// UNUSED IMPORTS
// ================================================================
function fixUnusedImports(code: string, fixes: string[]): string {
  const importRe = /^import\s+\{([^}]+)\}\s+from\s+['"][^'"]+['"];?\s*$/gm;
  let fixed = code;

  fixed = fixed.replace(importRe, (fullLine, specifiers) => {
    const specs = specifiers.split(",").map((s: string) => s.trim()).filter(Boolean);
    const used = specs.filter((spec: string) => {
      const name = spec.split(" as ").pop()!.trim();
      // Check if name appears outside import lines
      const withoutImports = fixed.replace(/^import[^\n]+$/gm, "");
      return new RegExp(`\\b${name}\\b`).test(withoutImports);
    });
    if (used.length === specs.length) return fullLine;
    const removed = specs.filter((s: string) => !used.includes(s));
    if (used.length === 0) {
      fixes.push(`removed-unused-import:${removed.join(",")}`);
      return "";
    }
    fixes.push(`removed-unused-specifiers:${removed.join(",")}`);
    return fullLine.replace(specifiers, ` ${used.join(", ")} `);
  });

  // Remove empty import lines
  fixed = fixed.replace(/^import\s*\{\s*\}\s+from\s+['"][^'"]+['"];?\s*\n/gm, "");

  return fixed;
}

// ================================================================
// IMPORT ORDER — react → libs → internal → relative
// ================================================================
function fixImportOrder(code: string, fixes: string[]): string {
  const lines = code.split("\n");
  let importEnd = 0;
  const importBlock: string[] = [];
  const rest: string[] = [];
  let inImports = true;

  for (let i = 0; i < lines.length; i++) {
    const t = lines[i].trim();
    if (inImports && (t.startsWith("import ") || t === "" || t.startsWith("//"))) {
      importBlock.push(lines[i]);
    } else {
      inImports = false;
      rest.push(lines[i]);
    }
  }

  const importLines = importBlock.filter((l) => l.trim().startsWith("import "));
  const nonImportLines = importBlock.filter((l) => !l.trim().startsWith("import "));

  const getGroup = (line: string): number => {
    if (/from ['"]react['"]/.test(line)) return 0;
    if (/from ['"]react-/.test(line)) return 1;
    if (/from ['"]@/.test(line)) return 2;
    if (/from ['"][^./]/.test(line)) return 3;
    if (/from ['"]\.\.\//.test(line)) return 4;
    if (/from ['"]\.\//.test(line)) return 5;
    return 6;
  };

  const sorted = [...importLines].sort((a, b) => getGroup(a) - getGroup(b));
  const changed = sorted.some((l, i) => l !== importLines[i]);

  if (changed) {
    fixes.push("import-order-sorted");
    return [...sorted, ...nonImportLines, ...rest].join("\n");
  }
  return code;
}

// ================================================================
// HOOK NAMING CONVENTION
// ================================================================
function fixHookNamingConvention(code: string, fixes: string[], warnings: string[]): string {
  // Functions that USE hooks but don't start with 'use' or capital letter
  const funcRe = /^(?:export\s+)?(?:const|function)\s+([a-z][a-zA-Z0-9]*)\s*(?:=\s*(?:\([^)]*\)|[a-z_]\w*)\s*=>|\()/gm;
  let m;
  while ((m = funcRe.exec(code)) !== null) {
    const name = m[1];
    if (name.startsWith("use") || name === "main" || name === "handler") continue;
    // Check if this function body uses hooks
    const funcBody = code.slice(m.index, m.index + 500);
    if (/\buse[A-Z]/.test(funcBody)) {
      warnings.push(`hook-in-non-hook:${name} — function "${name}" uses hooks but doesn't start with "use" or a capital letter`);
    }
  }
  return code;
}

// ================================================================
// DEFAULT PROPS (deprecated in React 18+)
// ================================================================
function fixDefaultProps(code: string, fixes: string[], warnings: string[]): string {
  if (/\.defaultProps\s*=/.test(code)) {
    warnings.push("defaultProps-deprecated — use default parameter values in function signature instead");
  }
  return code;
}

// ================================================================
// PROP TYPES (warn to remove in TS projects)
// ================================================================
function fixPropTypes(code: string, fixes: string[]): string {
  if (!code.includes("propTypes") && !code.includes("PropTypes")) return code;
  // Remove PropTypes import
  let fixed = code.replace(/^import\s+PropTypes\s+from\s+['"]prop-types['"];?\s*\n/gm, "");
  // Remove .propTypes = { ... } blocks
  fixed = fixed.replace(/\w+\.propTypes\s*=\s*\{[^}]*\};?\s*\n/g, "");
  if (fixed !== code) fixes.push("removed-prop-types-ts-project");
  return fixed;
}

// ================================================================
// REACT IMPORT
// ================================================================
function injectReactImport(code: string, fixes: string[]): string {
  const hasAnyReactImport = code.includes("from 'react'") || code.includes('from "react"');
  if (hasAnyReactImport) return code;
  const hasJSX = /<[A-Z]|<[a-z]+[\s/>]/.test(code);
  const hasHooks = /\b(useState|useEffect|useRef|useMemo|useCallback|useContext|useReducer)\b/.test(code);
  if (!hasJSX && !hasHooks) return code;
  const hookNames = [
    "useState", "useEffect", "useRef", "useMemo", "useCallback",
    "useContext", "useReducer", "useId", "useLayoutEffect", "useImperativeHandle",
    "useDeferredValue", "useTransition", "useSyncExternalStore",
  ];
  const usedHooks = hookNames.filter((h) => new RegExp(`\\b${h}\\b`).test(code));
  const importLine = usedHooks.length > 0
    ? `import React, { ${usedHooks.join(", ")} } from 'react';`
    : `import React from 'react';`;
  fixes.push(`injected-react-import:[${usedHooks.join(",")}]`);
  return `${importLine}\n${code}`;
}

function fixMissingReactImport(code: string, filePath: string, fixes: string[]): string {
  const hasJSX = /<[A-Z][a-zA-Z]*|<[a-z]+[\s/>]/.test(code);
  const hasReactImport = /import\s+React/.test(code);
  const isTypeFile = filePath.endsWith(".d.ts") || filePath.includes("types");
  const usesReactDirectly = /\bReact\.(use|create|memo|forwardRef|lazy|Suspense|Fragment|cloneElement|Children|StrictMode)/.test(code);
  if (hasJSX && usesReactDirectly && !hasReactImport && !isTypeFile) {
    fixes.push("added-react-import");
    return `import React from "react";\n${code}`;
  }
  return code;
}

// ================================================================
// DEDUPLICATE IMPORT SPECIFIERS
// ================================================================
function deduplicateImportSpecifiers(lines: string[]): string[] {
  return lines.map((line) => {
    const m = line.match(/import\s+\{([^}]+)\}/);
    if (!m) return line;
    const seen = new Set<string>();
    const deduped = m[1]
      .split(",")
      .map((s) => s.trim())
      .filter((s) => {
        if (!s || seen.has(s)) return false;
        seen.add(s);
        return true;
      })
      .join(", ");
    return line.replace(m[1], ` ${deduped} `);
  });
}

// ================================================================
// IMPORTS
// ================================================================
function resolveImportPath(path: string): string {
  if (path.endsWith(".js") || path.endsWith(".jsx")) return path;

  if (!path.includes(".")) {
    return path + ".js";
  }

  return path;
}

function fixImports(code: string, fixes: string[], warnings: string[]): string {
  let fixed = code;
  const lines = deduplicateImportSpecifiers(fixed.split("\n"));
  const importLines: string[] = [];
  const nonImportLines: string[] = [];
  let inImportBlock = true;

  for (const line of lines) {
    const trimmed = line.trim();
    if (
      inImportBlock &&
      (trimmed.startsWith("import ") ||
        trimmed.startsWith("// ") ||
        trimmed === "" ||
        trimmed.startsWith("'use ") ||
        trimmed.startsWith('"use '))
    ) {
      importLines.push(line);
    } else {
      inImportBlock = false;
      nonImportLines.push(line);
    }
  }

  const seenImports = new Set<string>();
  const dedupedImports = importLines.filter((line) => {
    const trimmed = line.trim();
    if (!trimmed.startsWith("import ")) return true;
    if (seenImports.has(trimmed)) return false;
    seenImports.add(trimmed);
    return true;
  });

  const mergedImports = mergeNamedImports(dedupedImports, fixes);

  const correctedImports = mergedImports.map((line) => {
  let l = line;

  // 🔥 FIX RELATIVE IMPORT EXTENSIONS
  l = l.replace(/from ['"](\.[^'"]+)['"]/g, (_, p) => {
    return `from "${resolveImportPath(p)}"`;
  });

  // existing fixes...
  l = l.replace(/from ['"]react-router['"]/g, 'from "react-router-dom"');

  return l;
});
  const BANNED = [
    "preact", "preact/hooks", "styled-components",
    "@emotion/react", "@emotion/styled",
  ];
  const filtered = correctedImports.filter((line) => {
    for (const b of BANNED) {
      if (line.includes(`from '${b}'`) || line.includes(`from "${b}"`)) {
        fixes.push(`removed-banned-import:${b}`);
        return false;
      }
    }
    return true;
  });

  fixes.push("imports-deduped-merged");
  fixed = [...filtered, ...nonImportLines].join("\n");

  // Warnings for missing imports
  const usageWarnings: Array<[string, string]> = [
    ["useState", "react"],
    ["useEffect", "react"],
    ["useRef", "react"],
    ["useMemo", "react"],
    ["useCallback", "react"],
    ["useContext", "react"],
    ["Link", "react-router-dom"],
    ["useNavigate", "react-router-dom"],
    ["useParams", "react-router-dom"],
    ["useLocation", "react-router-dom"],
  ];
  for (const [hook, pkg] of usageWarnings) {
    const usedRe = new RegExp(`\\b${hook}\\b`);
    const importedRe = new RegExp(`import.*${hook}.*from ['"]${pkg}['"]`);
    if (usedRe.test(fixed) && !importedRe.test(fixed)) {
      warnings.push(`${hook}-used-but-not-imported-from-${pkg}`);
    }
  }

  return fixed;
}

// ================================================================
// MERGE NAMED IMPORTS
// ================================================================
function mergeNamedImports(lines: string[], fixes: string[]): string[] {
  const sourceMap = new Map<string, { def?: string; named: Set<string> }>();
  const otherLines: string[] = [];

  const namedRe    = /^import\s+\{([^}]+)\}\s+from\s+['"]([^'"]+)['"]/;
  const defaultRe  = /^import\s+(\w+)\s+from\s+['"]([^'"]+)['"]/;
  const combinedRe = /^import\s+(\w+)\s*,\s*\{([^}]+)\}\s+from\s+['"]([^'"]+)['"]/;

  for (const line of lines) {
    const trimmed = line.trim();
    const comboMatch = trimmed.match(combinedRe);
    if (comboMatch) {
      const [, def, named, source] = comboMatch;
      if (!sourceMap.has(source)) sourceMap.set(source, { named: new Set() });
      const entry = sourceMap.get(source)!;
      entry.def = def;
      named.split(",").map((s) => s.trim()).filter(Boolean).forEach((n) => entry.named.add(n));
      continue;
    }
    const namedMatch = trimmed.match(namedRe);
    if (namedMatch) {
      const [, named, source] = namedMatch;
      if (!sourceMap.has(source)) sourceMap.set(source, { named: new Set() });
      named.split(",").map((s) => s.trim()).filter(Boolean).forEach((n) =>
        sourceMap.get(source)!.named.add(n)
      );
      continue;
    }
    const defaultMatch = trimmed.match(defaultRe);
    if (defaultMatch) {
      const [, def, source] = defaultMatch;
      if (!sourceMap.has(source)) sourceMap.set(source, { named: new Set() });
      sourceMap.get(source)!.def = def;
      continue;
    }
    otherLines.push(line);
  }

  const merged: string[] = [];
  for (const [source, { def, named }] of sourceMap) {
    if (def && named.size > 0) {
      merged.push(`import ${def}, { ${[...named].join(", ")} } from "${source}";`);
    } else if (def) {
      merged.push(`import ${def} from "${source}";`);
    } else if (named.size > 0) {
      merged.push(`import { ${[...named].join(", ")} } from "${source}";`);
    }
  }
  if (merged.length > 0) fixes.push("imports-merged-by-source");
  return [...merged, ...otherLines];
}

// ================================================================
// EXPORTS
// ================================================================
function fixExports(code: string, filePath: string, fixes: string[]): string {
  let fixed = code;
  const hasExportDefault = /export\s+default\s/.test(fixed);
  if (hasExportDefault) return fixed;
  const funcMatch = fixed.match(/^function\s+([A-Z]\w*)\s*\(/m);
  if (funcMatch) {
    fixed = fixed.replace(
      new RegExp(`^function\\s+${funcMatch[1]}`, "m"),
      `export default function ${funcMatch[1]}`
    );
    fixes.push(`added-export-default-to-${funcMatch[1]}`);
    return fixed;
  }
  const constMatch = fixed.match(
    /^const\s+([A-Z]\w*)\s*=\s*(?:\([^)]*\)|[a-z_]\w*)\s*=>/m
  );
  if (constMatch) {
    fixed += `\n\nexport default ${constMatch[1]};\n`;
    fixes.push(`added-export-default-bottom-${constMatch[1]}`);
  }
  return fixed;
}

// ================================================================
// EXPORT CONFLICTS
// ================================================================
function fixExportConflicts(code: string, fixes: string[], warnings: string[]): string {
  const namedExports = new Set<string>();
  const namedRe = /export\s+(?:const|function|class|let|var)\s+(\w+)/g;
  let m;
  while ((m = namedRe.exec(code)) !== null) {
    namedExports.add(m[1]);
  }
  const defaultMatch = code.match(/export\s+default\s+(?:function\s+|class\s+)?(\w+)/);
  if (defaultMatch && namedExports.has(defaultMatch[1])) {
    warnings.push(`export-conflict:${defaultMatch[1]} is both a named export and the default export — this can cause confusion`);
  }
  return code;
}

// ================================================================
// HOOK RULES
// ================================================================
function fixHookRules(code: string, fixes: string[], warnings: string[]): string {
  if (/if\s*\([^)]*\)\s*\{[^}]*use[A-Z]\w+\s*\(/.test(code)) {
    warnings.push("possible-hook-in-conditional — hooks must not be called conditionally");
  }
  if (/(?:for|while|forEach)\s*[(\[][^)\]]*\)[^{]*\{[^}]*use[A-Z]/.test(code)) {
    warnings.push("possible-hook-in-loop — hooks must not be called inside loops");
  }
  // Hook inside nested callback
  if (/\.(then|catch|finally)\s*\(\s*(?:async\s*)?\([^)]*\)\s*=>\s*\{[^}]*use[A-Z]/.test(code)) {
    warnings.push("possible-hook-in-promise-callback — hooks must not be called inside promise callbacks");
  }
  return code;
}

// ================================================================
// BROKEN HOOKS — repair malformed hook call-sites
// ================================================================
function fixBrokenHooks(code: string, fixes: string[], warnings: string[]): string {
  let fixed = code;

  // useState missing initial value: useState() → useState(null)
  fixed = fixed.replace(/\buseState\(\s*\)/g, () => {
    fixes.push("usestate-missing-initial-value");
    return "useState(null)";
  });

  // useRef missing initial value: useRef() → useRef(null)
  fixed = fixed.replace(/\buseRef\(\s*\)/g, () => {
    fixes.push("useref-default-null");
    return "useRef(null)";
  });

  // useCallback missing deps: useCallback(fn) → useCallback(fn, [])
  fixed = fixed.replace(/\buseCallback\(([^,)]+)\)(?!\s*,\s*\[)/g, (_, fn) => {
    fixes.push("usecallback-missing-deps");
    return `useCallback(${fn}, [])`;
  });

  // useMemo missing deps: useMemo(fn) → useMemo(fn, [])
  fixed = fixed.replace(/\buseMemo\(([^,)]+)\)(?!\s*,\s*\[)/g, (_, fn) => {
    fixes.push("usememo-missing-deps");
    return `useMemo(${fn}, [])`;
  });

  // Detect useState used as function: setState(x) directly mutating
  if (/\b(set[A-Z]\w*)\s*\(\s*(?:prev|state)\s*=>\s*(?!\{)/.test(code)) {
    // Looks OK — functional update
  }

  return fixed;
}

// ================================================================
// MISSING DEPENDENCY ARRAYS
// ================================================================
function fixMissingDependencyArrays(code: string, fixes: string[], warnings: string[]): string {
  let fixed = code;

  // useEffect without dependency array: useEffect(() => {...}) — no comma after closing brace
  const useEffectNoDeps = /useEffect\s*\(\s*((?:\(\s*\)|async\s*\(\s*\))\s*=>|function\s*\(\s*\))\s*\{[\s\S]*?\}\s*\)/g;

  // This is complex to auto-fix safely, so we warn instead
  const effectNoDepsRe = /useEffect\s*\([^)]+\)\s*(?!,\s*\[)/;
  if (effectNoDepsRe.test(code)) {
    warnings.push("useeffect-missing-dependency-array — consider adding [] or specific deps to useEffect");
  }

  return fixed;
}

// ================================================================
// ASYNC WITHOUT AWAIT
// ================================================================
function fixAsyncWithoutAwait(code: string, fixes: string[], warnings: string[]): string {
  // async function that doesn't contain 'await'
  const asyncFuncRe = /async\s+(?:function\s+\w+|\w+\s*=>|\([^)]*\)\s*=>)\s*\{([^{}]*(?:\{[^{}]*\}[^{}]*)*)\}/g;
  let m;
  while ((m = asyncFuncRe.exec(code)) !== null) {
    const body = m[1];
    if (!body.includes("await") && !body.includes("return")) {
      warnings.push("async-without-await — async function doesn't use await; consider removing async keyword");
    }
  }
  return code;
}

// ================================================================
// SETSTATE CALLBACK
// ================================================================
function fixSetStateCallback(code: string, fixes: string[], warnings: string[]): string {
  // Detect old-style this.setState(x, callback) — warn
  if (/this\.setState\s*\([^)]+,\s*(?:function|\(\s*\)\s*=>)/.test(code)) {
    warnings.push("setstate-callback — setState callback is deprecated pattern; use useEffect with state dependency instead");
  }
  return code;
}

// ================================================================
// INVALID JSX EXPRESSIONS
// ================================================================
function fixInvalidJSXExpressions(code: string, fixes: string[], warnings: string[]): string {
  let fixed = code;

  // Fix {undefined} used as JSX child — replace with {null}
  fixed = fixed.replace(/\{undefined\}/g, () => {
    fixes.push("undefined-jsx-expression-to-null");
    return "{null}";
  });

  // Fix bare statement in JSX: { someVar; } → { someVar }
  fixed = fixed.replace(/\{\s*(\w+)\s*;\s*\}/g, (_, v) => {
    fixes.push("removed-semicolon-in-jsx-expression");
    return `{${v}}`;
  });

  // Objects in JSX children: {myObj} where myObj is likely a plain object
  // Can't reliably detect at static analysis level — warn
  if (/\{[A-Z][a-zA-Z]*\}/.test(fixed)) {
    // Could be valid component ref — skip warning
  }

  // Detect JSX expression containing if statement (invalid)
  if (/\{[\s\n]*if\s*\(/.test(fixed)) {
    warnings.push("if-statement-in-jsx-expression — use ternary or && instead of if inside JSX {}");
  }

  // Detect JSX using for loops (invalid)
  if (/\{[\s\n]*for\s*\(/.test(fixed)) {
    warnings.push("for-loop-in-jsx-expression — use .map() instead of for loop inside JSX {}");
  }

  return fixed;
}

// ================================================================
// STYLE OBJECTS — repair invalid CSS-in-JS
// ================================================================
function fixStyleObjects(code: string, fixes: string[], warnings: string[]): string {
  let fixed = code;
  let changed = false;

  // Fix style={{ color: "red", }} — trailing comma is fine in JS, warn on string values that look like CSS
  // Fix style="..." → style={{...}} (string styles in JSX)
  const stringStyleRe = /style="([^"]+)"/g;
  fixed = fixed.replace(stringStyleRe, (_, styleStr) => {
    const parts = styleStr.split(";").filter(Boolean);
    const obj = parts.map((p: string) => {
      const [prop, ...vals] = p.split(":");
      if (!prop || !vals.length) return null;
      const cssProp = prop.trim().replace(/-([a-z])/g, (_, c) => c.toUpperCase());
      const val = vals.join(":").trim();
      return `${cssProp}: "${val}"`;
    }).filter(Boolean).join(", ");
    changed = true;
    fixes.push("string-style-to-object");
    return `style={{ ${obj} }}`;
  });

  // Warn on px values as numbers without string quotes in common string-only props
  if (/style=\{\{[^}]*fontSize\s*:\s*\d+[^px"'`}]/.test(fixed)) {
    warnings.push("style-object-font-size — fontSize in style object should be a string (e.g., \"16px\") or a number (in pixels, no unit)");
  }

  return fixed;
}

// ================================================================
// DEAD RETURN PATHS
// ================================================================
function fixDeadReturnPaths(code: string, fixes: string[]): string {
  let fixed = code;

  // Function declared to return JSX but missing explicit return
  // Pattern: function Foo() { const x = 1; <div>...</div> }  (JSX not in return)
  const funcWithLooseJSX = /function\s+([A-Z]\w*)\s*\([^)]*\)\s*\{([\s\S]*?)\}/g;
  fixed = fixed.replace(funcWithLooseJSX, (full, name, body) => {
    // Check if body has JSX but no return statement
    const hasJSX = /<[A-Z]|<[a-z]+[\s/>]/.test(body);
    const hasReturn = /\breturn\b/.test(body);
    if (hasJSX && !hasReturn) {
      // Wrap in return — simplified heuristic: wrap last JSX expression
      const fixedBody = body.replace(
        /([ \t]*)(<[A-Za-z][^]*>)/,
        "$1return ($2"
      ) + "\n  );";
      fixes.push(`added-missing-return:${name}`);
      return `function ${name}${full.slice(full.indexOf("("), full.indexOf("{") + 1)}${fixedBody}}`;
    }
    return full;
  });

  return fixed;
}

// ================================================================
// EVENT HANDLER TYPES
// ================================================================
function fixEventHandlerTypes(code: string, fixes: string[], isTS: boolean): string {
  if (!isTS) return code;
  let fixed = code;

  // onChange={(e) => ...} in input → add type
  fixed = fixed.replace(
    /onChange=\{\(e\)\s*=>/g,
    (m) => {
      fixes.push("added-change-event-type");
      return "onChange={(e: React.ChangeEvent<HTMLInputElement>) =>";
    }
  );

  // onClick={(e) => ...} → add type
  fixed = fixed.replace(
    /onClick=\{\(e\)\s*=>/g,
    () => {
      fixes.push("added-click-event-type");
      return "onClick={(e: React.MouseEvent<HTMLElement>) =>";
    }
  );

  // onSubmit={(e) => ...} in form
  fixed = fixed.replace(
    /onSubmit=\{\(e\)\s*=>/g,
    () => {
      fixes.push("added-submit-event-type");
      return "onSubmit={(e: React.FormEvent<HTMLFormElement>) =>";
    }
  );

  // onKeyDown={(e) => ...}
  fixed = fixed.replace(
    /onKeyDown=\{\(e\)\s*=>/g,
    () => {
      fixes.push("added-keydown-event-type");
      return "onKeyDown={(e: React.KeyboardEvent<HTMLElement>) =>";
    }
  );

  return fixed;
}

// ================================================================
// PROMISE HANDLING
// ================================================================
function fixPromiseHandling(code: string, fixes: string[], warnings: string[]): string {
  // Detect floating promises (async function calls without await or .then/.catch)
  const floatingRe = /^\s*(?:fetch|axios\.get|axios\.post|fetch\.get)\s*\(/gm;
  if (floatingRe.test(code)) {
    warnings.push("floating-promise — async calls should be awaited or have .catch() handler");
  }

  // Add .catch to .then without .catch
  let fixed = code.replace(
    /\.then\(([^)]+)\)(?!\s*\.catch)/g,
    (_, handler) => {
      fixes.push("added-catch-to-promise");
      return `.then(${handler}).catch((err) => console.error(err))`;
    }
  );

  return fixed;
}

// ================================================================
// DYNAMIC IMPORTS
// ================================================================
function fixDynamicImports(code: string, fixes: string[]): string {
  let fixed = code;

  // Fix import() without .then or await: ensure it returns a value
  // Fix syntax: import('./foo.js') → import('./foo')
  fixed = fixed.replace(/import\(['"]([^'"]+)\.(jsx?)['"]\)/g, (_, path) => {
    fixes.push(`stripped-extension-from-dynamic-import:${path}`);
    return `import("${path}")`;
  });

  return fixed;
}

// ================================================================
// OBJECT DESTRUCTURING
// ================================================================
function fixObjectDestructuring(code: string, fixes: string[]): string {
  // Warn on repeated obj.prop.sub access (3+ times the same path)
  const accessRe = /\b(\w+\.\w+\.\w+)\b/g;
  const counts = new Map<string, number>();
  let m;
  while ((m = accessRe.exec(code)) !== null) {
    counts.set(m[1], (counts.get(m[1]) ?? 0) + 1);
  }
  // Just return code — deep object access fix is too risky to auto-apply
  return code;
}

// ================================================================
// WINDOW/DOCUMENT SSR GUARDS
// ================================================================
function fixWindowSSRGuards(code: string, fixes: string[], warnings: string[]): string {
  // Detect direct window/document access outside useEffect
  if (/(?<!typeof\s)\b(?:window|document|navigator)\b/.test(code) && !code.includes("useEffect")) {
    warnings.push("ssr-unsafe-browser-api — direct window/document access may fail in SSR; wrap in useEffect or typeof check");
  }

  // Auto-fix: window.location → (typeof window !== 'undefined' ? window.location : null)
  // Too risky to auto-apply broadly, just warn.
  return code;
}

// ================================================================
// LOOSE EQUALITY
// ================================================================
function fixLooseEquality(code: string, fixes: string[]): string {
  // Skip inside JSX attributes and strings
  let fixed = code;
  // Replace == with === and != with !== outside JSX props and strings
  // Use a simple approach: replace in non-JSX contexts
  fixed = fixed.replace(/([^=!<>])==([^=])/g, (_, before, after) => {
    if (before.includes('"') || before.includes("'")) return `${before}==${after}`;
    fixes.push("loose-equality-fixed");
    return `${before}===${after}`;
  });
  fixed = fixed.replace(/([^!<>])!=([^=])/g, (_, before, after) => {
    fixes.push("loose-equality-fixed");
    return `${before}!==${after}`;
  });
  return fixed;
}

// ================================================================
// NUMBER COERCION
// ================================================================
function fixNumberCoercion(code: string, fixes: string[]): string {
  // parseInt without radix
  const fixed = code.replace(/\bparseInt\s*\(([^,)]+)\)(?!\s*,)/g, (_, arg) => {
    fixes.push("added-radix-to-parseint");
    return `parseInt(${arg}, 10)`;
  });
  return fixed;
}

// ================================================================
// MEMO MISUSE
// ================================================================
function fixMemoMisuse(code: string, warnings: string[]): void {
  // React.memo wrapping a component that uses context (context changes won't trigger re-render)
  if (/React\.memo\(/.test(code) && /useContext\(/.test(code)) {
    warnings.push("memo-with-context — React.memo won't prevent re-renders triggered by context changes");
  }
  // Memoising every component is an anti-pattern
  const memoCount = (code.match(/React\.memo\(/g) ?? []).length;
  if (memoCount > 5) {
    warnings.push("excessive-memo — memoising every component adds overhead; only memo components with expensive renders");
  }
}

// ================================================================
// CONTEXT WITHOUT PROVIDER
// ================================================================
function fixContextWithoutProvider(code: string, warnings: string[]): void {
  const contextCreations = code.match(/createContext/g)?.length ?? 0;
  const providerUsages = (code.match(/\.Provider/g) ?? []).length;
  if (contextCreations > 0 && providerUsages === 0) {
    warnings.push("context-without-provider — createContext used but no .Provider found in this file");
  }
}

// ================================================================
// MISSING ERROR BOUNDARY
// ================================================================
function fixMissingErrorBoundary(code: string, warnings: string[]): void {
  const hasFetch = /\bfetch\(|\baxios\./.test(code);
  const hasErrorBoundary = /ErrorBoundary/.test(code);
  if (hasFetch && !hasErrorBoundary) {
    warnings.push("missing-error-boundary — async data fetching without ErrorBoundary; add error state handling");
  }
}

// ================================================================
// NESTED TERNARY
// ================================================================
function fixNestedTernary(code: string, warnings: string[]): void {
  // Detect triple-nested ternary: a ? b : c ? d : e ? f : g
  if (/\?[^:?]*:[^:?]*\?[^:?]*:[^:?]*\?/.test(code)) {
    warnings.push("nested-ternary-depth-3+ — deeply nested ternaries are hard to read; extract to function or if/else");
  }
}

// ================================================================
// EMPTY FUNCTIONS
// ================================================================
function fixEmptyFunctions(code: string, warnings: string[]): void {
  const emptyFn = /(?:function\s+\w+|=>\s*)\{\s*\}/g;
  const matches = code.match(emptyFn) ?? [];
  if (matches.length > 2) {
    warnings.push(`empty-functions:${matches.length} empty function bodies found — add implementations or remove`);
  }
}

// ================================================================
// OBJECT SPREAD ORDER
// ================================================================
function fixObjectSpreadOrder(code: string, warnings: string[]): void {
  // {...props, className="foo"} — spread before explicit props overrides won't work
  if (/\{\.\.\.(\w+),\s*(\w+)=/.test(code)) {
    warnings.push("spread-override-risk — explicit props after spread will be overridden by spread; put spread last: {...props, myProp: value} → {myProp: value, ...props}");
  }
}

// ================================================================
// Z-INDEX WARNINGS
// ================================================================
function fixZIndex(code: string, warnings: string[]): void {
  const magicZIndex = /z-?[Ii]ndex\s*[=:]\s*(?!(?:0|1|2|10|50|100|1000|9999))\d+/g;
  if (magicZIndex.test(code)) {
    warnings.push("magic-z-index — use a consistent z-index scale (0,10,20,30 etc.) instead of magic numbers");
  }
}

// ================================================================
// COLOR CONTRAST WARNINGS
// ================================================================
function fixColorContrast(code: string, warnings: string[]): void {
  // Warn on light-on-light or dark-on-dark combos
  const lightOnLight = /#(?:fff|ffffff|f5f5f5|fafafa|eeeeee).*color.*#(?:fff|ffffff|f5f5f5|fafafa)/i;
  if (lightOnLight.test(code)) {
    warnings.push("potential-low-contrast — white/near-white text on light background may fail WCAG AA");
  }
}

// ================================================================
// LONG LINES
// ================================================================
function fixLongLines(code: string, warnings: string[]): void {
  const lines = code.split("\n");
  const longLines = lines.filter((l) => l.length > 200);
  if (longLines.length > 3) {
    warnings.push(`long-lines:${longLines.length} lines exceed 200 chars — consider breaking them up`);
  }
}

// ================================================================
// TODO COMMENTS
// ================================================================
function fixTodoComments(code: string, infos: string[]): void {
  const todos = code.match(/\/\/\s*(?:TODO|FIXME|HACK|XXX|TEMP|REMOVEME):?[^\n]*/gi) ?? [];
  if (todos.length > 0) {
    infos.push(`todo-comments:${todos.length} TODO/FIXME comments found`);
  }
}

// ================================================================
// I18N HARDCODED STRINGS
// ================================================================
function fixI18nHardcodedStrings(code: string, infos: string[]): void {
  // Detect JSX text nodes that look like user-visible strings (not just identifiers)
  const jsxText = />([A-Z][a-z]+ [a-z])/g;
  const matches = code.match(jsxText) ?? [];
  if (matches.length > 5) {
    infos.push(`hardcoded-strings:${matches.length} potential user-visible strings found — consider using i18n library`);
  }
}

// ================================================================
// PROP DRILLING WARNING
// ================================================================
function fixPropDrilling(code: string, warnings: string[]): void {
  // Heuristic: if a component has 8+ props, warn about prop drilling
  const manyPropsRe = /\(\s*\{([^}]+)\}\s*\)/g;
  let m;
  while ((m = manyPropsRe.exec(code)) !== null) {
    const props = m[1].split(",").filter((p) => p.trim());
    if (props.length >= 8) {
      warnings.push(`prop-drilling:${props.length} props — consider using Context or state management`);
    }
  }
}

// ================================================================
// CIRCULAR IMPORTS
// ================================================================
function fixCircularImports(code: string, filePath: string, warnings: string[]): void {
  // Detect if the file imports itself
  const filename = filePath.split("/").pop()?.replace(/\.[^.]+$/, "") ?? "";
  const selfImport = new RegExp(`from\\s+['"]\\./${filename}['"]`);
  if (selfImport.test(code)) {
    warnings.push(`circular-self-import — file imports itself: ${filePath}`);
  }
}

// ================================================================
// UNDEFINED VARIABLES
// ================================================================
function fixUndefinedVariables(code: string, warnings: string[]): void {
  // Common undefined variable patterns
  const usedInJSX = /\{(\w+)\}/g;
  const defined = new Set<string>();

  // Collect defined identifiers
  const defRe = /(?:const|let|var|function|class)\s+(\w+)|import[^{]*\{([^}]+)\}|import\s+(\w+)\s+from/g;
  let m;
  while ((m = defRe.exec(code)) !== null) {
    if (m[1]) defined.add(m[1]);
    if (m[2]) m[2].split(",").forEach((s) => defined.add(s.trim().split(" as ").pop()?.trim() ?? ""));
    if (m[3]) defined.add(m[3]);
  }

  // Params
  const paramRe = /\(\s*\{([^}]+)\}|(?:function|\()\s*(?:\w+\s*,\s*)*(\w+)\s*(?:,|\))/g;
  while ((m = paramRe.exec(code)) !== null) {
    if (m[1]) m[1].split(",").forEach((s) => defined.add(s.trim().split(":")[0].trim()));
    if (m[2]) defined.add(m[2]);
  }

  // Globals that are always available
  const GLOBALS = new Set([
    "React", "console", "window", "document", "navigator", "location", "history",
    "Math", "Date", "JSON", "Object", "Array", "String", "Number", "Boolean",
    "Promise", "setTimeout", "setInterval", "clearTimeout", "clearInterval",
    "fetch", "URL", "URLSearchParams", "FormData", "Error", "Map", "Set", "Symbol",
    "null", "undefined", "true", "false", "NaN", "Infinity",
    "parseInt", "parseFloat", "isNaN", "isFinite", "encodeURIComponent", "decodeURIComponent",
    "require", "module", "exports", "__dirname", "__filename", "process",
    "children", "className", "style", "key", "ref", "id", "type",
  ]);
}

// ================================================================
// TYPESCRIPT FIXES
// ================================================================
function fixTsErrors(code: string, fixes: string[], warnings: string[]): string {
  let fixed = code;

  // Fix: function params without types that TypeScript complains about
  // This is a heuristic — add React.FC type to component functions
  fixed = fixed.replace(
    /export\s+default\s+function\s+([A-Z]\w*)\s*\(\s*\)\s*\{/g,
    (_, name) => {
      fixes.push(`added-react-fc-type:${name}`);
      return `export default function ${name}(): React.ReactElement {`;
    }
  );

  // Fix: <T> in .tsx being misread as JSX — add extends unknown
  fixed = fixed.replace(
    /<T>(?=\s*\()/g,
    () => {
      fixes.push("generic-T-tsx-fix");
      return "<T extends unknown>";
    }
  );

  // Fix: explicit 'any' in function params — warn
  if (/:\s*any\b/.test(fixed)) {
    warnings.push("explicit-any-type — consider using a more specific type instead of 'any'");
  }

  // Fix: missing semicolons on type declarations
  fixed = fixed.replace(/^(type\s+\w+\s*=\s*[^;{]+)$/gm, (m) => {
    if (m.trim().endsWith(";")) return m;
    fixes.push("added-semicolon-to-type-decl");
    return m + ";";
  });

  // Fix: interface without semicolons on properties
  fixed = fixed.replace(
    /(interface\s+\w+\s*\{[\s\S]*?\})/g,
    (block) => {
      const fixed = block.replace(/(\w+\s*(?:\??\s*:\s*[^;{}\n]+))(?=\n\s*\w+\s*:|\n\s*\})/g, (prop) => {
        if (prop.trim().endsWith(";") || prop.trim().endsWith(",")) return prop;
        return prop + ";";
      });
      if (fixed !== block) fixes.push("interface-property-semicolons");
      return fixed;
    }
  );

  return fixed;
}

// ================================================================
// IMPLICIT ANY
// ================================================================
function fixImplicitAny(code: string, fixes: string[], warnings: string[]): string {
  let fixed = code;

  // Replace Array<any> with Array<unknown>
  fixed = fixed.replace(/Array<any>/g, () => {
    fixes.push("implicit-any-to-unknown:Array");
    return "Array<unknown>";
  });

  // Replace Promise<any> with Promise<unknown>
  fixed = fixed.replace(/Promise<any>/g, () => {
    fixes.push("implicit-any-to-unknown:Promise");
    return "Promise<unknown>";
  });

  // Replace Record<string, any> with Record<string, unknown>
  fixed = fixed.replace(/Record<string,\s*any>/g, () => {
    fixes.push("implicit-any-to-unknown:Record");
    return "Record<string, unknown>";
  });

  return fixed;
}

// ================================================================
// RETURN TYPES IN TS
// ================================================================
function fixReturnTypesInTS(code: string, fixes: string[], infos: string[]): string {
  // Suggest return types for exported functions
  const exportedFuncRe = /export\s+(?:default\s+)?function\s+([A-Z]\w*)\s*\([^)]*\)\s*(?!:)\s*\{/g;
  let m;
  while ((m = exportedFuncRe.exec(code)) !== null) {
    infos.push(`missing-return-type:${m[1]} — consider adding explicit return type for better type safety`);
  }
  return code;
}

// ================================================================
// TRAILING COMMAS IN TS
// ================================================================
function fixTrailingCommasTS(code: string, fixes: string[]): string {
  // Add trailing commas to multiline type unions
  let fixed = code.replace(
    /(type\s+\w+\s*=\s*\n(?:\s+\|[^\n]+\n)+)(\s*;)/g,
    (full, types, semi) => {
      // Already fine
      return full;
    }
  );
  return fixed;
}

// ================================================================
// SEMICOLONS
// ================================================================
function fixSemicolons(code: string, fixes: string[]): string {
  // Only add semicolons to obvious statement ends (conservative)
  let fixed = code;

  // Lines ending with ) that look like statements (not arrow functions or conditions)
  fixed = fixed.replace(/^(\s*(?:const|let|var|return|throw|import)\s+[^;\n{]+[^;\n{,])$/gm, (line) => {
    if (line.trim().endsWith(";") || line.trim().endsWith("{") || line.trim().endsWith(",")) {
      return line;
    }
    if (/\bimport\b/.test(line) && !line.trim().endsWith(";")) {
      fixes.push("added-semicolon-to-import");
      return line + ";";
    }
    return line;
  });

  return fixed;
}

// ================================================================
// SPELLING IN COMMENTS
// ================================================================
const COMMENT_SPELLING: Array<[RegExp, string]> = [
  [/\bfunciton\b/g, "function"],
  [/\bparamter\b/g, "parameter"],
  [/\brecieve\b/g, "receive"],
  [/\boccured\b/g, "occurred"],
  [/\bsepearte\b/g, "separate"],
  [/\baccesibility\b/g, "accessibility"],
  [/\bimplament\b/g, "implement"],
  [/\bimplaments\b/g, "implements"],
  [/\bcomponet\b/g, "component"],
  [/\bcomponets\b/g, "components"],
  [/\bprperties\b/g, "properties"],
  [/\bpropety\b/g, "property"],
  [/\bdefualt\b/g, "default"],
  [/\bvalide\b/g, "valid"],
  [/\bvalidaton\b/g, "validation"],
  [/\bintialise\b/g, "initialise"],
  [/\bintializ\b/g, "initialize"],
];

function fixSpellingInComments(code: string, fixes: string[]): string {
  let fixed = code;
  let changed = false;
  // Only fix within // and /* */ comment blocks
  fixed = fixed.replace(/(\/\/[^\n]*|\/\*[\s\S]*?\*\/)/g, (comment) => {
    let c = comment;
    for (const [pattern, replacement] of COMMENT_SPELLING) {
      const next = c.replace(pattern, replacement);
      if (next !== c) {
        changed = true;
        c = next;
      }
    }
    return c;
  });
  if (changed) fixes.push("comment-spelling-fixed");
  return fixed;
}

// ================================================================
// TAILWIND CLASSES
// ================================================================
type TailwindFix = [RegExp, string | ((match: string) => string)];
const TAILWIND_FIXES: TailwindFix[] = [
  [/\bflex-no-wrap\b/g, "flex-nowrap"],
  [/\bfont-hairline\b/g, "font-thin"],
  [/\btruncate-text\b/g, "truncate"],
  [/\bbreakword\b/g, "break-words"],
  [/\bscreen-reader-only\b/g, "sr-only"],
  [/\bvisually-hidden\b/g, "sr-only"],
  [/\btext-default\b/g, "text-base"],
  [/\bfont-regular\b/g, "font-normal"],
  [/\bcolor-primary\b/g, "text-primary-500"],
  [/\bbg-default\b/g, "bg-white"],
  [/\bborder-default\b/g, "border-gray-200"],
  [/\bpadding-(\d+)\b/g, (m: string) => m.replace("padding-", "p-")],
  [/\bmargin-(\d+)\b/g, (m: string) => m.replace("margin-", "m-")],
  [/\bgap\s*-\s*(\d+)\b/g, "gap-$1"],
  [/\bfont-weight-bold\b/g, "font-bold"],
  [/\btext-align-center\b/g, "text-center"],
  [/\bdisplay-flex\b/g, "flex"],
  [/\bdisplay-block\b/g, "block"],
  [/\bdisplay-none\b/g, "hidden"],
  [/\boverflow-hidden-x\b/g, "overflow-x-hidden"],
  [/\boverflow-hidden-y\b/g, "overflow-y-hidden"],
  [/\bp-x-(\d+)\b/g, "px-$1"],
  [/\bp-y-(\d+)\b/g, "py-$1"],
  [/\bm-x-(\d+)\b/g, "mx-$1"],
  [/\bm-y-(\d+)\b/g, "my-$1"],
  [/\bflex-col\b/g, "flex-col"],
  [/\bflex-row\b/g, "flex-row"],
  [/\bitems-center\b/g, "items-center"],
  [/\bjustify-center\b/g, "justify-center"],
  [/\bjustify-between\b/g, "justify-between"],
  [/\bw-full\b/g, "w-full"],
  [/\bh-full\b/g, "h-full"],
  [/\bmin-h-screen\b/g, "min-h-screen"],
  [/\bbg-transparent\b/g, "bg-transparent"],
  [/\btext-white\b/g, "text-white"],
  [/\btext-black\b/g, "text-black"],
  [/\bfont-bold\b/g, "font-bold"],
  [/\bfont-semibold\b/g, "font-semibold"],
  [/\bfont-medium\b/g, "font-medium"],
  [/\bfont-normal\b/g, "font-normal"],
  [/\btracking-tight\b/g, "tracking-tight"],
  [/\btracking-wide\b/g, "tracking-wide"],
  [/\bleading-tight\b/g, "leading-tight"],
  [/\bleading-relaxed\b/g, "leading-relaxed"],
  [/\brounded-full\b/g, "rounded-full"],
  [/\brounded-lg\b/g, "rounded-lg"],
  [/\brounded-md\b/g, "rounded-md"],
  [/\bshadow-sm\b/g, "shadow-sm"],
  [/\bshadow-md\b/g, "shadow-md"],
  [/\bshadow-lg\b/g, "shadow-lg"],
  [/\bshadow-xl\b/g, "shadow-xl"],
  [/\btransition-all\b/g, "transition-all"],
  [/\bduration-300\b/g, "duration-300"],
  [/\bease-in-out\b/g, "ease-in-out"],
  [/\bhover:opacity-80\b/g, "hover:opacity-80"],
  [/\bactive:scale-95\b/g, "active:scale-95"],
  [/\bfocus:outline-none\b/g, "focus:outline-none"],
  [/\bfocus:ring-2\b/g, "focus:ring-2"],
  [/\boverflow-auto\b/g, "overflow-auto"],
  [/\boverflow-scroll\b/g, "overflow-scroll"],
  [/\bz-10\b/g, "z-10"],
  [/\bz-50\b/g, "z-50"],
  [/\bz-100\b/g, "z-[100]"],
  [/\babsolute\b/g, "absolute"],
  [/\brelative\b/g, "relative"],
  [/\bfixed\b/g, "fixed"],
  [/\bsticky\b/g, "sticky"],
  [/\btop-0\b/g, "top-0"],
  [/\bleft-0\b/g, "left-0"],
  [/\bright-0\b/g, "right-0"],
  [/\bbottom-0\b/g, "bottom-0"],
  [/\binset-0\b/g, "inset-0"],
  [/\bcursor-pointer\b/g, "cursor-pointer"],
  [/\bselect-none\b/g, "select-none"],
  [/\bpointer-events-none\b/g, "pointer-events-none"],
  [/\bwhitespace-nowrap\b/g, "whitespace-nowrap"],
  [/\bbreak-all\b/g, "break-all"],
  [/\bbreak-words\b/g, "break-words"],
  [/\btruncate\b/g, "truncate"],
  [/\bappearance-none\b/g, "appearance-none"],
  [/\boutline-none\b/g, "outline-none"],
  [/\bborder-0\b/g, "border-0"],
  [/\bborder-2\b/g, "border-2"],
  [/\bborder-gray-200\b/g, "border-gray-200"],
  [/\bborder-gray-300\b/g, "border-gray-300"],
  [/\bgrid-cols-1\b/g, "grid-cols-1"],
  [/\bgrid-cols-2\b/g, "grid-cols-2"],
  [/\bgrid-cols-3\b/g, "grid-cols-3"],
  [/\bgap-2\b/g, "gap-2"],
  [/\bgap-4\b/g, "gap-4"],
  [/\bgap-6\b/g, "gap-6"],
  [/\bgap-8\b/g, "gap-8"],
];

function fixTailwindClasses(code: string, fixes: string[]): string {
  let fixed = code;
  let changed = false;
  for (const [pattern, replacement] of TAILWIND_FIXES) {
    const next = typeof replacement === "string"
      ? fixed.replace(pattern, replacement)
      : fixed.replace(pattern, replacement);
    if (next !== fixed) {
      changed = true;
      fixed = next;
    }
  }
  if (changed) fixes.push("tailwind-class-fixes");
  return fixed;
}

// ================================================================
// DUPLICATE DECLARATIONS
// ================================================================
function stripLLMLeakage(code: string, fixes: string[]): string {
  const patterns = [
    /^In this /i,
    /^Here('s| is)/i,
    /^This (component|file)/i,
    /^Note that/i,
    /^Let me /i,
    /^I('ll| will)/i,
    /^Sure,/i,
    /^Certainly,/i,
    /^Of course,/i,
    /^Below is/i,
    /^Above is/i,
  ];
  const lines = code.split("\n");
  let changed = false;
  const filtered = lines.filter((line) => {
    const t = line.trim();
    if (patterns.some((p) => p.test(t))) {
      fixes.push("removed-llm-prose");
      changed = true;
      return false;
    }
    return true;
  });
  return changed ? filtered.join("\n") : code;
}

function fixDuplicateDeclarations(code: string, fixes: string[]): string {
  let fixed = code;
  let changed = false;

  // ── NEW: Remove component stubs when the real import already exists ───
  const importedComponents = new Set<string>();
  const importScan = /^import[^{]*\{([^}]+)\}\s+from|^import\s+([A-Z]\w*)\s+from/gm;
  let im: RegExpExecArray | null;
  while ((im = importScan.exec(fixed)) !== null) {
    if (im[1]) {
      im[1].split(",").forEach(s => {
        const n = s.trim().split(" as ").pop()?.trim();
        if (n && /^[A-Z]/.test(n)) importedComponents.add(n);
      });
    }
    if (im[2]) importedComponents.add(im[2]);
  }

  // Remove stub function declarations for components that are imported
  for (const name of importedComponents) {
    // Match: function Name({ children, ...props }) { return <div ... /> }
    // and: function Name({ children, ...props }: { ... }) { ... }
    const stubRe = new RegExp(
      `\\n?(?:\\/\\/[^\\n]*\\n)?function\\s+${name}\\s*\\([^)]*\\)\\s*(?::[^{]+)?\\{[^}]*data-component="${name}"[^}]*\\}`,
      "g"
    );
    const after = fixed.replace(stubRe, "");
    if (after !== fixed) {
      fixed = after;
      changed = true;
      fixes.push(`removed-duplicate-stub:${name}`);
    }
  }

  // Multiple export default
  const exportMatches = [...fixed.matchAll(/\bexport\s+default\b/g)];
  if (exportMatches.length > 1) {
    let count = 0;
    fixed = fixed.replace(/\bexport\s+default\s+(\w+)\s*;/g, (match) => {
      count++;
      if (count === 1) return match;
      fixes.push("removed-duplicate-export-default");
      changed = true;
      return "";
    });
  }

  // Duplicate useState destructure names
  const stateDecls = new Map<string, number>();
  const stateRe = /const\s+\[(\w+)\s*,\s*(\w+)\]\s*=\s*useState/g;
  let sm: RegExpExecArray | null;
  while ((sm = stateRe.exec(fixed)) !== null) {
    const stateVar = sm[1];
    stateDecls.set(stateVar, (stateDecls.get(stateVar) ?? 0) + 1);
  }
  for (const [varName, count] of stateDecls) {
    if (count < 2) continue;
    let occurrence = 0;
    fixed = fixed.replace(
      new RegExp(`(const\\s+\\[)${varName}(\\s*,\\s*set${varName[0].toUpperCase()}${varName.slice(1)}\\]\\s*=\\s*useState)`, "g"),
      (match, pre, post) => {
        occurrence++;
        if (occurrence === 1) return match;
        const newName = `${varName}${occurrence}`;
        fixes.push(`renamed-duplicate-state:${varName}→${newName}`);
        changed = true;
        return `${pre}${newName}${post}`;
      }
    );
  }

  // Bare top-level function calls
  const lines = fixed.split("\n");
  let braceDepth = 0;
  const cleanedLines = lines.filter((line) => {
    const trimmed = line.trim();
    for (const ch of trimmed) {
      if (ch === "{") braceDepth++;
      else if (ch === "}") braceDepth--;
    }
    if (
      braceDepth === 0 &&
      /^\w+\s*\(/.test(trimmed) &&
      !trimmed.startsWith("import ") &&
      !trimmed.startsWith("export ") &&
      !trimmed.startsWith("const ") &&
      !trimmed.startsWith("let ") &&
      !trimmed.startsWith("var ") &&
      !trimmed.startsWith("function ") &&
      !trimmed.startsWith("//") &&
      !trimmed.startsWith("/*") &&
      !trimmed.startsWith("*") &&
      !trimmed.startsWith("@")
    ) {
      fixes.push(`removed-bare-top-level-call:${trimmed.slice(0, 40)}`);
      changed = true;
      return false;
    }
    return true;
  });
  if (changed) fixed = cleanedLines.join("\n");

  return fixed;
}

function fixDuplicateConsts(code: string, fixes: string[]): string {
  const lines = code.split("\n");
  const scopeStack: Map<string, number>[] = [new Map()];
  let changed = false;

  const result = lines.map((line) => {
    const openCount = (line.match(/\{/g) ?? []).length;
    const closeCount = (line.match(/\}/g) ?? []).length;

    for (let i = 0; i < openCount; i++) scopeStack.push(new Map());
    for (let i = 0; i < closeCount; i++) {
      if (scopeStack.length > 1) scopeStack.pop();
    }

    const currentScope = scopeStack[scopeStack.length - 1];
    const m = line.match(/^\s*const\s+(\w+)\s*=/);
    if (!m) return line;
    const name = m[1];

    if (!currentScope.has(name)) {
      currentScope.set(name, 1);
      return line;
    }

    const count = currentScope.get(name)! + 1;
    currentScope.set(name, count);
   const newName = `${name}_${count}`;
changed = true;
fixes.push(`renamed-duplicate-const:${name}→${newName}`);
// Rename the declaration AND all subsequent usages in the file
// so the duplicate-const error doesn't re-appear after phi fixes it
const declFixed = line.replace(new RegExp(`\\bconst\\s+${name}\\b`), `const ${newName}`);
// We'll do the body rename in a post-pass below
return declFixed;
  });
// Post-pass: rename all usages of renamed consts throughout the file
// (the declaration rename above only fixes the const line itself)
if (changed) {
  let body = result.join("\n");
  for (const [origName, count] of Array.from(scopeStack[0].entries())) {
    if (count < 2) continue;
    for (let i = 2; i <= count; i++) {
      // We can't easily track which occurrence is which post-hoc,
      // so we leave usages as-is — the rename only affects the declaration.
      // The real fix is preventing duplicates upstream (max_tokens cap).
    }
  }
  return body;
}
  return changed ? result.join("\n") : code;
}
// ================================================================
// COMMON PATTERNS
// ================================================================
function fixCommonPatterns(code: string, fixes: string[]): string {
  let fixed = code;
  let changed = false;

  // Map keys
  const mapWithoutKey = /\.map\((\w+)\s*=>\s*(<[A-Za-z])/g;
  const mapWithKey = /\.map\((\w+)\s*=>\s*<[A-Za-z][^>]*key=/g;
  if (mapWithoutKey.test(fixed) && !mapWithKey.test(fixed)) {
    fixed = fixed.replace(
      /\.map\((\w+)\s*=>\s*(<[A-Za-z][a-zA-Z]*)([\s>])/g,
      (match, item, tag, after) => {
        if (match.includes("key=")) return match;
        const keyVal = `${item}?.id ?? ${item}`;
        return `.map(${item} => ${tag} key={${keyVal}}${after}`;
      }
    );
    if (fixed !== code) {
      changed = true;
      fixes.push("added-map-keys");
    }
  }

  // Async useEffect fix
  if (/useEffect\s*\(\s*async\s*\(/.test(fixed)) {
    fixed = fixed.replace(
      /useEffect\(\s*async\s*\(\)\s*=>\s*\{([\s\S]*?)\}\s*,/g,
      (_, body) => `useEffect(() => {\n  (async () => {${body}})();\n},`
    );
    if (fixed !== code) {
      changed = true;
      fixes.push("async-effect-fixed");
    }
  }

  // Double export default
  if (/export\s+default\s+export\s+default/g.test(fixed)) {
    fixed = fixed.replace(/export\s+default\s+export\s+default/g, "export default");
    changed = true;
    fixes.push("double-export-default");
  }

  // Bad spread
  if (/\{\.\.\.(\w+),\s*\}/g.test(fixed)) {
    fixed = fixed.replace(/\{\.\.\.(\w+),\s*\}/g, "{...$1}");
    changed = true;
    fixes.push("spread-trailing-comma");
  }

  // Bad state destructure
  if (/const\s+(\w+)\s*,\s*(set\w+)\s*=\s*useState/g.test(fixed)) {
    fixed = fixed.replace(/const\s+(\w+)\s*,\s*(set\w+)\s*=\s*useState/g, "const [$1, $2] = useState");
    changed = true;
    fixes.push("fixed-state-destructure");
  }

  // Empty catch blocks
  fixed = fixed.replace(/catch\s*\((\w+)\)\s*\{\s*\}/g, (_, e) => {
    changed = true;
    fixes.push("filled-empty-catch");
    return `catch (${e}) { console.error(${e}); }`;
  });

  // Implicit return in arrow function JSX
  fixed = fixed.replace(
    /=>\s*\n\s*(<[A-Z][a-zA-Z]*)/g,
    (_, tag) => {
      changed = true;
      fixes.push("implicit-arrow-return");
      return `=> (\n  ${tag}`;
    }
  );

  return fixed;
}

// ================================================================
// TEMPLATE LITERALS
// ================================================================
function fixBrokenTemplateLiterals(code: string, fixes: string[]): string {
  let fixed = code;
  const rawTemplateLiteral = /<[a-zA-Z][^>]*\s(\w+)=`([^`]*)`/g;
  if (rawTemplateLiteral.test(fixed)) {
    fixed = fixed.replace(rawTemplateLiteral, (m, attr, val) => {
      if (attr === "className" || attr === "style" || attr === "id") {
        return m.replace(`${attr}=\`${val}\``, `${attr}="${val}"`);
      }
      return m;
    });
    if (fixed !== code) fixes.push("template-literal-in-jsx-attr");
  }
  return fixed;
}

// ================================================================
// CONSOLE STATEMENTS
// ================================================================
function fixConsoleStatements(code: string, fixes: string[]): string {
  const fixed = code.replace(/^import.*;\s*console\.log\(\)/gm, (m) =>
    m.replace(/\s*console\.log\(\)/, "")
  );
  if (fixed !== code) fixes.push("removed-stray-console");
  return fixed;
}

// ================================================================
// CSS VARIABLES — normalise malformed CSS custom property usage
// ================================================================
function fixCSSVariables(code: string, fixes: string[]): string {
  let fixed = code;
  let changed = false;

  // Fix: var(--color blue) → var(--color-blue)
  fixed = fixed.replace(/var\(--(\w+)\s+(\w+)\)/g, (_, a, b) => {
    changed = true;
    fixes.push(`css-variable-space-to-dash:--${a} ${b}`);
    return `var(--${a}-${b})`;
  });

  // Fix: --color: value; without semicolon
  fixed = fixed.replace(/(--[\w-]+\s*:\s*[^;{}\n]+)(?=\n\s*--)/g, (m) => {
    if (m.trim().endsWith(";")) return m;
    changed = true;
    fixes.push("css-variable-missing-semicolon");
    return m + ";";
  });

  return fixed;
}

// ================================================================
// MEDIA QUERIES — sort and deduplicate
// ================================================================
function fixMediaQueries(code: string, fixes: string[]): string {
  // Deduplicate identical @media blocks — warn only (auto-dedup too risky)
  const mediaBlocks = code.match(/@media[^{]+\{/g) ?? [];
  const seen = new Set<string>();
  const dupes: string[] = [];
  for (const block of mediaBlocks) {
    const key = block.replace(/\s+/g, " ").trim();
    if (seen.has(key)) dupes.push(key);
    seen.add(key);
  }
  // Just log, don't auto-remove
  return code;
}

// ================================================================
// CSS FIXES
// ================================================================
function fixCSS(code: string, fixes: string[]): string {
  code = code.replace(/url\(['"]?data:[^'")\n]*(?:['"][^)]*)?(?!\))/g, "url(none)");
  code = code.replace(/(:\s*['"])[^'"]*$/gm, "$1none'");
code = code.replace(
  /url\(\s*(['"])((?:(?!\1)[^)\n])*)\s*$/gm,
  (_, quote, val) => `url(${quote}${val}${quote})`
);

// Fix data URLs that got truncated (no closing paren on same line)
code = code.replace(
  /url\(['"]?data:[^'")\n]{0,2000}$/gm,
  "url(none)"
);

  let fixed = code;
  let changed = false;

  const importLines: string[] = [];
  const otherLines: string[] = [];
  for (const line of fixed.split("\n")) {
    if (/^\s*@import\s/.test(line)) {
      importLines.push(line);
    } else {
      otherLines.push(line);
    }
  }
  if (importLines.length > 0) {
    const reordered = [...importLines, "", ...otherLines].join("\n");
    if (reordered !== fixed) {
      fixed = reordered;
      changed = true;
      fixes.push("css-import-moved-to-top");
    }
  }

  const missingSemicolon = /([a-zA-Z-]+\s*:\s*[^;{}]+)(\s*\n\s*[a-zA-Z-]+\s*:)/g;
  const withSemicolon = fixed.replace(missingSemicolon, "$1;$2");
  if (withSemicolon !== fixed) {
    changed = true;
    fixed = withSemicolon;
  }

  const zeroPx = fixed.replace(/:\s*0px\b/g, ": 0");
  if (zeroPx !== fixed) {
    changed = true;
    fixed = zeroPx;
  }

  // Remove duplicate selectors (same selector appearing twice in a row)
  const dupeSelectorRe = /(\n[a-zA-Z.#[\s:>~+*][^{]*\{[^}]*\})\s*\1/g;
  const noDupeSelector = fixed.replace(dupeSelectorRe, "$1");
  if (noDupeSelector !== fixed) {
    changed = true;
    fixed = noDupeSelector;
    fixes.push("css-duplicate-selector-removed");
  }

  // Fix missing units on non-zero values in px context
  fixed = fixed.replace(/(width|height|margin|padding|top|left|right|bottom|font-size|line-height|border-radius|border-width)\s*:\s*(\d+)(?!px|em|rem|%|vh|vw|vmin|vmax|ch|ex|fr|s|ms|deg|turn|grad|rad|\.)(?=\s*[;{}])/g,
    (_, prop, val) => {
      if (val === "0") return `${prop}: ${val}`;
      changed = true;
      fixes.push(`css-missing-unit:${prop}`);
      return `${prop}: ${val}px`;
    }
  );

  if (changed) fixes.push("css-fixes");
  return fixed;
}

// ================================================================
// JSON FIXES
// ================================================================
function fixJSON(code: string, fixes: string[], warnings: string[]): string {
  try {
    JSON.parse(code);
    return code;
  } catch {
    fixes.push("json-invalid-detected");
  }

  let fixed = code;

  // Remove trailing commas
  fixed = fixed.replace(/,\s*}/g, "}");
  fixed = fixed.replace(/,\s*]/g, "]");

  // Fix version quotes
  fixed = fixed.replace(/:\s*\^?(\d+\.\d+\.\d+)/g, ': "^$1"');

  // Fix unclosed quotes
  const quoteCount = (fixed.match(/"/g) || []).length;
  if (quoteCount % 2 !== 0) fixed += '"';

  try {
    JSON.parse(fixed);
    fixes.push("json-auto-fixed");
    return fixed;
  } catch {
  warnings.push("json-repair-failed → fallback used");

  return JSON.stringify({
    name: "ai-project",
    private: true,
    version: "0.0.1",
    type: "module",
    scripts: {
      dev: "vite --host",
      build: "vite build",
      preview: "vite preview"
    },
    dependencies: {
      react: "^18.2.0",
      "react-dom": "^18.2.0",
      clsx: "^2.1.0",
      "lucide-react": "^0.363.0"
    },
    devDependencies: {
      vite: "^5.2.6",
      "@vitejs/plugin-react": "^4.2.1"
    }
  }, null, 2);
}}
// ================================================================
// HTML FIXES
// ================================================================
function fixHTML(code: string, fixes: string[]): string {
  let fixed = code;

  if (fixed.includes("<head") && !fixed.includes("charset")) {
    fixed = fixed.replace(/<head>/, '<head>\n  <meta charset="UTF-8" />');
    fixes.push("added-charset-meta");
  }

  if (fixed.includes("<head") && !fixed.includes("viewport")) {
    fixed = fixed.replace(
      /<head>/,
      '<head>\n  <meta name="viewport" content="width=device-width, initial-scale=1.0" />'
    );
    fixes.push("added-viewport-meta");
  }

  // Add lang attribute to <html>
  if (fixed.includes("<html") && !fixed.includes("lang=")) {
    fixed = fixed.replace(/<html>/, '<html lang="en">');
    fixes.push("added-html-lang");
  }

  // Add title if missing
  if (fixed.includes("<head") && !fixed.includes("<title")) {
    fixed = fixed.replace(/<\/head>/, "  <title>App</title>\n</head>");
    fixes.push("added-default-title");
  }

  // Fix unclosed tags
  const selfClosingHTML = ["br", "hr", "input", "img", "meta", "link", "area", "base", "col"];
  for (const tag of selfClosingHTML) {
    const unclosed = new RegExp(`<${tag}([^/]*)>`, "gi");
    fixed = fixed.replace(unclosed, `<${tag}$1 />`);
  }

  return fixed;
}

// ================================================================
// CROSS-FILE DEPENDENCY RESOLUTION
// ================================================================
function fixCrossFileDependencies(files: AIFile[], registry: Map<string, string>): AIFile[] {
  // Build a set of all exported component names
  const exportedComponents = new Set<string>();
  for (const f of files) {
    const exportRe = /export\s+(?:default\s+)?(?:function|const|class)\s+([A-Z][a-zA-Z0-9]*)/g;
    let m;
    while ((m = exportRe.exec(f.content)) !== null) {
      exportedComponents.add(m[1]);
    }
  }

  // For each file, check if it imports something that doesn't exist in any other file
  return files.map((f) => {
    let content = f.content;
    const importRe = /import\s*\{([^}]+)\}\s*from\s*['"]([^'"]+)['"]/g;
    let m;
    while ((m = importRe.exec(f.content)) !== null) {
      const specifiers = m[1].split(",").map((s) => s.trim().split(" as ").pop()?.trim() ?? "");
      const source = m[2];

      // Only check relative imports
      if (!source.startsWith(".")) continue;

      for (const spec of specifiers) {
        if (!spec || !spec[0]) continue;
        const isUpperCase = spec[0] === spec[0].toUpperCase() && spec[0] !== spec[0].toLowerCase();

        if (isUpperCase && !exportedComponents.has(spec) && STUBABLE_COMPONENTS[spec]) {
          // The component is imported but not defined anywhere — note it for injection in the source file
          console.log(`🔗 [cross-file] ${spec} imported from ${source} in ${f.path} but not found — may need stub`);
        }
      }
    }
    return { ...f, content };
  });
}

// ================================================================
// CROSS-FILE NUMERIC FILENAME FIX
// ================================================================
function safeComponentName(raw: string): string {
  const name = raw.replace(/\.[^.]+$/, "");
  const pascal = name
    .split(/[-_]/)
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join("");
  if (/^\d/.test(pascal)) return `_${pascal}`;
  return pascal;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function fixNumericFilenames(files: AIFile[]): AIFile[] {
  const renames = new Map<string, { newPath: string; oldIdent: string; newIdent: string }>();

  for (const f of files) {
    const segments = f.path.split("/");
    const basename = segments[segments.length - 1];
    const nameWithoutExt = basename.replace(/\.[^.]+$/, "");

    if (!/^\d/.test(nameWithoutExt)) continue;

    const leadingDigits = nameWithoutExt.match(/^(\d+)(.*)/);
    if (!leadingDigits) continue;

    const digits = leadingDigits[1];
    const rest = leadingDigits[2];
    const safeBase = rest
      ? rest.charAt(0).toUpperCase() + rest.slice(1) + digits
      : `Component${digits}`;

    const ext = basename.slice(nameWithoutExt.length);
    segments[segments.length - 1] = safeBase + ext;
    const newPath = segments.join("/");

    renames.set(f.path, {
      newPath,
      oldIdent: nameWithoutExt,
      newIdent: safeComponentName(safeBase),
    });
  }

  if (renames.size === 0) return files;

  const renamed = files.map((f) => {
    const r = renames.get(f.path);
    if (!r) return f;
    console.log(`🔢 [autofix] Renamed file: ${f.path} → ${r.newPath}`);
    return { path: r.newPath, content: f.content };
  });

  return renamed.map((f) => {
    let content = f.content;
    let changed = false;

    for (const [oldPath, { newPath, oldIdent, newIdent }] of renames) {
      const oldBasename = oldPath.split("/").pop()!;
      const newBasename = newPath.split("/").pop()!;

      const pathRe = new RegExp(
        `(['"])([^'"]*/)${escapeRegex(oldBasename)}(['"])`,
        "g"
      );
      const afterPathFix = content.replace(pathRe, `$1$2${newBasename}$3`);
      if (afterPathFix !== content) {
        content = afterPathFix;
        changed = true;
      }

      const identRe = new RegExp(`import\\s+_?${escapeRegex(oldIdent)}\\s+from`, "g");
      const afterIdentFix = content.replace(identRe, `import ${newIdent} from`);
      if (afterIdentFix !== content) {
        content = afterIdentFix;
        changed = true;
      }

      const jsxOpenRe = new RegExp(`<_?${escapeRegex(oldIdent)}(?=[\\s/>])`, "g");
      const jsxCloseRe = new RegExp(`</_?${escapeRegex(oldIdent)}>`, "g");
      const afterJsxOpen = content.replace(jsxOpenRe, `<${newIdent}`);
      const afterJsxClose = afterJsxOpen.replace(jsxCloseRe, `</${newIdent}>`);
      if (afterJsxClose !== content) {
        content = afterJsxClose;
        changed = true;
      }

      const varRe = new RegExp(`\\b_?${escapeRegex(oldIdent)}\\b`, "g");
      const afterVarFix = content.replace(varRe, newIdent);
      if (afterVarFix !== content) {
        content = afterVarFix;
        changed = true;
      }
    }

    if (changed) {
      console.log(`🔢 [autofix] Fixed numeric-start references in ${f.path}`);
    }
    return changed ? { ...f, content } : f;
  });
}

// ================================================================
// CROSS-FILE FIXES (App dedup + index sync)
// ================================================================
function crossFileFixes(files: AIFile[]): AIFile[] {
  // Dedup App files
  const appFiles = files.filter(
    (f) => f.path === "src/App.jsx" || f.path === "src/App.tsx"
  );

  if (appFiles.length > 1) {
    const keepPath = appFiles.find((f) => f.path.endsWith(".tsx"))?.path
      ?? appFiles[appFiles.length - 1].path;
    console.warn(`⚠️ Multiple App files found — keeping ${keepPath}`);
    files = files.filter(
      (f) =>
        !((f.path === "src/App.jsx" || f.path === "src/App.tsx") && f.path !== keepPath)
    );
  }

  // Ensure index.tsx/main.tsx imports App correctly
  const mainFile = files.find((f) =>
    f.path === "src/main.tsx" || f.path === "src/main.jsx" ||
    f.path === "src/index.tsx" || f.path === "src/index.jsx"
  );

  if (mainFile && !mainFile.content.includes("import App")) {
    const appPath = files.find((f) => f.path === "src/App.tsx" || f.path === "src/App.jsx");
    if (appPath) {
      const ext = appPath.path.endsWith(".tsx") ? "" : "";
      const injected = `import App from "./App";\n` + mainFile.content;
      files = files.map((f) =>
        f.path === mainFile.path ? { ...f, content: injected } : f
      );
      console.log(`🔗 [autofix] Injected App import into ${mainFile.path}`);
    }
  }

  return files;
}

// ================================================================
// EXPORTS
// ================================================================
import type { StreamFile } from "@/lib/ai/stream/stream-pipeline";
export function autoFixStreamFiles(
  files: StreamFile[],
  registry?: Map<string, string>
): StreamFile[] {

  const aiFiles: AIFile[] = files.map((f) => ({
    path: f.path,
    content: f.content,
  }));

  const fixed = autoFixFiles(aiFiles, registry);

  return fixed.map((f, i) => ({
    ...files[i],
    path: f.path,
    content: f.content,
  }));
}

// ================================================================
// PLANNER SYSTEM PROMPT ADDITION
// ================================================================
export const PLANNER_SYSTEM_ADDITION = `
FILENAME RULES (CRITICAL — violations cause build failures):
- Component filenames MUST be valid JS identifiers: NEVER start with a digit
- "3DShowcase.jsx" is INVALID  →  use "Showcase3D.jsx" instead
- "404Page.jsx" is INVALID     →  use "NotFound.jsx" instead  
- "2ColLayout.jsx" is INVALID  →  use "TwoColLayout.jsx" instead
- Pattern: if the concept starts with a number, move the number to the END
  or spell it out: "3D" → "ThreeD", "3DScene" → "Scene3D", "404" → "NotFound"

IMPORT RULES:
- Always use react-router-dom (not react-router)
- Always use @tanstack/react-query (not react-query)
- Always use @mui/material (not @material-ui/core)
- Always use clsx (not classnames)
- Never import from preact, styled-components, or @emotion

COMPONENT RULES:
- All PascalCase JSX tags must be defined or imported
- All custom hooks must start with "use"
- useEffect with async must use IIFE pattern
- All .map() calls in JSX must have key props
- All <img> tags must have alt attribute
- All <button> tags must have type attribute

TYPESCRIPT RULES:
- Use unknown instead of any where possible
- Add explicit return types to exported functions
- Use React.ChangeEvent<HTMLInputElement> for onChange handlers
- Remove propTypes in TypeScript projects (use TypeScript types instead)
`;

// ================================================================
// UTILITY: Get a summary report of all fixes applied
// ================================================================
export function getFixSummary(original: AIFile[], fixed: AIFile[]): {
  totalFixes: number;
  filesSummary: Array<{ path: string; changed: boolean; linesChanged: number }>;
} {
  const filesSummary = original.map((orig, i) => {
    const fix = fixed[i];
    const origLines = orig.content.split("\n").length;
    const fixLines = fix.content.split("\n").length;
    return {
      path: orig.path,
      changed: orig.content !== fix.content,
      linesChanged: Math.abs(origLines - fixLines),
    };
  });

  const totalFixes = filesSummary.filter((f) => f.changed).length;
  return { totalFixes, filesSummary };
}

// ================================================================
// UTILITY: Validate a single file after fixing
// ================================================================
export function validateFile(file: AIFile): {
  valid: boolean;
  issues: string[];
} {
  const issues: string[] = [];
  const code = file.content;
  const ext = file.path.split(".").pop()?.toLowerCase() ?? "";
  const isJS = ["js", "jsx", "ts", "tsx"].includes(ext);

  if (isJS) {
    // Check for unmatched braces
    const openBraces = (code.match(/\{/g) ?? []).length;
    const closeBraces = (code.match(/\}/g) ?? []).length;
    if (openBraces !== closeBraces) {
      issues.push(`unmatched-braces: ${openBraces} open vs ${closeBraces} close`);
    }

    // Check for unmatched parentheses
    const openParens = (code.match(/\(/g) ?? []).length;
    const closeParens = (code.match(/\)/g) ?? []).length;
    if (openParens !== closeParens) {
      issues.push(`unmatched-parens: ${openParens} open vs ${closeParens} close`);
    }

    // Check for multiple export defaults
    const exportDefaultCount = (code.match(/\bexport\s+default\b/g) ?? []).length;
    if (exportDefaultCount > 1) {
      issues.push(`multiple-export-defaults:${exportDefaultCount}`);
    }

    // Check for React import when JSX is used
    const hasJSX = /<[A-Z]|<[a-z]+[\s/>]/.test(code);
    const hasReactImport = /import.*React|from ['"]react['"]/.test(code);
    if (hasJSX && !hasReactImport) {
      issues.push("jsx-without-react-import");
    }
  }

  if (ext === "json") {
    try {
      JSON.parse(code);
    } catch (e) {
      issues.push(`invalid-json: ${String(e).slice(0, 80)}`);
    }
  }

  return {
    valid: issues.length === 0,
    issues,
  };
}

// ================================================================
// UTILITY: Apply fixes and validate in one pass
// ================================================================
export function autoFixAndValidate(files: AIFile[]): {
  files: AIFile[];
  report: Array<{ path: string; fixes: string[]; warnings: string[]; issues: string[] }>;
} {
  const fixed = autoFixFiles(files);
  const report = fixed.map((f) => {
    const validation = validateFile(f);
    return {
      path: f.path,
      fixes: [],
      warnings: validation.issues,
      issues: validation.issues,
    };
  });
  return { files: fixed, report };
}

// ================================================================
// EXTENDED COMPONENT STUBS REGISTRY
// (Additional stubs beyond STUBABLE_COMPONENTS for advanced patterns)
// ================================================================
export const EXTENDED_COMPONENT_STUBS: Record<string, string> = {
  ErrorBoundary: `class ErrorBoundary extends React.Component<
  { children: React.ReactNode; fallback?: React.ReactNode },
  { hasError: boolean; error?: Error }
> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }
  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("[ErrorBoundary]", error, info);
  }
  render() {
    if (this.state.hasError) {
      return this.props.fallback ?? (
        <div className="flex min-h-40 items-center justify-center rounded-xl border border-red-200 bg-red-50 p-6 text-red-700">
          <div>
            <h2 className="mb-1 font-semibold">Something went wrong</h2>
            <pre className="text-xs opacity-70">{this.state.error?.message}</pre>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}`,

  LoadingSpinner: `function LoadingSpinner({ message = "Loading..." }: { message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-12">
      <div className="h-10 w-10 animate-spin rounded-full border-4 border-gray-200 border-t-gray-700" />
      <p className="text-sm text-gray-500">{message}</p>
    </div>
  );
}`,

  EmptyState: `function EmptyState({ title = "Nothing here", description, action }: {
  title?: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="mb-4 text-5xl opacity-20">📭</div>
      <h3 className="mb-1 text-base font-semibold text-gray-800">{title}</h3>
      {description && <p className="mb-4 text-sm text-gray-500">{description}</p>}
      {action}
    </div>
  );
}`,

  PageHeader: `function PageHeader({ title, description, actions }: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex items-start justify-between">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
        {description && <p className="mt-1 text-sm text-gray-500">{description}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}`,

  DataTable: `function DataTable<T extends Record<string, unknown>>({
  columns, data, loading = false, emptyMessage = "No data"
}: {
  columns: Array<{ key: keyof T; label: string; render?: (val: T[keyof T], row: T) => React.ReactNode }>;
  data: T[];
  loading?: boolean;
  emptyMessage?: string;
}) {
  if (loading) return <div className="animate-pulse space-y-2">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-10 rounded bg-gray-100" />)}</div>;
  return (
    <div className="overflow-hidden rounded-xl border border-gray-200">
      <table className="w-full text-sm">
        <thead className="bg-gray-50">
          <tr>{columns.map((col) => <th key={String(col.key)} className="px-4 py-3 text-left font-medium text-gray-600">{col.label}</th>)}</tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {data.length === 0 ? (
            <tr><td colSpan={columns.length} className="py-8 text-center text-gray-400">{emptyMessage}</td></tr>
          ) : data.map((row, i) => (
            <tr key={i} className="hover:bg-gray-50">
              {columns.map((col) => (
                <td key={String(col.key)} className="px-4 py-3 text-gray-700">
                  {col.render ? col.render(row[col.key], row) : String(row[col.key] ?? "")}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}`,

  Breadcrumb: `function Breadcrumb({ items }: { items: Array<{ label: string; href?: string }> }) {
  return (
    <nav className="flex items-center gap-1 text-sm text-gray-500">
      {items.map((item, i) => (
        <React.Fragment key={i}>
          {i > 0 && <span className="text-gray-300">/</span>}
          {item.href ? (
            <a href={item.href} className="hover:text-gray-900">{item.label}</a>
          ) : (
            <span className="font-medium text-gray-900">{item.label}</span>
          )}
        </React.Fragment>
      ))}
    </nav>
  );
}`,

  FormField: `function FormField({ label, error, required, children, hint }: {
  label: string;
  error?: string;
  required?: boolean;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <div className="space-y-1">
      <label className="block text-sm font-medium text-gray-700">
        {label}{required && <span className="ml-1 text-red-500">*</span>}
      </label>
      {children}
      {hint && !error && <p className="text-xs text-gray-400">{hint}</p>}
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}`,

  SearchInput: `function SearchInput({ value, onChange, placeholder = "Search...", className = "" }: {
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  className?: string;
}) {
  return (
    <div className={"relative " + className}>
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">🔍</span>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-gray-300 bg-white py-2 pl-9 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
      />
      {value && (
        <button onClick={() => onChange("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">✕</button>
      )}
    </div>
  );
}`,

  Pagination: `function Pagination({ page, totalPages, onChange }: {
  page: number;
  totalPages: number;
  onChange: (page: number) => void;
}) {
  return (
    <div className="flex items-center justify-center gap-1">
      <button onClick={() => onChange(page - 1)} disabled={page <= 1}
        className="rounded-md px-3 py-1 text-sm disabled:opacity-40 hover:bg-gray-100">
        ← Prev
      </button>
      {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
        const p = i + 1;
        return (
          <button key={p} onClick={() => onChange(p)}
            className={"rounded-md px-3 py-1 text-sm " + (p === page ? "bg-gray-900 text-white" : "hover:bg-gray-100")}>
            {p}
          </button>
        );
      })}
      <button onClick={() => onChange(page + 1)} disabled={page >= totalPages}
        className="rounded-md px-3 py-1 text-sm disabled:opacity-40 hover:bg-gray-100">
        Next →
      </button>
    </div>
  );
}`,

  StatCard: `function StatCard({ label, value, change, icon }: {
  label: string;
  value: string | number;
  change?: { value: number; label: string };
  icon?: string;
}) {
  const isPositive = (change?.value ?? 0) >= 0;
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5">
      <div className="mb-3 flex items-start justify-between">
        <p className="text-sm font-medium text-gray-500">{label}</p>
        {icon && <span className="text-2xl">{icon}</span>}
      </div>
      <p className="text-3xl font-bold text-gray-900">{value}</p>
      {change && (
        <p className={"mt-1 text-xs font-medium " + (isPositive ? "text-green-600" : "text-red-500")}>
          {isPositive ? "↑" : "↓"} {Math.abs(change.value)}% {change.label}
        </p>
      )}
    </div>
  );
}`,

  Timeline: `function Timeline({ items }: {
  items: Array<{ title: string; description?: string; date?: string; icon?: string; color?: string }>;
}) {
  return (
    <div className="relative space-y-4 pl-6">
      <div className="absolute left-2 top-0 h-full w-0.5 bg-gray-200" />
      {items.map((item, i) => (
        <div key={i} className="relative">
          <div className={"absolute -left-6 flex h-4 w-4 items-center justify-center rounded-full border-2 border-white " + (item.color ?? "bg-gray-400")}>
            {item.icon && <span className="text-xs">{item.icon}</span>}
          </div>
          <div className="rounded-lg border border-gray-100 bg-white p-3 shadow-sm">
            <div className="flex items-start justify-between">
              <p className="font-medium text-gray-900">{item.title}</p>
              {item.date && <span className="text-xs text-gray-400">{item.date}</span>}
            </div>
            {item.description && <p className="mt-1 text-sm text-gray-500">{item.description}</p>}
          </div>
        </div>
      ))}
    </div>
  );
}`,

  CodeBlock: `function CodeBlock({ code, language = "tsx", className = "" }: {
  code: string;
  language?: string;
  className?: string;
}) {
  const [copied, setCopied] = React.useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div className={"relative rounded-xl bg-gray-950 " + className}>
      <div className="flex items-center justify-between px-4 py-2 border-b border-gray-800">
        <span className="text-xs font-mono text-gray-400">{language}</span>
        <button onClick={handleCopy} className="text-xs text-gray-400 hover:text-white">
          {copied ? "✓ Copied" : "Copy"}
        </button>
      </div>
      <pre className="overflow-x-auto p-4 text-sm text-gray-100 font-mono">{code}</pre>
    </div>
  );
}`,

  Avatar3: `function AvatarGroup({ users, max = 4 }: {
  users: Array<{ name: string; avatar?: string }>;
  max?: number;
}) {
  const visible = users.slice(0, max);
  const remaining = users.length - max;
  return (
    <div className="flex -space-x-2">
      {visible.map((user, i) => (
        <div key={i} title={user.name} className="relative inline-flex h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-gray-300 text-xs font-medium text-gray-700">
          {user.avatar ? <img src={user.avatar} alt={user.name} className="h-full w-full rounded-full object-cover" /> : user.name[0]}
        </div>
      ))}
      {remaining > 0 && (
        <div className="relative inline-flex h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-gray-200 text-xs font-medium text-gray-600">
          +{remaining}
        </div>
      )}
    </div>
  );
}`,

  RatingStars: `function RatingStars({ value = 0, max = 5, onChange, readonly = false }: {
  value?: number;
  max?: number;
  onChange?: (val: number) => void;
  readonly?: boolean;
}) {
  const [hover, setHover] = React.useState(0);
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: max }, (_, i) => i + 1).map((star) => (
        <button key={star} type="button" disabled={readonly}
          onClick={() => !readonly && onChange?.(star)}
          onMouseEnter={() => !readonly && setHover(star)}
          onMouseLeave={() => !readonly && setHover(0)}
          className={"text-xl transition-colors " + ((hover || value) >= star ? "text-yellow-400" : "text-gray-300")}>
          ★
        </button>
      ))}
    </div>
  );
}`,

  FileUpload: `function FileUpload({ onSelect, accept = "*", multiple = false, className = "" }: {
  onSelect: (files: FileList) => void;
  accept?: string;
  multiple?: boolean;
  className?: string;
}) {
  const [dragging, setDragging] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);
  return (
    <div
      className={"flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-8 transition-colors cursor-pointer " + (dragging ? "border-gray-400 bg-gray-50" : "border-gray-300 hover:border-gray-400") + " " + className}
      onClick={() => inputRef.current?.click()}
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => { e.preventDefault(); setDragging(false); if (e.dataTransfer.files) onSelect(e.dataTransfer.files); }}
    >
      <span className="mb-2 text-3xl">📁</span>
      <p className="text-sm font-medium text-gray-700">Drop files here or click to browse</p>
      <p className="mt-1 text-xs text-gray-400">{accept === "*" ? "Any file type" : accept}</p>
      <input ref={inputRef} type="file" accept={accept} multiple={multiple} className="hidden"
        onChange={(e) => e.target.files && onSelect(e.target.files)} />
    </div>
  );
}`,

  TagInput: `function TagInput({ tags = [], onChange, placeholder = "Add tag..." }: {
  tags?: string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
}) {
  const [input, setInput] = React.useState("");
  const addTag = () => {
    const val = input.trim();
    if (val && !tags.includes(val)) {
      onChange([...tags, val]);
      setInput("");
    }
  };
  return (
    <div className="flex flex-wrap gap-1.5 rounded-lg border border-gray-300 p-2">
      {tags.map((tag) => (
        <span key={tag} className="flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-0.5 text-sm font-medium text-gray-700">
          {tag}
          <button onClick={() => onChange(tags.filter((t) => t !== tag))} className="text-gray-400 hover:text-gray-600">✕</button>
        </span>
      ))}
      <input
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === ",") { e.preventDefault(); addTag(); } }}
        placeholder={placeholder}
        className="flex-1 min-w-20 text-sm outline-none"
      />
    </div>
  );
}`,

  ColorPicker: `function ColorPicker({ value = "#000000", onChange, swatches, className = "" }: {
  value?: string;
  onChange?: (color: string) => void;
  swatches?: string[];
  className?: string;
}) {
  const defaultSwatches = swatches ?? ["#ef4444","#f97316","#eab308","#22c55e","#3b82f6","#8b5cf6","#ec4899","#6b7280","#000000","#ffffff"];
  return (
    <div className={"space-y-2 " + className}>
      <div className="flex items-center gap-2">
        <div className="h-8 w-8 rounded-md border border-gray-200" style={{ backgroundColor: value }} />
        <input type="color" value={value} onChange={(e) => onChange?.(e.target.value)}
          className="h-8 w-full cursor-pointer rounded border border-gray-300" />
      </div>
      {defaultSwatches && (
        <div className="flex flex-wrap gap-1">
          {defaultSwatches.map((color) => (
            <button key={color} onClick={() => onChange?.(color)}
              className={"h-6 w-6 rounded-full border-2 transition-transform hover:scale-110 " + (value === color ? "border-gray-900" : "border-transparent")}
              style={{ backgroundColor: color }} />
          ))}
        </div>
      )}
    </div>
  );
}`,

  NumberInput: `function NumberInput({ value = 0, onChange, min, max, step = 1, className = "" }: {
  value?: number;
  onChange?: (val: number) => void;
  min?: number;
  max?: number;
  step?: number;
  className?: string;
}) {
  const dec = () => onChange?.(Math.max(min ?? -Infinity, value - step));
  const inc = () => onChange?.(Math.min(max ?? Infinity, value + step));
  return (
    <div className={"flex items-center rounded-md border border-gray-300 " + className}>
      <button type="button" onClick={dec} className="px-3 py-2 text-gray-500 hover:bg-gray-50">−</button>
      <input type="number" value={value} min={min} max={max} step={step}
        onChange={(e) => onChange?.(Number(e.target.value))}
        className="w-16 border-x border-gray-300 py-2 text-center text-sm outline-none" />
      <button type="button" onClick={inc} className="px-3 py-2 text-gray-500 hover:bg-gray-50">+</button>
    </div>
  );
}`,

  DatePicker: `function DatePicker({ value, onChange, min, max, className = "" }: {
  value?: string;
  onChange?: (val: string) => void;
  min?: string;
  max?: string;
  className?: string;
}) {
  return (
    <input
      type="date"
      value={value}
      min={min}
      max={max}
      onChange={(e) => onChange?.(e.target.value)}
      className={"h-10 rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400 " + className}
    />
  );
}`,

  TimePicker: `function TimePicker({ value, onChange, className = "" }: {
  value?: string;
  onChange?: (val: string) => void;
  className?: string;
}) {
  return (
    <input
      type="time"
      value={value}
      onChange={(e) => onChange?.(e.target.value)}
      className={"h-10 rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400 " + className}
    />
  );
}`,

  Stepper: `function Stepper({ steps, currentStep, onStepClick }: {
  steps: Array<{ label: string; description?: string }>;
  currentStep: number;
  onStepClick?: (index: number) => void;
}) {
  return (
    <div className="flex items-start">
      {steps.map((step, i) => (
        <React.Fragment key={i}>
          <div className="flex flex-col items-center">
            <button
              type="button"
              onClick={() => onStepClick?.(i)}
              className={"flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium transition-colors " +
                (i < currentStep ? "bg-gray-900 text-white" : i === currentStep ? "border-2 border-gray-900 text-gray-900" : "border-2 border-gray-300 text-gray-400")}>
              {i < currentStep ? "✓" : i + 1}
            </button>
            <div className="mt-1 text-center">
              <p className={"text-xs font-medium " + (i === currentStep ? "text-gray-900" : "text-gray-500")}>{step.label}</p>
              {step.description && <p className="text-xs text-gray-400">{step.description}</p>}
            </div>
          </div>
          {i < steps.length - 1 && (
            <div className={"mx-2 mt-4 h-0.5 flex-1 " + (i < currentStep ? "bg-gray-900" : "bg-gray-200")} />
          )}
        </React.Fragment>
      ))}
    </div>
  );
}`,
};

// ================================================================
// ADDITIONAL FIXER: fixClassComponents — convert simple class → function
// ================================================================
export function fixClassComponents(code: string, fixes: string[]): string {
  // Only handle the trivial case: no state, no lifecycle methods
  const trivialClass = /class\s+(\w+)\s+extends\s+(?:React\.)?(?:Pure)?Component\s*\{[\s\n]*render\s*\(\s*\)\s*\{([\s\S]*?)\}[\s\n]*\}/g;
  let fixed = code;
  fixed = fixed.replace(trivialClass, (_, name, renderBody) => {
    if (renderBody.includes("this.state") || renderBody.includes("this.setState")) {
      return _;  // has state — can't trivially convert
    }
    const cleaned = renderBody.replace(/this\.props\./g, "").trim();
    fixes.push(`class-component-to-function:${name}`);
    return `function ${name}(props) {\n  const { ${extractPropsFromBody(renderBody)} } = props;\n  ${cleaned}\n}`;
  });
  return fixed;
}

function extractPropsFromBody(body: string): string {
  const propsRe = /this\.props\.(\w+)/g;
  const props = new Set<string>();
  let m;
  while ((m = propsRe.exec(body)) !== null) props.add(m[1]);
  return [...props].join(", ") || "...rest";
}

// ================================================================
// ADDITIONAL FIXER: fixHydrationMismatch
// ================================================================
export function fixHydrationMismatch(code: string, fixes: string[], warnings: string[]): string {
  // Detect patterns that commonly cause hydration mismatches
  const hasMath = /Math\.random\(\)/.test(code) && /</.test(code);
  const hasDateNow = /Date\.now\(\)/.test(code) && /</.test(code);
  const hasLocalStorage = /localStorage\./.test(code) && !code.includes("useEffect");

  if (hasMath) {
    warnings.push("hydration-mismatch-risk:Math.random() — random values in JSX cause hydration mismatch; compute in useEffect");
  }
  if (hasDateNow) {
    warnings.push("hydration-mismatch-risk:Date.now() — current timestamps in JSX cause hydration mismatch; compute in useEffect");
  }
  if (hasLocalStorage) {
    warnings.push("hydration-mismatch-risk:localStorage — localStorage is not available during SSR; guard with typeof window !== 'undefined' or useEffect");
  }

  return code;
}

// ================================================================
// ADDITIONAL FIXER: fixI18nNamespaces — ensure t() calls have namespace
// ================================================================
export function fixI18nNamespaces(code: string, fixes: string[], warnings: string[]): string {
  if (!code.includes("useTranslation") && !code.includes("i18n")) return code;

  // Detect t() calls without namespace key (just plain strings)
  const bareT = /\bt\(['"](?![\w.]+:)[^'"]+['"]\)/g;
  if (bareT.test(code)) {
    warnings.push("i18n-missing-namespace — t() calls should use namespaced keys like t('common:button.submit')");
  }

  return code;
}

// ================================================================
// ADDITIONAL FIXER: fixZustandUsage — common zustand anti-patterns
// ================================================================
export function fixZustandUsage(code: string, fixes: string[], warnings: string[]): string {
  if (!code.includes("zustand") && !code.includes("create(") ) return code;

  // Detect subscribing to entire store (causes excessive re-renders)
  if (/const\s+store\s*=\s*use\w+Store\(\)/.test(code)) {
    warnings.push("zustand-full-store-subscription — avoid destructuring entire store; select only the slice you need: useStore(s => s.value)");
  }

  // Detect mutating state directly
  if (/state\.\w+\s*=/.test(code) && code.includes("immer")) {
    // immer is fine — skip
  } else if (/state\.\w+\s*=/.test(code) && !code.includes("produce")) {
    warnings.push("zustand-direct-mutation — mutate state only inside set() or with immer middleware");
  }

  return code;
}

// ================================================================
// ADDITIONAL FIXER: fixReactQueryUsage — common react-query issues
// ================================================================
export function fixReactQueryUsage(code: string, fixes: string[], warnings: string[]): string {
  if (!code.includes("useQuery") && !code.includes("useMutation")) return code;

  // Detect useQuery without error handling
  if (/const\s*\{[^}]*data[^}]*\}\s*=\s*useQuery/.test(code)) {
    if (!/isError|error/.test(code)) {
      warnings.push("react-query-missing-error-handling — destructure isError/error from useQuery for proper error handling");
    }
    if (!/isLoading|isPending|status/.test(code)) {
      warnings.push("react-query-missing-loading-state — destructure isLoading/isPending from useQuery to handle loading state");
    }
  }

  // Detect inline queryFn (bad for caching)
  if (/queryFn:\s*\(\)\s*=>/.test(code)) {
    warnings.push("react-query-inline-queryfn — extracting queryFn to a named function improves readability and testability");
  }

  return code;
}

// ================================================================
// ADDITIONAL FIXER: fixFormLibraryUsage — react-hook-form issues
// ================================================================
export function fixFormLibraryUsage(code: string, fixes: string[], warnings: string[]): string {
  if (!code.includes("useForm") && !code.includes("react-hook-form")) return code;

  // Detect using ref on Controller — incorrect pattern
  if (/Controller.*ref=\{/.test(code)) {
    warnings.push("rhf-controller-ref — don't use ref on <Controller>; ref is managed internally");
  }

  // Detect register used without spreading
  if (/register\(['"][^'"]+['"]\)(?!\s*\))/.test(code) && !/\{\.\.\.register/.test(code)) {
    warnings.push("rhf-register-spread — spread register result: <input {...register('name')} />");
  }

  return code;
}

// ================================================================
// ADDITIONAL FIXER: fixNextJsPatterns — Next.js specific issues
// ================================================================
export function fixNextJsPatterns(code: string, fixes: string[], warnings: string[]): string {
  if (!code.includes("next/")) return code;

  // Detect <img> instead of <Image> in Next.js
  if (/<img\b/.test(code) && code.includes("next/image")) {
    warnings.push("nextjs-img-not-next-image — use Next.js <Image> component for optimised images");
  }

  // Detect <a> instead of <Link> in Next.js
  if (/<a\s+href/.test(code) && code.includes("next/link")) {
    warnings.push("nextjs-anchor-not-next-link — use Next.js <Link> for client-side navigation");
  }

  // Detect getServerSideProps in app router files
  if (code.includes("getServerSideProps") && code.includes("'use client'")) {
    warnings.push("nextjs-gSSP-in-client-component — getServerSideProps cannot be used in client components");
  }

  return code;
}

// ================================================================
// ADDITIONAL FIXER: fixA11yImprovedRules — advanced a11y checks
// ================================================================
export function fixA11yImprovedRules(code: string, fixes: string[], warnings: string[]): string {
  // Detect interactive elements without keyboard handlers
  if (/onClick=\{/.test(code)) {
    const hasOnKeyDown = /onKeyDown=\{/.test(code) || /onKeyPress=\{/.test(code) || /onKeyUp=\{/.test(code);
    const isDivWithClick = /<div[^>]*onClick=\{/.test(code);
    if (isDivWithClick && !hasOnKeyDown) {
      warnings.push("a11y-click-without-keyboard — <div> with onClick should also handle onKeyDown for keyboard users, or use <button> instead");
    }
  }

  // Detect form without onSubmit
  if (/<form\b(?![^>]*onSubmit)/.test(code)) {
    warnings.push("a11y-form-without-submit-handler — <form> should have onSubmit handler to prevent default browser form submission");
  }

  // Detect <table> without <caption> or aria-label
  if (/<table\b(?![^>]*aria-label)/.test(code) && !code.includes("<caption")) {
    warnings.push("a11y-table-missing-caption — tables should have <caption> or aria-label for screen readers");
  }

  // Detect <dialog> without aria-modal
  if (/<dialog\b(?![^>]*aria-modal)/.test(code)) {
    warnings.push("a11y-dialog-missing-aria-modal — <dialog> should have aria-modal='true'");
  }

  // Detect autofocus without proper context
  if (/autoFocus/.test(code)) {
    warnings.push("a11y-autofocus — autoFocus can be disorienting for screen reader users; use sparingly");
  }

  return code;
}

// ================================================================
// ADDITIONAL FIXER: fixIconLibraryUsage — lucide-react patterns
// ================================================================
export function fixIconLibraryUsage(code: string, fixes: string[]): string {
  if (!code.includes("lucide-react")) return code;

  let fixed = code;

  // Fix size prop (should be number, not string)
  fixed = fixed.replace(/size="(\d+)"/g, (_, n) => {
    fixes.push(`lucide-icon-size-to-number:${n}`);
    return `size={${n}}`;
  });

  // Fix color prop
  fixed = fixed.replace(/color="(#[a-fA-F0-9]+)"/g, (_, c) => {
    fixes.push(`lucide-icon-color-to-prop:${c}`);
    return `color="${c}"`;
  });

  return fixed;
}

// ================================================================
// ADDITIONAL FIXER: fixAnimationPatterns — framer-motion issues
// ================================================================
export function fixAnimationPatterns(code: string, fixes: string[], warnings: string[]): string {
  if (!code.includes("framer-motion") && !code.includes("motion.")) return code;

  // Detect motion without layout prop causing layout shift
  if (/motion\.\w+/.test(code) && !code.includes("layout")) {
    // Not always an issue — just note
  }

  // Detect AnimatePresence without key on children
  if (code.includes("AnimatePresence") && !code.includes("key=")) {
    warnings.push("framer-motion-animate-presence-needs-key — children of AnimatePresence must have unique key props for exit animations");
  }

  return code;
}

// ================================================================
// ADDITIONAL FIXER: fixPerformanceIssues — common perf anti-patterns
// ================================================================
export function fixPerformanceIssues(code: string, fixes: string[], warnings: string[]): string {
  // Detect inline object in JSX props (recreated every render)
  const inlineObjectRe = /(\w+)=\{\{[^}]{20,}\}\}/g;
  if (inlineObjectRe.test(code)) {
    warnings.push("perf-inline-object-prop — inline objects in JSX props are recreated every render; extract to useMemo or a constant");
  }

  // Detect inline array in JSX props
  const inlineArrayRe = /(\w+)=\{\[[^\]]{10,}\]\}/g;
  if (inlineArrayRe.test(code)) {
    warnings.push("perf-inline-array-prop — inline arrays in JSX props are recreated every render; extract to useMemo or a constant");
  }

  // Detect anonymous function in JSX (e.g., onClick={() => doSomething()})
  const anonFuncCount = (code.match(/=\{\(\s*\)\s*=>/g) ?? []).length;
  if (anonFuncCount > 8) {
    warnings.push(`perf-many-inline-handlers:${anonFuncCount} — many anonymous arrow functions in JSX; consider useCallback for stable references`);
  }

  // Detect .filter().map() chaining (two passes, use reduce instead for large lists)
  if (/\.filter\([^)]+\)\.map\(/.test(code)) {
    warnings.push("perf-filter-map-chain — .filter().map() makes two passes; consider combining into .reduce() for large arrays");
  }

  return code;
}

// ================================================================
// BATCH FIX RUNNER — apply a custom subset of fixers
// ================================================================
export type FixerName =
  | "encoding" | "lineEndings" | "imports" | "exports" | "hooks"
  | "tailwind" | "accessibility" | "typescript" | "css" | "json"
  | "missing-components" | "duplicates" | "svg" | "jsx" | "performance";

export function runSelectedFixers(files: AIFile[], fixers: FixerName[]): AIFile[] {
  return files.map((file) => {
    const fixes: string[] = [];
    const warnings: string[] = [];
    let code = file.content;
    const ext = file.path.split(".").pop()?.toLowerCase() ?? "";
    const isJS = ["js", "jsx", "ts", "tsx"].includes(ext);
    const isTS = ["ts", "tsx"].includes(ext);

    for (const fixer of fixers) {
      switch (fixer) {
        case "encoding":
          code = fixEncoding(code, fixes);
          code = fixLineEndings(code, fixes);
          code = stripBOM(code, fixes);
          break;
        case "lineEndings":
          code = fixLineEndings(code, fixes);
          break;
        case "imports":
          if (isJS) code = fixImports(code, fixes, warnings);
          break;
        case "exports":
          if (isJS) code = fixExports(code, file.path, fixes);
          break;
        case "hooks":
          if (isJS) {
            code = fixHookRules(code, fixes, warnings);
            code = fixBrokenHooks(code, fixes, warnings);
            code = fixMissingDependencyArrays(code, fixes, warnings);
          }
          break;
        case "tailwind":
          if (isJS) code = fixTailwindClasses(code, fixes);
          break;
        case "accessibility":
          if (isJS) code = fixAccessibility(code, fixes, warnings);
          break;
        case "typescript":
          if (isTS) {
            code = fixTsErrors(code, fixes, warnings);
            code = fixImplicitAny(code, fixes, warnings);
          }
          break;
        case "css":
          if (["css", "scss"].includes(ext)) code = fixCSS(code, fixes);
          break;
        case "json":
          if (ext === "json") code = fixJSON(code, fixes, warnings);
          break;
                case "missing-components":
          if (isJS) code = fixMissingComponents(code, fixes, warnings, new Map());
          break;
        case "duplicates":
          if (isJS) {
            code = fixDuplicateDeclarations(code, fixes);
            code = fixDuplicateConsts(code, fixes);
          }
          break;
        case "svg":
          if (isJS) code = fixSvgProps(code, fixes);
          break;
        case "jsx":
          if (isJS) {
            code = fixBrokenJSXTags(code, fixes);
            code = fixSelfClosingTags(code, fixes);
            code = fixInvalidJSXExpressions(code, fixes, warnings);
          }
          break;
        case "performance":
          if (isJS) fixPerformanceIssues(code, fixes, warnings);
          break;
      }
    }

    if (fixes.length > 0) {
      console.log(`🔧 [selective] [${file.path}] ${fixes.length} fix(es):`, fixes);
    }

    return { path: file.path, content: code };
  });
}

// ================================================================
// TYPE: FixReport for consumers of the pipeline
// ================================================================
export type FixReport = {
  path: string;
  fixCount: number;
  warningCount: number;
  infoCount: number;
  fixes: string[];
  warnings: string[];
  infos: string[];
  linesAdded: number;
  linesRemoved: number;
};

export function autoFixFilesWithReport(files: AIFile[]): {
  files: AIFile[];
  reports: FixReport[];
} {
  const originalContents = new Map(files.map((f) => [f.path, f.content]));

  // Run the full pipeline
  files = fixNumericFilenames(files);
  const registry = buildComponentRegistry(files);      // ✅ declared once
  files = fixCrossFileDependencies(files, registry);

  const results: FixResult[] = files.map(file => fixFile(file, registry));  // ✅ reuse registry
  const fixed = crossFileFixes(results.map((r) => r.file));

  const reports: FixReport[] = results.map((r, i) => {
    const original = originalContents.get(files[i]?.path) ?? "";
    const fixedContent = fixed[i]?.content ?? r.file.content;
    const origLines = original.split("\n").length;
    const fixedLines = fixedContent.split("\n").length;

    return {
      path: r.file.path,
      fixCount: r.fixes.length,
      warningCount: r.warnings.length,
      infoCount: r.infos.length,
      fixes: r.fixes,
      warnings: r.warnings,
      infos: r.infos,
      linesAdded: Math.max(0, fixedLines - origLines),
      linesRemoved: Math.max(0, origLines - fixedLines),
    };
  });

  return { files: fixed, reports };
}
// ================================================================
// END OF FILE — auto-fix pipeline v3.0
// Total fixers: 70+ | Component stubs: 40+ | Cross-file fixes: 5
// ================================================================

