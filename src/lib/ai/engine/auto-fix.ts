// ================================================================
// auto-fix.ts — FINAL IMMUTABLE PRODUCTION-GRADE SANITIZER
//
// ARCHITECTURE (6 layers, fixed, no additions ever):
//   1. INPUT SANITIZATION
//   2. IMPORT + DEPENDENCY STRIPPING
//   3. WHITELIST ENFORCEMENT
//   4. SYNTAX RECOVERY (JSX + brackets)
//   5. RUNTIME SANITIZATION
//   6. HARD FALLBACK (FINAL GUARD)
//
// PHILOSOPHY: Deterministic > Intelligent | Safe > Correct | Stable > Feature-rich
// ================================================================

// ================================================================
// CONSTANTS
// ================================================================

const MAX_FILE_BYTES = 200_000;

const ALLOWED_IMPORTS = ["react", "react-dom"];

const ALLOWED_HOOKS = [
  "useState",
  "useEffect",
  "useRef",
  "useMemo",
  "useCallback",
];

const FORBIDDEN_LIBS = [
  "framer-motion",
  "lucide-react",
  "react-router",
  "react-router-dom"
];

const SAFE_FALLBACK_COMPONENT = `export default function SafeComponent() {
  return <div>Safe Render</div>;
}
`;

// ================================================================
// TYPES
// ================================================================

export type AIFile = {
  path: string;
  content: string;
  meta?: FileMeta;
};

type FileMeta = {
  sanitized: boolean;
  fixCount: number;
  riskLevel: "low" | "medium" | "high";
};

type FixResult = {
  file: AIFile;
  fixes: string[];
  warnings: string[];
  riskLevel: "low" | "medium" | "high";
  skipped: boolean;
};

type State = {
  fixes: string[];
  warnings: string[];
};

// ================================================================
// PUBLIC API
// ================================================================

export function autoFixFiles(files: AIFile[]): AIFile[] {
  return files.map((f) => fixFile(f).file);
}

export function autoFixFilesWithReport(files: AIFile[]): {
  files: AIFile[];
  reports: Array<{
    path: string;
    fixes: string[];
    warnings: string[];
    riskLevel: "low" | "medium" | "high";
    skipped: boolean;
    linesAdded: number;
    linesRemoved: number;
  }>;
} {
  const originals = new Map(files.map((f) => [f.path, f.content]));
  const results = files.map((f) => fixFile(f));
  return {
    files: results.map((r) => r.file),
    reports: results.map((r) => {
      const orig = originals.get(r.file.path) ?? "";
      const origLines = orig.split("\n").length;
      const fixedLines = r.file.content.split("\n").length;
      return {
        path: r.file.path,
        fixes: r.fixes,
        warnings: r.warnings,
        riskLevel: r.riskLevel,
        skipped: r.skipped,
        linesAdded: Math.max(0, fixedLines - origLines),
        linesRemoved: Math.max(0, origLines - fixedLines),
      };
    }),
  };
}

export function validateFile(file: AIFile): { valid: boolean; issues: string[] } {
  return structuralCheck(file.content);
}

// ================================================================
// MAIN PIPELINE
// ================================================================

function fixFile(file: AIFile): FixResult {
  const original = file.content ?? "";
  const state: State = { fixes: [], warnings: [] };

  // ── Pre-flight guards ─────────────────────────────────────────
  if (!original.trim()) {
    return skipped(file, ["empty-file"]);
  }
  if (original.length > MAX_FILE_BYTES) {
    return skipped(file, [`file-exceeds-${MAX_FILE_BYTES}-bytes`]);
  }

  const ext = file.path.split(".").pop()?.toLowerCase() ?? "";
  const isJS = ["js", "jsx", "ts", "tsx"].includes(ext);
  const isJSON = ext === "json";
  const isHTML = ext === "html";

  // CSS files: hard block
  if (ext === "css") {
    return skipped(file, ["css-not-allowed"]);
  }

  let code = original;

  // ── Non-JS files: minimal format pass then exit ───────────────
  if (!isJS) {
    if (isJSON) code = fixJSON(code, state);
    if (isHTML) code = fixHTML(code, state);
    return buildResult(file, code, original, state);
  }

  // ================================================================
  // LAYER 1 — INPUT SANITIZATION
  // ================================================================
  code = layer1InputSanitization(code, state);

  // ================================================================
  // LAYER 2 — IMPORT + DEPENDENCY STRIPPING
  // ================================================================
  code = layer2ImportStripping(code, state);

  // ================================================================
  // LAYER 3 — WHITELIST ENFORCEMENT
  // ================================================================
  code = layer3WhitelistEnforcement(code, state);

  // ================================================================
  // LAYER 4 — SYNTAX RECOVERY
  // ================================================================
  code = layer4SyntaxRecovery(code, state);

  // ================================================================
  // LAYER 5 — RUNTIME SANITIZATION
  // ================================================================
  code = layer5RuntimeSanitization(code, state);

  // ================================================================
  // LAYER 6 — HARD FALLBACK (FINAL GUARD)
  // ================================================================
  const fallbackResult = layer6HardFallback(file, code, state);
  if (fallbackResult) return fallbackResult;

  // ── Ensure default export for JSX files ──────────────────────
  if (["jsx", "tsx"].includes(ext)) {
    code = ensureDefaultExport(code, state);
  }

  // ── Final clean ───────────────────────────────────────────────
  code = finalClean(code);

  return buildResult(file, code, original, state);
}

// ================================================================
// LAYER 1 — INPUT SANITIZATION
// Encoding, control chars, line endings, LLM prose artifacts.
// ================================================================

function layer1InputSanitization(code: string, state: State): string {
  // BOM
  if (code.startsWith("\uFEFF")) {
    code = code.slice(1);
    state.fixes.push("removed-BOM");
  }

  // Early corruption detection
  if (/=\s*\/\s*>/.test(code)) {
    state.warnings.push("corrupted-arrow-token");
  }
  if (/<REDACTED/.test(code)) {
    state.warnings.push("redacted-token-found");
  }

  // Control characters
  const noCtrl = code.replace(
    /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F\u200B\u200C\u200D\uFEFF]/g,
    "",
  );
  if (noCtrl !== code) { code = noCtrl; state.fixes.push("removed-control-chars"); }

  // Line endings
  if (code.includes("\r")) {
    code = code.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
    state.fixes.push("normalized-line-endings");
  }

  // Excessive blank lines
  const noBlank = code.replace(/\n{4,}/g, "\n\n\n");
  if (noBlank !== code) { code = noBlank; state.fixes.push("collapsed-blank-lines"); }

  // Escape artifacts
  const noEsc = code.replace(/\\\\n/g, "\n").replace(/\\\\t/g, "\t");
  if (noEsc !== code) { code = noEsc; state.fixes.push("fixed-escape-artifacts"); }

  // LLM prose leakage
  const LLM_PROSE = [
    /^(Here('s| is) (the|a|an) )/i,
    /^(In this (component|file|example))/i,
    /^(This (component|file|code))/i,
    /^(Note( that)?:)/i,
    /^(Let me )/i,
    /^(I('ll| will) )/i,
    /^(Sure[,!])/i,
    /^(Certainly[,!])/i,
    /^(Of course[,!])/i,
    /^(Below is )/i,
    /^(Above is )/i,
  ];
  const lines = code.split("\n");
  const filtered = lines.filter((line) => {
    const t = line.trim();
    return !(LLM_PROSE.some((p) => p.test(t)) && !/[{;(]$/.test(t));
  });
  if (filtered.length !== lines.length) {
    code = filtered.join("\n");
    state.fixes.push("removed-LLM-prose");
  }

  // Debugger statements
  const noDbg = code.replace(/^\s*debugger\s*;?\s*$/gm, "");
  if (noDbg !== code) { code = noDbg; state.fixes.push("removed-debugger"); }

  // Console.log statements (safe: only standalone lines)
  const noLog = code
    .split("\n")
    .filter((line) => !/^\s*console\.log\([^;]*\);?\s*$/.test(line))
    .join("\n");
  if (noLog !== code) { code = noLog; state.fixes.push("removed-console-log"); }

  return code;
}

// ================================================================
// LAYER 2 — IMPORT + DEPENDENCY STRIPPING
// Removes ALL CSS imports and ALL non-whitelisted library imports.
// Merges and deduplicates remaining imports.
// ================================================================

function layer2ImportStripping(code: string, state: State): string {
  // Remove CSS imports
  const noCss = code.replace(/^import\s+['"][^'"]*\.css['"];?\n?/gm, "");
  if (noCss !== code) { code = noCss; state.fixes.push("removed-css-imports"); }

  // Remove forbidden library imports
  const noForbidden = code.replace(
    /^import\s+.+from\s+['"]([^'"]+)['"];?\n?/gm,
    (match, lib) => {
      if (FORBIDDEN_LIBS.some(f => (lib as string).includes(f))) {
        state.fixes.push(`removed-forbidden-import:${lib}`);
        return "";
      }
      return match;
    }
  );
  if (noForbidden !== code) code = noForbidden;

  // Remove all external imports (anything not in ALLOWED_IMPORTS)
  const noExternal = code.replace(
    /^import\s+(?:.+\s+from\s+)?['"]([^'"]+)['"];?\n?/gm,
    (match, ...args: unknown[]) => {
      const lib = (args[0] as string).replace(/^['"]|['"]$/g, "");
      if (ALLOWED_IMPORTS.some((a) => lib === a || lib.startsWith(a + "/"))) return match;
      state.fixes.push(`removed-external-import:${lib}`);
      return "";
    },
  );
  if (noExternal !== code) code = noExternal;

  // Deduplicate imports
  const importLines = new Set<string>();
  const deduped = code.replace(/^import\s+.+$/gm, (line) => {
    const t = line.trim();
    if (importLines.has(t)) { state.fixes.push("removed-duplicate-import"); return ""; }
    importLines.add(t);
    return line;
  });
  if (deduped !== code) code = deduped;

  // Ensure React import exists if JSX is present
  const hasJSX = /<[A-Za-z][^>]*>/.test(code) || /<>/.test(code);
  const hasReact = /import\s+React\b/.test(code) || /from\s+['"]react['"]/.test(code);
  if (hasJSX && !hasReact) {
    const usedHooks = ALLOWED_HOOKS.filter((h) => new RegExp(`\\b${h}\\b`).test(code));
    const importLine = usedHooks.length > 0
      ? `import React, { ${usedHooks.join(", ")} } from "react";`
      : `import React from "react";`;
    code = `${importLine}\n${code}`;
    state.fixes.push("injected-react-import");
  }

  return code;
}

// ================================================================
// LAYER 3 — WHITELIST ENFORCEMENT
// Neutralizes unknown hooks, replaces unknown components,
// strips class attributes, removes style strings.
// ================================================================

function layer3WhitelistEnforcement(code: string, state: State): string {
  // Neutralize any hook not in ALLOWED_HOOKS
  const noUnknownHooks = code.replace(
    /\b(use[A-Z][a-zA-Z0-9]*)\s*\(/g,
    (match, ...args: unknown[]) => {
      const hook = args[0] as string;
      if (ALLOWED_HOOKS.includes(hook)) return match;
      state.fixes.push(`neutralized-hook:${hook}`);
      return "(() => undefined)(";
    },
  );
  if (noUnknownHooks !== code) code = noUnknownHooks;

  // Replace unknown capitalized JSX components with <div> / </div>
  const noUnknownOpen = code.replace(
    /<([A-Z][A-Za-z0-9]*)/g,
    (_match, ...args: unknown[]) => {
      const tag = args[0] as string;
      state.fixes.push(`replaced-component:${tag}`);
      return "<div";
    },
  );
  if (noUnknownOpen !== code) code = noUnknownOpen;

  const noUnknownClose = code.replace(
    /<\/([A-Z][A-Za-z0-9]*)/g,
    (_match, ...args: unknown[]) => {
      const tag = args[0] as string;
      state.fixes.push(`replaced-closing-component:${tag}`);
      return "</div";
    },
  );
  if (noUnknownClose !== code) code = noUnknownClose;

  // Replace motion.* with normal elements
  code = code.replace(/motion\.(div|span|section|button)/g, "$1");

  // Remove AnimatePresence
  code = code.replace(/<AnimatePresence[^>]*>/g, "<>");
  code = code.replace(/<\/AnimatePresence>/g, "</>");

  // Replace Lucide icons with span
  code = code.replace(/<([A-Z][A-Za-z0-9]*Icon)[^>]*\/>/g, "<span />");

  // Remove className attributes entirely
  const noClass = code
    .replace(/\bclassName="[^"]*"/g, "")
    .replace(/\bclassName=\{[^}]*\}/g, "")
    .replace(/\bclass="[^"]*"/g, "");
  if (noClass !== code) { code = noClass; state.fixes.push("removed-className"); }

  // Convert style strings to style={{}}
  const noStyleStr = code.replace(/style="[^"]*"/g, "style={{}}");
  if (noStyleStr !== code) { code = noStyleStr; state.fixes.push("converted-style-strings"); }

  // Static template literal JSX attrs: attr={`value`} → attr="value"
  const noTmpl = code.replace(/([\w-]+)=`([^`${}]+)`/g, '$1="$2"');
  if (noTmpl !== code) { code = noTmpl; state.fixes.push("fixed-static-template-attrs"); }

  return code;
}

// ================================================================
// LAYER 4 — SYNTAX RECOVERY
// Fixes JSX structure, bracket imbalances, and common typos.
// When uncertain: DO NOTHING.
// ================================================================

function layer4SyntaxRecovery(code: string, state: State): string {
  // Fix useEffect cleanup arrow artifacts: ); => expr
  {
    const before = code;
    code = code
      .replace(/\)\s*;?\s*=>\s*([^\n{][^\n]*)/g, (_m, ...args: unknown[]) => {
        const body = (args[0] as string).trim();
        if (!body) return _m;
        return `)\nreturn () => { ${body} }`;
      })
      .replace(/\)\s*;\s*=>\s*(\{[\s\S]*?\})/g, (_m, ...args: unknown[]) =>
        `)\nreturn () => ${args[0] as string}`,
      )
      .replace(/^(\s*);=>\s*(.+)$/gm, (_m, ...args: unknown[]) =>
        `${args[0] as string}return () => { ${(args[1] as string).trim()} }`,
      );
    if (code !== before) state.fixes.push("fixed-useEffect-cleanup");
  }

  // JSX inline-if: { if (cond) { <El /> } } → { cond && <El /> }
  {
    const before = code;
    code = code.replace(
      /\{\s*if\s*\(([^)]+)\)\s*\{\s*(<[^}]+>)\s*\}\s*\}/g,
      (_m, ...args: unknown[]) =>
        `{ ${(args[0] as string).trim()} && ${(args[1] as string).trim()} }`,
    );
    // Multi-line variant
    const lines = code.split("\n");
    const result: string[] = [];
    let i = 0;
    while (i < lines.length) {
      const line = lines[i];
      const ifOpen = line.trim().match(/^\{\s*if\s*\(([^)]+)\)\s*\{$/);
      if (ifOpen && i + 2 < lines.length) {
        const jsxLine = lines[i + 1].trim();
        const close = lines[i + 2].trim();
        if (close === "}" || close === "} }" || close === "}}") {
          const indent = line.match(/^(\s*)/)?.[1] ?? "";
          result.push(`${indent}{ ${ifOpen[1].trim()} && ${jsxLine} }`);
          i += 3;
          continue;
        }
      }
      result.push(line);
      i++;
    }
    code = result.join("\n");
    if (code !== before) state.fixes.push("fixed-JSX-inline-if");
  }

  // JSX typo corrections
  const JSX_TYPOS: [RegExp, string][] = [
    [/<\/buutton>/gi, "</button>"], [/<\/buton>/gi, "</button>"],
    [/<\/diiv>/gi, "</div>"],       [/<\/spann>/gi, "</span>"],
    [/<\/lable>/gi, "</label>"],    [/<\/tabble>/gi, "</table>"],
    [/<\/tabel>/gi, "</table>"],    [/<buutton(\s|\/|>)/gi, "<button$1"],
    [/<buton(\s|\/|>)/gi, "<button$1"], [/<diiv(\s|\/|>)/gi, "<div$1"],
    [/<imput(\s|\/|>)/gi, "<input$1"], [/<lable(\s|\/|>)/gi, "<label$1"],
    [/\bonclick=/g, "onClick="],    [/\bOnclick=/g, "onClick="],
  ];
  let typoFixed = false;
  for (const [pat, rep] of JSX_TYPOS) {
    const next = code.replace(pat, rep);
    if (next !== code) { code = next; typoFixed = true; }
  }
  if (typoFixed) state.fixes.push("fixed-JSX-typos");

  // Fix broken closing tags: </ div> → </div>
  const noSpaceTag = code.replace(/<\/\s+(\w)/g, "</$1");
  if (noSpaceTag !== code) { code = noSpaceTag; state.fixes.push("fixed-broken-closing-tags"); }

  // label for= → htmlFor=
  const htmlFor = code.replace(/(?<=<label[^>]*)\bfor=/g, "htmlFor=");
  if (htmlFor !== code) { code = htmlFor; state.fixes.push("fixed-for-to-htmlFor"); }

  // Truncate oversized SVG paths
  const noSVG = code.replace(/<path[^>]*d="[^"]{400,}[^"]*"[^>]*>/g, '<path d="M0 0 L10 10" />');
  if (noSVG !== code) { code = noSVG; state.fixes.push("truncated-svg-path"); }

  // Fix corrupted inline style objects
  const noCorruptStyle = code.replace(/style=\{\{([^}]*)$/gm, "style={{}}");
  if (noCorruptStyle !== code) { code = noCorruptStyle; state.fixes.push("fixed-broken-style-object"); }

  // Fix empty return blocks
  const noEmptyReturn = code.replace(/return\s*\(\s*<\/\w+>/g, "return (<div></div>)");
  if (noEmptyReturn !== code) { code = noEmptyReturn; state.fixes.push("fixed-empty-return"); }

  // Fix empty return parens
  const noEmptyParens = code.replace(/return\s*\(\s*\)/g, "return (<div></div>)");
  if (noEmptyParens !== code) { code = noEmptyParens; state.fixes.push("fixed-empty-return-parens"); }

  // Collapse runaway duplicate JSX lines (6+ identical → 1)
  {
    const lines = code.split("\n");
    const result: string[] = [];
    let i = 0;
    while (i < lines.length) {
      const line = lines[i];
      let j = i + 1;
      while (j < lines.length && lines[j] === line) j++;
      const count = j - i;
      if (count >= 6 && /^\s*<[A-Za-z]/.test(line.trim())) {
        result.push(line);
        state.fixes.push(`collapsed-runaway-JSX:${count}x`);
      } else {
        for (let k = i; k < j; k++) result.push(lines[k]);
      }
      i = j;
    }
    code = result.join("\n");
  }

  return code;
}

// ================================================================
// LAYER 5 — RUNTIME SANITIZATION
// Converts style strings, strips CSS imports, deduplicates exports
// and declarations.
// ================================================================

function layer5RuntimeSanitization(code: string, state: State): string {
  // Convert style="..." → style={{ camelCase: "value" }}
  
   // Remove media queries (not supported in inline styles)
  const noMediaQueries = code.replace(
    /@media\s*\([^)]*\)\s*\{[^}]*\}/g,
    ""
  );
  if (noMediaQueries !== code) {
    code = noMediaQueries;
    state.fixes.push("removed-media-queries");
  }

  // Remove inline media queries inside style objects
  const noInlineMedia = code.replace(
    /["']@media[^"']*["']\s*:\s*\{[^}]*\}/g,
    ""
  );
  if (noInlineMedia !== code) {
    code = noInlineMedia;
    state.fixes.push("removed-inline-media-queries");
  }
  const styledCode = code.replace(/style="([^"]*)"/g, (_match, ...args: unknown[]) => {
    const s = args[0] as string;
    try {
      const obj = s
        .split(";")
        .map((x) => x.trim())
        .filter(Boolean)
        .map((rule) => {
          const colonIdx = rule.indexOf(":");
          if (colonIdx === -1) return null;
          const k = rule.slice(0, colonIdx).trim();
          const v = rule.slice(colonIdx + 1).trim();
          if (!k || !v) return null;
          const camel = k.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
          return `${camel}: "${v}"`;
        })
        .filter(Boolean)
        .join(", ");
      return `style={{ ${obj} }}`;
    } catch {
      return "style={{}}";
    }
  });
  if (styledCode !== code) { code = styledCode; state.fixes.push("converted-style-to-object"); }

  // Force-remove any remaining CSS imports
  const noCss = code.replace(/import\s+['"][^'"]*\.css['"];?/g, "");
  if (noCss !== code) { code = noCss; state.fixes.push("force-removed-css"); }

  // Remove duplicate default exports (keep first)
  {
    let count = 0;
    const deduped = code.replace(/\bexport\s+default\s+(\w+)\s*;/g, (match) => {
      count++;
      if (count === 1) return match;
      state.fixes.push("removed-duplicate-export-default");
      return "";
    });
    if (deduped !== code) code = deduped;
  }

  // Fix stray brace after export default
  const fixedExport = code.replace(/\bexport\s+default\s+(\w+)\s*\}/g, "export default $1;");
  if (fixedExport !== code) { code = fixedExport; state.fixes.push("fixed-broken-export-default"); }

  // Dedup useState calls (same state variable declared twice)
  {
    const seen = new Set<string>();
    const lines = code.split("\n");
    const deduped = lines.filter((line) => {
      const m = line.trim().match(
        /^(?:const|let|var)\s+\[(\w+),\s*(\w+)\]\s*=\s*useState\s*\(/,
      );
      if (!m) return true;
      const key = `${m[1]}:${m[2]}`;
      if (seen.has(key)) { state.fixes.push(`dedup-useState:${m[1]}`); return false; }
      seen.add(key);
      return true;
    });
    if (deduped.length !== lines.length) code = deduped.join("\n");
  }

  // Dedup variable declarations (non-destructured, same name twice)
  {
    const seen = new Set<string>();
    const lines = code.split("\n");
    const deduped = lines.filter((line) => {
      const t = line.trim();
      if (/^(?:const|let|var)\s+[\[{]/.test(t)) return true;
      const m = t.match(/^(?:export\s+)?(?:const|let|var)\s+(\w+)\s*=/);
      if (!m) return true;
      if (seen.has(m[1])) { state.fixes.push(`dedup-declaration:${m[1]}`); return false; }
      seen.add(m[1]);
      return true;
    });
    if (deduped.length !== lines.length) code = deduped.join("\n");
  }

  return code;
}

// ================================================================
// LAYER 6 — HARD FALLBACK (FINAL GUARD)
// If ANY unsafe signal remains → replace entire file with fallback.
// ================================================================

function layer6HardFallback(
  file: AIFile,
  code: string,
  state: State,
): FixResult | null {
  const triggers: string[] = [];

  // Unknown hook survived
  const hookMatches = code.match(/\buse[A-Z][a-zA-Z0-9]+/g) ?? [];
  const unknownHooks = hookMatches.filter((h) => !ALLOWED_HOOKS.includes(h));
  if (unknownHooks.length > 0) triggers.push(`unknown-hooks:${unknownHooks.join(",")}`);

  // Invalid style string survived
  if (/style="[^"]*"/.test(code)) triggers.push("invalid-style-string");

  // CSS import survived
  if (/\.css['"]/.test(code)) triggers.push("css-import-survived");

  // Catastrophic syntax tokens
  if (/Unexpected end of file|Unterminated/.test(code)) triggers.push("catastrophic-syntax");

  // Structural check failure
  const check = structuralCheck(code);
  if (!check.valid) triggers.push(`syntax-failure:${check.issues.join(";")}`);

  // Severe brace mismatch (more than 2 off)
  const stripped = stripStrings(code);
  const openB = (stripped.match(/\{/g) ?? []).length;
  const closeB = (stripped.match(/\}/g) ?? []).length;
  if (Math.abs(openB - closeB) > 2) triggers.push(`severe-brace-mismatch:${openB}/${closeB}`);

  // New triggers for forbidden libraries and corruption
  if (/framer-motion/.test(code)) triggers.push("forbidden-lib:framer-motion");
  if (/lucide-react/.test(code)) triggers.push("forbidden-lib:lucide");
  if (/=\s*\/\s*>/.test(code)) triggers.push("corrupted-arrow");
  if (/<REDACTED/.test(code)) triggers.push("redacted-token");

  if (triggers.length === 0) return null;

  state.warnings.push(`fallback-triggered:${triggers.join("|")}`);

  return {
    file: {
      ...file,
      content: SAFE_FALLBACK_COMPONENT,
      meta: { sanitized: true, fixCount: state.fixes.length + 1, riskLevel: "high" },
    },
    fixes: [...state.fixes, "hard-fallback"],
    warnings: state.warnings,
    riskLevel: "high",
    skipped: false,
  };
}

// ================================================================
// STRUCTURAL CHECK
// ================================================================

function structuralCheck(code: string): { valid: boolean; issues: string[] } {
  const issues: string[] = [];
  const stripped = stripStrings(code);

  const openBraces = (stripped.match(/\{/g) ?? []).length;
  const closeBraces = (stripped.match(/\}/g) ?? []).length;
  if (openBraces !== closeBraces) {
    issues.push(`unmatched-braces:${openBraces}open/${closeBraces}close`);
  }

  const openParens = (stripped.match(/\(/g) ?? []).length;
  const closeParens = (stripped.match(/\)/g) ?? []).length;
  if (openParens !== closeParens) {
    issues.push(`unmatched-parens:${openParens}open/${closeParens}close`);
  }

  const defaultExports = (code.match(/\bexport\s+default\b/g) ?? []).length;
  if (defaultExports > 1) issues.push(`multiple-export-defaults:${defaultExports}`);

  if (/from\s+['"](?!react|react-dom)/.test(code)) issues.push("external-import-survived");
  if (/\.css['"]/.test(code)) issues.push("css-import-survived");
  if (/style="[^"]*"/.test(code)) issues.push("invalid-style-string");

  // New forbidden library checks
  if (/framer-motion/.test(code)) issues.push("forbidden-lib-present");
  if (/lucide-react/.test(code)) issues.push("forbidden-lib-present");

  const tagBalance = checkJSXTagBalance(code);
  if (!tagBalance.valid) issues.push(`unbalanced-jsx:${tagBalance.reason}`);

  return { valid: issues.length === 0, issues };
}

function stripStrings(code: string): string {
  return code
    .replace(/`(?:[^`\\]|\\.)*`/gs, "``")
    .replace(/"(?:[^"\\]|\\.)*"/g, '""')
    .replace(/'(?:[^'\\]|\\.)*'/g, "''")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/[^\n]*/g, "");
}

const VOID_ELEMENTS = new Set([
  "area", "base", "br", "col", "embed", "hr", "img",
  "input", "link", "meta", "param", "source", "track", "wbr",
]);

function checkJSXTagBalance(code: string): { valid: boolean; reason?: string } {
  const masked = code
    .replace(/`(?:[^`\\]|\\.)*`/gs, "``")
    .replace(/"(?:[^"\\]|\\.)*"/g, '""')
    .replace(/'(?:[^'\\]|\\.)*'/g, "''")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/[^\n]*/g, "");

  const stack: string[] = [];
  const tagRe = /<\/?([A-Za-z][a-zA-Z0-9]*)[^>]*\/?>/g;
  let m: RegExpExecArray | null;
  let mismatch = 0;

  while ((m = tagRe.exec(masked)) !== null) {
    const full = m[0];
    const name = m[1];
    if (!name) continue;
    if (full.startsWith("</")) {
      if (stack.length === 0) { mismatch++; continue; }
      const last = stack.pop();
      if (last !== name) mismatch++;
    } else if (!full.endsWith("/>") && !VOID_ELEMENTS.has(name.toLowerCase())) {
      stack.push(name);
    }
  }

  if (stack.length > 0) return { valid: false, reason: `unclosed:${stack.join(",")}` };
  if (mismatch > 3) return { valid: false, reason: `mismatches:${mismatch}` };
  return { valid: true };
}

// ================================================================
// HELPERS
// ================================================================

function ensureDefaultExport(code: string, state: State): string {
  if (/export\s+default\b/.test(code)) return code;

  const fnMatch = code.match(
    /(?:export\s+)?function\s+([A-Z]\w*)\s*\([^)]*\)\s*\{[^}]*return\s*\(?\s*</,
  );
  if (fnMatch) {
    const name = fnMatch[1];
    const fixed = code.replace(
      new RegExp(`^function\\s+${name}\\b`, "m"),
      `export default function ${name}`,
    );
    if (fixed !== code) { state.fixes.push(`added-export-default:${name}`); return fixed; }
  }

  const arrowMatch = code.match(
    /const\s+([A-Z]\w*)\s*=\s*(?:\([^)]*\)|[^=])\s*=>\s*(?:\(?\s*<)/,
  );
  if (arrowMatch) {
    const name = arrowMatch[1];
    state.fixes.push(`added-export-default-bottom:${name}`);
    return `${code}\n\nexport default ${name};\n`;
  }

  return code;
}

function finalClean(code: string): string {
  return (
    code
      .split("\n")
      .map((l) => l.trimEnd())
      .join("\n")
      .trimEnd() + "\n"
  );
}

function skipped(file: AIFile, fixes: string[]): FixResult {
  return {
    file: { ...file, meta: { sanitized: false, fixCount: 0, riskLevel: "low" } },
    fixes,
    warnings: [],
    riskLevel: "low",
    skipped: true,
  };
}

function buildResult(
  file: AIFile,
  code: string,
  original: string,
  state: State,
): FixResult {
  if (code === original && state.fixes.length === 0) return skipped(file, []);
  const fixCount = state.fixes.length;
  const riskLevel: "low" | "medium" | "high" =
    fixCount <= 4 ? "low" : fixCount <= 15 ? "medium" : "high";
  return {
    file: { path: file.path, content: code, meta: { sanitized: true, fixCount, riskLevel } },
    fixes: state.fixes,
    warnings: state.warnings,
    riskLevel,
    skipped: false,
  };
}

// ================================================================
// NON-JS FORMAT HELPERS
// ================================================================

function fixJSON(code: string, state: State): string {
  try { JSON.parse(code); return code; } catch { /* try repair */ }
  const fixed = code.replace(/,\s*([}\]])/g, "$1");
  try {
    JSON.parse(fixed);
    state.fixes.push("json-removed-trailing-commas");
    return fixed;
  } catch {
    state.warnings.push("json-invalid:manual-fix-required");
    return code;
  }
}

function fixHTML(code: string, state: State): string {
  let c = code;
  let changed = false;
  if (c.includes("<head") && !c.includes("charset")) {
    c = c.replace(/<head>/, '<head>\n  <meta charset="UTF-8" />');
    changed = true;
  }
  if (c.includes("<html") && !c.includes("lang=")) {
    c = c.replace(/<html>/, '<html lang="en">');
    changed = true;
  }
  if (changed) state.fixes.push("html-meta-fixes");
  return c;
}
