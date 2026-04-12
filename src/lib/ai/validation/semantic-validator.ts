// src/lib/ai/validation/semantic-validator.ts
// v18.0 — Pure analysis validator. No mutations, no auto-fix, no caching.
//
// Detects:
//   - missing / multiple export default (error)
//   - unresolvable relative imports (error)
//   - JSX tag imbalance (error)
//   - missing imports for used components (warning)
//   - useEffect without dependency array (warning)
//
// Returns a ValidationResult with errors and a list of broken files.

import type { StreamFile } from "@/lib/ai/types/stream.types";

export interface ValidationError {
  file: string;
  type:
    | "missing-export-default"
    | "multiple-export-default"
    | "invalid-import-path"
    | "jsx-imbalance"
    | "missing-import"
    | "hook-missing-deps";
  message: string;
  severity: "error" | "warning";
}

export interface ValidationResult {
  errors: ValidationError[];
  brokenFiles: string[];
  clean: boolean;
}

// =============================================================================
// UTILITIES
// =============================================================================

function stripCommentsAndStrings(content: string): string {
  return content
    .replace(/\/\/[^\n]*/g, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/`(?:[^`\\]|\\.)*`/gs, "``")
    .replace(/"(?:[^"\\]|\\.)*"/g, '""')
    .replace(/'(?:[^'\\]|\\.)*'/g, "''");
}

function resolveRelativePath(dir: string, relativePath: string): string {
  const base = dir ? `${dir}/${relativePath}` : relativePath;
  const parts = base.split("/");
  const resolved: string[] = [];
  for (const p of parts) {
    if (p === "..") resolved.pop();
    else if (p !== ".") resolved.push(p);
  }
  return resolved.join("/");
}

function pathExists(importPath: string, allPaths: Set<string>): boolean {
  if (allPaths.has(importPath)) return true;
  for (const ext of [".jsx", ".tsx", ".js", ".ts"]) {
    if (allPaths.has(importPath + ext)) return true;
    if (allPaths.has(importPath + "/index" + ext)) return true;
  }
  return false;
}

// =============================================================================
// JSX TAG BALANCE CHECK
// =============================================================================

function checkJsxBalance(content: string): { valid: boolean; message?: string } {
  const stripped = stripCommentsAndStrings(content);
  const stack: string[] = [];
  let fragmentDepth = 0;
  let mismatchCount = 0;

  const tagRe = /<\/?([A-Za-z][a-zA-Z0-9]*)[^>]*\/?>/g;
  let m: RegExpExecArray | null;

  while ((m = tagRe.exec(stripped)) !== null) {
    const full = m[0];
    const tagName = m[1];

    // Fragment handling
    if (full === "<>") {
      fragmentDepth++;
      continue;
    }
    if (full === "</>") {
      if (fragmentDepth > 0) fragmentDepth--;
      else mismatchCount++;
      continue;
    }

    const isClosing = full.startsWith("</");
    const isSelfClosing = full.endsWith("/>");

    if (isClosing) {
      if (stack.length === 0) {
        mismatchCount++;
      } else {
        const last = stack.pop();
        if (last !== tagName) mismatchCount++;
      }
    } else if (!isSelfClosing) {
      stack.push(tagName);
    }
  }

  const openCount = stack.length + fragmentDepth + mismatchCount;
  if (openCount > 3) {
    return {
      valid: false,
      message: `JSX imbalance: ${stack.length} unclosed tags, ${fragmentDepth} fragments, ${mismatchCount} mismatches`,
    };
  }
  return { valid: true };
}

// =============================================================================
// COMPONENT USAGE EXTRACTION
// =============================================================================

function extractComponentUsages(stripped: string): string[] {
  const seen = new Set<string>();
  const re = /(?<![.\w])<([A-Z][a-zA-Z0-9]*)(?=[\s/>])/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(stripped)) !== null) {
    seen.add(m[1]);
  }
  return Array.from(seen);
}

// =============================================================================
// IMPORT EXTRACTION
// =============================================================================

interface ExtractedImport {
  source: string;
  names: string[];
}

function extractImports(content: string): ExtractedImport[] {
  const imports: ExtractedImport[] = [];
  const importRe = /^import\s+(.+?)\s+from\s+["']([^"']+)["']/gm;
  let m: RegExpExecArray | null;

  while ((m = importRe.exec(content)) !== null) {
    const clause = m[1].trim();
    const source = m[2];
    const names: string[] = [];

    // Parse import clause
    if (clause.startsWith("*")) {
      const nsMatch = clause.match(/^\*\s+as\s+(\w+)/);
      if (nsMatch) names.push(nsMatch[1]);
    } else {
      const defaultMatch = clause.match(/^(\w+)/);
      if (defaultMatch && !clause.includes("{")) {
        names.push(defaultMatch[1]);
      } else {
        if (defaultMatch && defaultMatch[1] !== "type") {
          names.push(defaultMatch[1]);
        }
        const namedMatch = clause.match(/\{([^}]*)\}/);
        if (namedMatch) {
          for (const spec of namedMatch[1].split(",")) {
            const parts = spec.trim().split(/\s+as\s+/);
            const local = parts[parts.length - 1]?.trim();
            if (local) names.push(local);
          }
        }
      }
    }
    imports.push({ source, names: names.filter(Boolean) });
  }
  return imports;
}

// =============================================================================
// MAIN VALIDATION
// =============================================================================

export function runSemanticValidation(files: StreamFile[]): ValidationResult {
  const errors: ValidationError[] = [];
  const brokenFiles = new Set<string>();
  const allPaths = new Set(files.map((f) => f.path));

  for (const file of files) {
    if (!file.path.endsWith(".jsx") && !file.path.endsWith(".tsx")) continue;

    const content = file.content;
    const stripped = stripCommentsAndStrings(content);

    // 1. Missing export default
    const hasExportDefault = /\bexport\s+default\b/.test(content);
    if (!hasExportDefault) {
      errors.push({
        file: file.path,
        type: "missing-export-default",
        message: "Missing export default",
        severity: "error",
      });
      brokenFiles.add(file.path);
    }

    // 2. Multiple export default
    const exportMatches = stripped.match(/\bexport\s+default\b/g);
    if (exportMatches && exportMatches.length > 1) {
      errors.push({
        file: file.path,
        type: "multiple-export-default",
        message: `Multiple export default (${exportMatches.length})`,
        severity: "error",
      });
      brokenFiles.add(file.path);
    }

    // 3. Invalid import paths
    const importLines = extractImports(content);
    for (const imp of importLines) {
      if (imp.source.startsWith(".")) {
        const dir = file.path.split("/").slice(0, -1).join("/");
        const resolved = resolveRelativePath(dir, imp.source);
        if (!pathExists(resolved, allPaths)) {
          errors.push({
            file: file.path,
            type: "invalid-import-path",
            message: `Unresolvable import: "${imp.source}" → "${resolved}"`,
            severity: "error",
          });
          brokenFiles.add(file.path);
        }
      }
    }

    // 4. JSX imbalance
    const balance = checkJsxBalance(content);
    if (!balance.valid) {
      errors.push({
        file: file.path,
        type: "jsx-imbalance",
        message: balance.message!,
        severity: "error",
      });
      brokenFiles.add(file.path);
    }

    // 5. Missing imports (warning)
    const importedNames = new Set<string>();
    for (const imp of importLines) {
      imp.names.forEach((n) => importedNames.add(n));
    }
    const locallyDefined = new Set<string>();
    const localRe = /(?:function|const|class)\s+([A-Z][a-zA-Z0-9]*)/g;
    let lm: RegExpExecArray | null;
    while ((lm = localRe.exec(content)) !== null) {
      locallyDefined.add(lm[1]);
    }
    const usedComponents = extractComponentUsages(stripped);
    for (const comp of usedComponents) {
      if (!importedNames.has(comp) && !locallyDefined.has(comp)) {
        errors.push({
          file: file.path,
          type: "missing-import",
          message: `Component <${comp}> used but not imported or defined`,
          severity: "warning",
        });
      }
    }

    // 6. useEffect missing dependency array (warning)
    const useEffectRe = /useEffect\s*\(\s*(?:\(\)\s*=>|function\s*\(\))\s*\{[^}]*\}\s*\)(?!\s*,)/g;
    if (useEffectRe.test(content)) {
      errors.push({
        file: file.path,
        type: "hook-missing-deps",
        message: "useEffect missing dependency array",
        severity: "warning",
      });
    }
  }

  const clean = errors.filter((e) => e.severity === "error").length === 0;
  return {
    errors,
    brokenFiles: Array.from(brokenFiles),
    clean,
  };
}