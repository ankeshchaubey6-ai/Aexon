// src/lib/ai/validation/error-classifier.ts
// Stage 4: Semantic validator — classify, don't reject.

export interface StreamFile {
  path: string;
  content: string;
}

export interface ClassifiedError {
  file: string;
  class: "syntax" | "missing-import" | "jsx-imbalance" | "runtime";
  message: string;
  severity: "error" | "warning";
}

export interface ClassificationResult {
  errors: ClassifiedError[];
  brokenFiles: string[];
  clean: boolean;
}

/**
 * Resolve a relative import path from a directory.
 */
function resolveRelative(dir: string, rel: string): string {
  const parts = (dir ? `${dir}/${rel}` : rel).split("/");
  const out: string[] = [];
  for (const p of parts) {
    if (p === "..") out.pop();
    else if (p !== ".") out.push(p);
  }
  return out.join("/");
}

/**
 * Extract imported identifiers from a file content.
 */
function extractImports(content: string): Map<string, string[]> {
  const importMap = new Map<string, string[]>();
  const importRegex = /^import\s+(?:{([^}]+)}|([A-Za-z_$][\w$]*))\s+from\s+['"]([^'"]+)['"]/gm;
  let match;
  while ((match = importRegex.exec(content)) !== null) {
    const namedImports = match[1]?.split(",").map(s => s.trim().split(" as ").pop()!.trim()) ?? [];
    const defaultImport = match[2] ? [match[2]] : [];
    const modulePath = match[3];
    const existing = importMap.get(modulePath) ?? [];
    importMap.set(modulePath, [...existing, ...namedImports, ...defaultImport]);
  }
  return importMap;
}

/**
 * Extract component names used in JSX.
 */
function extractJsxComponents(content: string): Set<string> {
  const components = new Set<string>();
  const jsxTagRegex = /<([A-Z][a-zA-Z0-9_]*)/g;
  let match;
  while ((match = jsxTagRegex.exec(content)) !== null) {
    components.add(match[1]);
  }
  return components;
}

/**
 * Extract locally defined components (function declarations/const arrow functions).
 */
function extractLocalDefinitions(content: string): Set<string> {
  const defined = new Set<string>();
  const defRegex = /(?:function|const|class)\s+([A-Z][a-zA-Z0-9_]*)/g;
  let match;
  while ((match = defRegex.exec(content)) !== null) {
    defined.add(match[1]);
  }
  return defined;
}

export function classifyErrors(files: StreamFile[]): ClassificationResult {
  const errors: ClassifiedError[] = [];
  const brokenFiles = new Set<string>();
  const pathSet = new Set(files.map(f => f.path));

  for (const file of files) {
    if (!file.path.endsWith(".jsx") && !file.path.endsWith(".js")) continue;
    const content = file.content;

    // 1. Syntax errors
    const exportCount = (content.match(/\bexport\s+default\b/g) ?? []).length;
    if (exportCount === 0) {
      errors.push({
        file: file.path,
        class: "syntax",
        message: "Missing export default",
        severity: "error",
      });
      brokenFiles.add(file.path);
    } else if (exportCount > 1) {
      errors.push({
        file: file.path,
        class: "syntax",
        message: "Multiple export default statements",
        severity: "error",
      });
      brokenFiles.add(file.path);
    }

    // 2. JSX issues
    const hasJsxReturn = /return\s*\(?\s*</.test(content) || /return\s+</.test(content);
    if (!hasJsxReturn) {
      errors.push({
        file: file.path,
        class: "jsx-imbalance",
        message: "No JSX return found",
        severity: "error",
      });
      brokenFiles.add(file.path);
    } else {
      const openCount = (content.match(/<[A-Z][a-zA-Z0-9]*[\s>]/g) ?? []).length;
      const closeCount = (content.match(/<\/[A-Z][a-zA-Z0-9]*>/g) ?? []).length;
      const selfCount = (content.match(/<[A-Z][a-zA-Z0-9]*[^>]*\/>/g) ?? []).length;
      const delta = Math.abs(openCount - closeCount - selfCount);
      if (delta > 3) {
        errors.push({
          file: file.path,
          class: "jsx-imbalance",
          message: `Severe tag imbalance (open: ${openCount}, close: ${closeCount}, self: ${selfCount})`,
          severity: "error",
        });
        brokenFiles.add(file.path);
      }
    }

    // 3. Missing imports
    const imports = extractImports(content);
    const importedNames = new Set<string>();
    // FIX: Cannot spread array into Set.add() - use forEach instead
    for (const names of imports.values()) {
      names.forEach(name => importedNames.add(name));
    }
    const localDefs = extractLocalDefinitions(content);
    const usedComponents = extractJsxComponents(content);

    for (const comp of usedComponents) {
      if (!importedNames.has(comp) && !localDefs.has(comp)) {
        errors.push({
          file: file.path,
          class: "missing-import",
          message: `<${comp}> used but not imported or defined locally`,
          severity: "warning",
        });
      }
    }

    // 4. Unresolvable relative imports
    const relImportRegex = /from\s+['"](\.[^'"]+)['"]/g;
    let relMatch;
    while ((relMatch = relImportRegex.exec(content)) !== null) {
      const relPath = relMatch[1];
      if (relPath.endsWith(".css")) continue;
      const dir = file.path.split("/").slice(0, -1).join("/");
      const base = resolveRelative(dir, relPath);
      const candidates = [base, `${base}.jsx`, `${base}.js`];
      if (!candidates.some(p => pathSet.has(p))) {
        errors.push({
          file: file.path,
          class: "missing-import",
          message: `Unresolvable import: ${relPath}`,
          severity: "error",
        });
        brokenFiles.add(file.path);
      }
    }

    // 5. Runtime issues (warnings)
    const useEffectMissingDep = /useEffect\s*\(\s*(?:\(\)\s*=>|function\s*\(\))\s*\{[^}]*\}\s*\)(?!\s*,)/g;
    if (useEffectMissingDep.test(content)) {
      errors.push({
        file: file.path,
        class: "runtime",
        message: "useEffect without dependency array",
        severity: "warning",
      });
    }

    const hookInsideCondition = /if\s*\([^)]*\)\s*\{\s*use[A-Z]/g;
    if (hookInsideCondition.test(content)) {
      errors.push({
        file: file.path,
        class: "runtime",
        message: "React Hook used inside conditional (may break rules of hooks)",
        severity: "warning",
      });
    }
  }

  const broken = Array.from(brokenFiles);
  return {
    errors,
    brokenFiles: broken,
    clean: errors.filter(e => e.severity === "error").length === 0,
  };
}

export function getBrokenFiles(result: ClassificationResult): string[] {
  return result.brokenFiles;
}