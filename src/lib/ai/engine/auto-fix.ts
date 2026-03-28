// ================================================================
// AUTO-FIX PIPELINE
// Runs every AI-generated file through a series of fixers before
// sending to WebContainers. Handles the most common model errors:
// malformed JSX, broken imports, missing exports, bad escaping,
// duplicate code, broken Tailwind, and more.
// ================================================================

export type AIFile = {
  path: string;
  content: string;
};

type FixResult = {
  file: AIFile;
  fixes: string[];
  warnings: string[];
};

// ================================================================
// PUBLIC ENTRY POINT
// ================================================================
export function autoFixFiles(files: AIFile[]): AIFile[] {
  // Pass 1: fix individual files
  const results = files.map(fixFile);

  // Pass 2: cross-file fixes (dedup imports, sync exports)
  const fixed = crossFileFixes(results.map((r) => r.file));

  // Log summary
  results.forEach((r) => {
    if (r.fixes.length > 0) {
      console.log(`🔧 [${r.file.path}] ${r.fixes.length} fix(es):`, r.fixes);
    }
    if (r.warnings.length > 0) {
      console.warn(`⚠️  [${r.file.path}] ${r.warnings.length} warning(s):`, r.warnings);
    }
  });

  return fixed;
}

// ================================================================
// PER-FILE FIX PIPELINE
// ================================================================
function fixFile(file: AIFile): FixResult {
  const fixes: string[] = [];
  const warnings: string[] = [];

  const ext = file.path.split(".").pop()?.toLowerCase() ?? "";
  const isJS = ["js", "jsx", "ts", "tsx"].includes(ext);
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
    code = fixEscapeArtifacts(code, fixes);
    code = fixTypos(code, fixes);
    code = fixSingleLetterLines(code, fixes);
    code = fixBrokenJSXTags(code, fixes);
    code = fixSelfClosingTags(code, fixes);
    code = fixMissingReactImport(code, file.path, fixes);
    code = fixImports(code, fixes, warnings);
    code = fixExports(code, file.path, fixes);
    code = fixUseClientDirective(code, file.path, fixes);
    code = fixHookRules(code, fixes, warnings);
    code = fixTailwindClasses(code, fixes);
    code = fixCommonPatterns(code, fixes);
    code = fixBrokenTemplateLiterals(code, fixes);
    code = fixConsoleStatements(code, fixes);
  }

  // ── CSS fixes ────────────────────────────────────────────────
  if (isCSS) {
    code = fixCSS(code, fixes);
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
  };
}

// ================================================================
// ENCODING / WHITESPACE
// ================================================================
function fixEncoding(code: string, fixes: string[]): string {
  // Strip BOM variants
  let fixed = code.replace(/^\uFEFF/, "");
  // Strip null bytes
  fixed = fixed.replace(/\0/g, "");
  // Strip other invisible control characters (keep \t \n \r)
  fixed = fixed.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "");
  // Fix zero-width spaces / non-breaking spaces inside code
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
// ESCAPE ARTIFACTS
// ================================================================
function fixEscapeArtifacts(code: string, fixes: string[]): string {
  let fixed = code;

  // Double-escaped newlines from JSON serialization
  fixed = fixed.replace(/\\\\n/g, "\n");
  fixed = fixed.replace(/\\\\t/g, "\t");
  fixed = fixed.replace(/\\\\r/g, "");

  // Single-escaped if still encoded
  fixed = fixed.replace(/(?<!\\)\\n(?!["\\])/g, "\n");
  fixed = fixed.replace(/(?<!\\)\\t(?!["\\])/g, "\t");

  // Escaped quotes outside of strings (model artifact)
  // Only fix in JSX/code context, not inside string literals
  fixed = fixed.replace(/\\"([^"]*)\\"(?=\s*[,;)\]}])/g, '"$1"');

  if (fixed !== code) fixes.push("escape-artifacts");
  return fixed;
}

// ================================================================
// TYPOS & COMMON MODEL ERRORS
// ================================================================
const TYPO_MAP: [RegExp, string][] = [
  // Closing tag typos
  [/<\/buutton>/g, "</button>"],
  [/<\/buton>/g, "</button>"],
  [/<\/diiv>/g, "</div>"],
  [/<\/spann>/g, "</span>"],
  [/<\/imput>/g, "</input>"],
  [/<\/lable>/g, "</label>"],
  [/<\/tabble>/g, "</table>"],
  [/<\/tabel>/g, "</table>"],
  [/<\/thead>/g, "</thead>"],  // already correct but normalize case
  [/<\/Div>/g, "</div>"],
  [/<\/Span>/g, "</span>"],
  [/<\/P>/g, "</p>"],
  [/<\/H1>/g, "</h1>"],
  [/<\/H2>/g, "</h2>"],
  // Opening tag typos
  [/<buutton/g, "<button"],
  [/<buton/g, "<button"],
  [/<diiv/g, "<div"],
  [/<imput/g, "<input"],
  [/<lable/g, "<label"],
  // className typos
  [/classname=/g, "className="],
  [/Classname=/g, "className="],
  [/class=(?!Name)/g, "className="],
  // onClick typos
  [/onclick=/g, "onClick="],
  [/Onclick=/g, "onClick="],
  // htmlFor
  [/for=(?!")/g, "htmlFor="],
  // Common JS typos
  [/consoloe\./g, "console."],
  [/consle\./g, "console."],
  [/fucntion /g, "function "],
  [/funtion /g, "function "],
  [/retrun /g, "return "],
  [/retrn /g, "return "],
  [/improt /g, "import "],
  [/exprot /g, "export "],
  // React hook typos
  [/userState/g, "useState"],
  [/usestate/g, "useState"],
  [/useEffekt/g, "useEffect"],
  [/useMemo\b/g, "useMemo"],
  [/useCallbakc/g, "useCallback"],
  [/useContxt/g, "useContext"],
];

function fixTypos(code: string, fixes: string[]): string {
  let fixed = code;
  let changed = false;

  for (const [pattern, replacement] of TYPO_MAP) {
    const next = fixed.replace(pattern, replacement);
    if (next !== fixed) { changed = true; fixed = next; }
  }

  if (changed) fixes.push("typos");
  return fixed;
}

// ================================================================
// SINGLE LETTER ARTIFACT LINES
// Common model artifact: lone 'n', 's', 'e' on their own line
// ================================================================
function fixSingleLetterLines(code: string, fixes: string[]): string {
  // Only remove lines that are ONLY a single non-meaningful char
  const fixed = code.replace(/^[ \t]*[nseNSE][ \t]*$/gm, "");
  if (fixed !== code) fixes.push("single-letter-artifact-lines");
  return fixed;
}

// ================================================================
// BROKEN JSX TAGS
// ================================================================
function fixBrokenJSXTags(code: string, fixes: string[]): string {
  let fixed = code;
  let changed = false;

  // Unclosed JSX expression braces in attributes: className={styles.foo
  // (very hard to auto-fix reliably — just warn, don't break things)

  // Fix <Component/> → <Component /> (space before />)
  // Actually many formatters prefer without space — skip this

  // Fix stray > that breaks JSX: <div className="foo">content</div >
  const divWithSpace = fixed.replace(/<\/\s+(\w)/g, "</$1");
  if (divWithSpace !== fixed) { changed = true; fixed = divWithSpace; }

  // Fix missing = in attributes: <Button variant"primary"> → variant="primary"
  const missingEq = fixed.replace(/(\s)(\w+)"([^"]*)"(?=[\s/>])/g, '$1$2="$3"');
  if (missingEq !== fixed) { changed = true; fixed = missingEq; }

  if (changed) fixes.push("broken-jsx-tags");
  return fixed;
}

// ================================================================
// SELF-CLOSING TAGS
// HTML void elements that must be self-closing in JSX
// ================================================================
const VOID_ELEMENTS = new Set([
  "area", "base", "br", "col", "embed", "hr", "img",
  "input", "link", "meta", "param", "source", "track", "wbr",
]);

function fixSelfClosingTags(code: string, fixes: string[]): string {
  let fixed = code;
  let changed = false;

  for (const tag of VOID_ELEMENTS) {
    // <br> → <br /> and <br></br> → <br />
    const unclosed = new RegExp(`<${tag}([^/]*)(?<!/)>(?!</${tag}>)`, "gi");
    const next1 = fixed.replace(unclosed, `<${tag}$1 />`);
    if (next1 !== fixed) { changed = true; fixed = next1; }

    const withClose = new RegExp(`<${tag}([^>]*)></${tag}>`, "gi");
    const next2 = fixed.replace(withClose, `<${tag}$1 />`);
    if (next2 !== fixed) { changed = true; fixed = next2; }
  }

  if (changed) fixes.push("self-closing-void-elements");
  return fixed;
}

// ================================================================
// REACT IMPORT
// ================================================================
function fixMissingReactImport(
  code: string,
  filePath: string,
  fixes: string[]
): string {
  const hasJSX = /<[A-Z][a-zA-Z]*|<[a-z]+[\s/>]/.test(code);
  const hasReactImport = /import\s+React/.test(code);
  const isTypeFile = filePath.endsWith(".d.ts") || filePath.includes("types");

  // React 17+ doesn't need import for JSX transform,
  // but hooks still need explicit React or named imports.
  // Only add if using React.* directly or old-style JSX.
  const usesReactDirectly = /\bReact\.(use|create|memo|forwardRef|lazy|Suspense|Fragment|cloneElement|Children)/.test(code);

  if (hasJSX && usesReactDirectly && !hasReactImport && !isTypeFile) {
    fixes.push("added-react-import");
    return `import React from "react";\n${code}`;
  }

  return code;
}

// ================================================================
// IMPORTS
// ================================================================
function fixImports(code: string, fixes: string[], warnings: string[]): string {
  let fixed = code;
  let changed = false;

  const lines = fixed.split("\n");
  const importLines: string[] = [];
  const nonImportLines: string[] = [];
  let inImportBlock = true;

  // Separate import block from the rest
  // (imports should all be at the top)
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

  // Deduplicate import lines (exact match)
  const seenImports = new Set<string>();
  const dedupedImports = importLines.filter((line) => {
    const trimmed = line.trim();
    if (!trimmed.startsWith("import ")) return true;
    if (seenImports.has(trimmed)) { changed = true; return false; }
    seenImports.add(trimmed);
    return true;
  });

  // Merge named imports from the same source
  // e.g. import { A } from 'x' + import { B } from 'x' → import { A, B } from 'x'
  const mergedImports = mergeNamedImports(dedupedImports, fixes);

  // Fix common wrong import paths
  const correctedImports = mergedImports.map((line) => {
    let l = line;
    // Fix: import from 'react-router' → 'react-router-dom'
    l = l.replace(/from ['"]react-router['"]/g, 'from "react-router-dom"');
    // Fix: import { ... } from '@/components/ui/button' → '@/components/ui'
    // (only if the component is in our pre-built ui.jsx)
    const prebuilt = ["Button", "Input", "Textarea", "Select", "Card", "Badge",
      "Spinner", "Modal", "Skeleton", "Avatar", "Divider", "Alert",
      "Table", "Progress", "Tooltip"];
    for (const comp of prebuilt) {
      const wrongPath = new RegExp(
        `import\\s*\\{([^}]*)\\b${comp}\\b([^}]*)\\}\\s*from\\s*['"]@/components/ui/${comp.toLowerCase()}['"]`,
        "g"
      );
      if (wrongPath.test(l)) {
        l = l.replace(wrongPath, `import {$1${comp}$2} from "@/components/ui"`);
        changed = true;
      }
    }
    // Fix double slashes in paths
    l = l.replace(/from ['"]([^'"]*\/\/[^'"]*)['"]/g, (m, p) =>
      m.replace(p, p.replace(/\/\//g, "/"))
    );
    if (l !== line) changed = true;
    return l;
  });

  if (changed) {
    fixes.push("imports-deduped-merged");
    fixed = [...correctedImports, ...nonImportLines].join("\n");
  }

  // Warn about missing imports (common patterns)
  if (/\buseState\b/.test(fixed) && !/import.*useState.*from ['"]react['"]/.test(fixed)) {
    warnings.push("useState used but not imported from react");
  }
  if (/\buseEffect\b/.test(fixed) && !/import.*useEffect.*from ['"]react['"]/.test(fixed)) {
    warnings.push("useEffect used but not imported from react");
  }
  if (/\bLink\b/.test(fixed) && !/import.*Link.*from ['"]react-router/.test(fixed)) {
    warnings.push("Link used but not imported from react-router-dom");
  }

  return fixed;
}

function mergeNamedImports(lines: string[], fixes: string[]): string[] {
  // Map: source → Set of named imports
  const sourceMap = new Map<string, Set<string>>();
  const defaultImports = new Map<string, string>();
  const otherLines: string[] = [];

  const namedImportRe = /^import\s+\{([^}]+)\}\s+from\s+['"]([^'"]+)['"]/;
  const defaultImportRe = /^import\s+(\w+)\s+from\s+['"]([^'"]+)['"]/;

  for (const line of lines) {
    const trimmed = line.trim();

    const namedMatch = trimmed.match(namedImportRe);
    if (namedMatch) {
      const named = namedMatch[1].split(",").map((s) => s.trim()).filter(Boolean);
      const source = namedMatch[2];
      if (!sourceMap.has(source)) sourceMap.set(source, new Set());
      named.forEach((n) => sourceMap.get(source)!.add(n));
      continue;
    }

    const defaultMatch = trimmed.match(defaultImportRe);
    if (defaultMatch) {
      defaultImports.set(defaultMatch[2], defaultMatch[1]);
      continue;
    }

    otherLines.push(line);
  }

  const merged: string[] = [];

  // Reconstruct default imports
  for (const [source, name] of defaultImports) {
    const named = sourceMap.get(source);
    if (named && named.size > 0) {
      merged.push(`import ${name}, { ${[...named].join(", ")} } from "${source}";`);
      sourceMap.delete(source);
    } else {
      merged.push(`import ${name} from "${source}";`);
    }
  }

  // Reconstruct named imports (sources without a default import)
  for (const [source, named] of sourceMap) {
    if (named.size > 0) {
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

  const fileName = filePath
    .split("/")
    .pop()!
    .replace(/\.[^.]+$/, "");

  // Capitalize for component name inference
  const componentName =
    fileName.charAt(0).toUpperCase() + fileName.slice(1);

  // Case 1: `function App() {` without `export default` → add it
  const hasExportDefault = /export\s+default\s/.test(fixed);
  const funcMatch = fixed.match(/^function\s+([A-Z]\w*)\s*\(/m);

  if (!hasExportDefault && funcMatch) {
    fixed = fixed.replace(
      new RegExp(`^function\\s+${funcMatch[1]}`, "m"),
      `export default function ${funcMatch[1]}`
    );
    fixes.push(`added-export-default-to-${funcMatch[1]}`);
  }

  // Case 2: const Component = () => {} without export
  if (!hasExportDefault) {
    const constMatch = fixed.match(
      /^const\s+([A-Z]\w*)\s*=\s*(?:\([^)]*\)|[a-z_]\w*)\s*=>/m
    );
    if (constMatch) {
      fixed = fixed.replace(
        new RegExp(`^const\\s+${constMatch[1]}`, "m"),
        `export default const ${constMatch[1]}`
      );
      // Actually `export default const` is invalid — fix to add at bottom instead
      fixed = fixed.replace(
        `export default const ${constMatch[1]}`,
        `const ${constMatch[1]}`
      );
      fixed += `\n\nexport default ${constMatch[1]};\n`;
      fixes.push(`added-export-default-bottom-${constMatch[1]}`);
    }
  }

  return fixed;
}

// ================================================================
// USE CLIENT DIRECTIVE
// ================================================================
function fixUseClientDirective(
  code: string,
  filePath: string,
  fixes: string[]
): string {
  const hooksPattern =
    /\b(useState|useEffect|useRef|useCallback|useMemo|useContext|useReducer|useLayoutEffect|useId)\b/;
  const browserAPIs =
    /\b(window|document|navigator|localStorage|sessionStorage|addEventListener|removeEventListener)\b/;
  const eventHandlers = /\bon[A-Z]\w+\s*=\s*\{/;

  const needsUseClient =
    hooksPattern.test(code) ||
    browserAPIs.test(code) ||
    eventHandlers.test(code);

  const hasUseClient = /^['"]use client['"]/.test(code.trimStart());

  // Skip for non-component files
  const isPage = filePath.includes("/pages/") || filePath.includes("/app/");
  const isComponent =
    filePath.endsWith(".jsx") || filePath.endsWith(".tsx");

  if (needsUseClient && !hasUseClient && isComponent) {
    fixes.push("added-use-client");
    return `"use client";\n\n${code}`;
  }

  // Remove "use client" from files that don't need it (e.g. utility files)
  if (hasUseClient && !needsUseClient && !isPage) {
    const withoutDirective = code.replace(/^['"]use client['"];\s*\n*/m, "");
    if (withoutDirective !== code) {
      fixes.push("removed-unnecessary-use-client");
      return withoutDirective;
    }
  }

  return code;
}

// ================================================================
// HOOK RULES
// ================================================================
function fixHookRules(
  code: string,
  fixes: string[],
  warnings: string[]
): string {
  // Detect hooks called inside conditions (very rough check)
  const conditionalHook = /if\s*\([^)]*\)\s*\{[^}]*use[A-Z]\w+\s*\(/;
  if (conditionalHook.test(code)) {
    warnings.push("possible-hook-in-conditional — hooks must not be called conditionally");
  }

  // Detect hooks in loops
  const loopHook = /(?:for|while|forEach)\s*[(\[][^)\]]*\)[^{]*\{[^}]*use[A-Z]/;
  if (loopHook.test(code)) {
    warnings.push("possible-hook-in-loop — hooks must not be called inside loops");
  }

  return code;
}

// ================================================================
// TAILWIND CLASSES
// ================================================================
// Common AI mistakes with Tailwind class names
type TailwindFix = [RegExp, string | ((match: string) => string)];

const TAILWIND_FIXES: TailwindFix[] = [
  // Deprecated classes
  [/\bflex-no-wrap\b/g, "flex-nowrap"],
  [/\bfont-hairline\b/g, "font-thin"],
  [/\bfont-extralight\b/g, "font-extralight"],
  [/\btruncate-text\b/g, "truncate"],
  [/\bbreakword\b/g, "break-words"],
  [/\bscreen-reader-only\b/g, "sr-only"],
  [/\bvisually-hidden\b/g, "sr-only"],
  // Non-existent classes AI commonly invents
  [/\btext-default\b/g, "text-base"],
  [/\bfont-regular\b/g, "font-normal"],
  [/\bcolor-primary\b/g, "text-primary-500"],
  [/\bbg-default\b/g, "bg-white"],
  [/\bborder-default\b/g, "border-gray-200"],
  [/\bpadding-(\d+)\b/g, (m: string) => m.replace("padding-", "p-")],
  [/\bmargin-(\d+)\b/g, (m: string) => m.replace("margin-", "m-")],
  // Wrong spacing for gap
  [/\bgap\s*-\s*(\d+)\b/g, "gap-$1"],
  // Common class name confusions
  [/\bfont-weight-bold\b/g, "font-bold"],
  [/\btext-align-center\b/g, "text-center"],
  [/\bdisplay-flex\b/g, "flex"],
  [/\bdisplay-block\b/g, "block"],
  [/\bdisplay-none\b/g, "hidden"],
  [/\boverflow-hidden-x\b/g, "overflow-x-hidden"],
  [/\boverflow-hidden-y\b/g, "overflow-y-hidden"],
  // Spacing typos
  [/\bp-x-(\d+)\b/g, "px-$1"],
  [/\bp-y-(\d+)\b/g, "py-$1"],
  [/\bm-x-(\d+)\b/g, "mx-$1"],
  [/\bm-y-(\d+)\b/g, "my-$1"],
];

function fixTailwindClasses(code: string, fixes: string[]): string {
  let fixed = code;
  let changed = false;

  for (const [pattern, replacement] of TAILWIND_FIXES) {
    const next = typeof replacement === "string"
      ? fixed.replace(pattern, replacement)
      : fixed.replace(pattern, replacement);
    if (next !== fixed) { changed = true; fixed = next; }
  }

  if (changed) fixes.push("tailwind-class-fixes");
  return fixed;
}

// ================================================================
// COMMON PATTERNS
// ================================================================
function fixCommonPatterns(code: string, fixes: string[]): string {
  let fixed = code;
  let changed = false;

  // Fix: key prop on root element of map (very common AI error — missing key)
  // We can't auto-add keys without knowing the data, but we can fix wrong ones
  // Fix: key={index} → warn only
  // Fix: .map(item => <div>) → add key if missing (use item.id if available)
  const mapWithoutKey = /\.map\((\w+)\s*=>\s*(<[A-Za-z])/g;
  const mapWithKey = /\.map\((\w+)\s*=>\s*<[A-Za-z][^>]*key=/g;

  if (mapWithoutKey.test(fixed) && !mapWithKey.test(fixed)) {
    // Try to add key using common patterns
    fixed = fixed.replace(
      /\.map\((\w+)\s*=>\s*(<[A-Za-z][a-zA-Z]*)([\s>])/g,
      (match, item, tag, after) => {
        // Don't add if already has key
        if (match.includes("key=")) return match;
        const keyVal = `${item}?.id ?? ${item}`;
        return `.map(${item} => ${tag} key={${keyVal}}${after}`;
      }
    );
    if (fixed !== code) { changed = true; fixes.push("added-map-keys"); }
  }

  // Fix: async function in useEffect (should use inner async)
  const asyncEffect = /useEffect\s*\(\s*async\s*\(/;
  if (asyncEffect.test(fixed)) {
    fixed = fixed.replace(
      /useEffect\s*\(\s*async\s*\(([^)]*)\)\s*=>\s*\{/g,
      "useEffect((() => { const run = async ($1) => {"
    );
    // This is a partial fix — add warning
    fixes.push("async-effect-partial-fix");
  }

  // Fix: missing semicolons on import/export lines (not critical but cleaner)
  // Skip — too risky to auto-add

  // Fix: `export default export default` (double export artifact)
  const doubleExport = /export\s+default\s+export\s+default/g;
  if (doubleExport.test(fixed)) {
    fixed = fixed.replace(doubleExport, "export default");
    changed = true;
    fixes.push("double-export-default");
  }

  // Fix: `export { default } from '...'` used as re-export inside component files
  // (usually fine, skip)

  // Fix: props spreading with wrong syntax <Component {...props,} />
  const badSpread = /\{\.\.\.(\w+),\s*\}/g;
  if (badSpread.test(fixed)) {
    fixed = fixed.replace(badSpread, "{...$1}");
    changed = true;
    fixes.push("spread-trailing-comma");
  }

  // Fix: `<>` without import (Fragment shorthand — fine in React 17+)
  // No fix needed

  // Fix: Common state setter naming issues
  // `const count, setCount = useState(0)` → `const [count, setCount] = useState(0)`
  const badDestructure = /const\s+(\w+)\s*,\s*(set\w+)\s*=\s*useState/g;
  if (badDestructure.test(fixed)) {
    fixed = fixed.replace(badDestructure, "const [$1, $2] = useState");
    changed = true;
    fixes.push("fixed-state-destructure");
  }

  return fixed;
}

// ================================================================
// TEMPLATE LITERALS
// ================================================================
function fixBrokenTemplateLiterals(code: string, fixes: string[]): string {
  let fixed = code;

  // Fix: `className={\`...\`}` with unclosed backtick
  // This is hard to auto-fix reliably — detect and warn

  // Fix: template literal used where string expected in JSX attribute
  // <div className=`foo bar`> → <div className="foo bar">
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
  // Don't remove console.log — AI code often has useful ones
  // Just fix common artifact: stray `console.log()` on import lines
  const fixed = code.replace(/^import.*;\s*console\.log\(\)/gm, (m) =>
    m.replace(/\s*console\.log\(\)/, "")
  );
  if (fixed !== code) fixes.push("removed-stray-console");
  return fixed;
}

// ================================================================
// CSS FIXES
// ================================================================
function fixCSS(code: string, fixes: string[]): string {
  let fixed = code;
  let changed = false;

  // Fix: missing semicolons in CSS properties
  // property: value (no semicolon) → property: value;
  const missingSemicolon = /([a-zA-Z-]+\s*:\s*[^;{}]+)(\s*\n\s*[a-zA-Z-]+\s*:)/g;
  const withSemicolon = fixed.replace(missingSemicolon, "$1;$2");
  if (withSemicolon !== fixed) { changed = true; fixed = withSemicolon; }

  // Fix: vendor prefix ordering (put unprefixed last)
  // Too complex to auto-fix safely — skip

  // Fix: 0px → 0 (unnecessary unit)
  const zeroPx = fixed.replace(/:\s*0px\b/g, ": 0");
  if (zeroPx !== fixed) { changed = true; fixed = zeroPx; }

  if (changed) fixes.push("css-fixes");
  return fixed;
}

// ================================================================
// JSON FIXES
// ================================================================
function fixJSON(code: string, fixes: string[], warnings: string[]): string {
  let fixed = code.trim();

  // Remove trailing commas
  const noTrailing = fixed
    .replace(/,\s*}/g, "}")
    .replace(/,\s*]/g, "]");

  if (noTrailing !== fixed) {
    fixes.push("json-trailing-commas");
    fixed = noTrailing;
  }

  // Validate JSON
  try {
    JSON.parse(fixed);
  } catch (err) {
    warnings.push(`json-parse-error: ${String(err).slice(0, 100)}`);
  }

  return fixed;
}

// ================================================================
// HTML FIXES
// ================================================================
function fixHTML(code: string, fixes: string[]): string {
  let fixed = code;

  // Ensure UTF-8 charset meta if missing
  if (fixed.includes("<head") && !fixed.includes("charset")) {
    fixed = fixed.replace(
      /<head>/,
      '<head>\n  <meta charset="UTF-8" />'
    );
    fixes.push("added-charset-meta");
  }

  // Ensure viewport meta
  if (fixed.includes("<head") && !fixed.includes("viewport")) {
    fixed = fixed.replace(
      /<head>/,
      '<head>\n  <meta name="viewport" content="width=device-width, initial-scale=1.0" />'
    );
    fixes.push("added-viewport-meta");
  }

  return fixed;
}

// ================================================================
// CROSS-FILE FIXES
// Runs after all individual files are fixed.
// ================================================================
function crossFileFixes(files: AIFile[]): AIFile[] {
  // Ensure exactly one App.jsx/App.tsx exists
  const appFiles = files.filter(
    (f) => f.path === "src/App.jsx" || f.path === "src/App.tsx"
  );

  if (appFiles.length === 0) {
    // No App file — something went wrong, leave as-is
    return files;
  }

  if (appFiles.length > 1) {
    // Deduplicate: keep the tsx version, or the last one
    const keepPath = appFiles.find((f) => f.path.endsWith(".tsx"))?.path
      ?? appFiles[appFiles.length - 1].path;
    console.warn(`⚠️ Multiple App files found — keeping ${keepPath}`);
    return files.filter(
      (f) =>
        !(
          (f.path === "src/App.jsx" || f.path === "src/App.tsx") &&
          f.path !== keepPath
        )
    );
  }

  return files;
}