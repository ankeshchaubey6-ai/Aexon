// src/lib/ai/persistence/file-tree.service.ts
//
// FIX: Previous version used a module-level Map (in-memory).
// On serverless (Vercel/Next.js), each invocation may get a fresh module
// context — the map is empty. Now DB-backed via Prisma.

import { db } from "@/lib/db";
import type { AIFileNode } from "@/lib/ai/types/ai-project.types";

export class FileTreeService {
  // ── Save (replace all files) ───────────────────────────────────────────
  static async save(projectId: string, files: AIFileNode[]): Promise<void> {
    // Delete existing files then bulk-create
    await db.aIProjectFile.deleteMany({ where: { projectId } });
    if (files.length === 0) return;

    await db.aIProjectFile.createMany({
      data: files.map((f) => ({
        projectId,
        path:    f.path,
        content: f.content,
      })),
    });

    await db.aIProject.update({
      where: { id: projectId },
      data:  { updatedAt: new Date() },
    });
  }

  // ── Load ───────────────────────────────────────────────────────────────
  static async load(projectId: string): Promise<AIFileNode[]> {
    const rows = await db.aIProjectFile.findMany({
      where:   { projectId },
      orderBy: { path: "asc" },
      select:  { path: true, content: true },
    });

    return rows.map((r) => ({ path: r.path, content: r.content, type: "file" as const }));
  }

  // ── Upsert (update or create individual files) ─────────────────────────
  static async update(projectId: string, files: AIFileNode[]): Promise<void> {
    if (files.length === 0) return;

    await db.$transaction(
      files.map((f) =>
        db.aIProjectFile.upsert({
          where:  { projectId_path: { projectId, path: f.path } },
          update: { content: f.content },
          create: { projectId, path: f.path, content: f.content },
        })
      )
    );

    await db.aIProject.update({
      where: { id: projectId },
      data:  { updatedAt: new Date() },
    });
  }

  // ── Check existence ────────────────────────────────────────────────────
  static async exists(projectId: string): Promise<boolean> {
    const count = await db.aIProjectFile.count({ where: { projectId } });
    return count > 0;
  }

  // ── Delete a project's file tree ───────────────────────────────────────
  static async clear(projectId: string): Promise<void> {
    await db.aIProjectFile.deleteMany({ where: { projectId } });
  }
}





































// src/lib/ai/validation/semantic-validator.ts
//
// Cross-file semantic validation — runs after Stage 3 (codegen) and
// before Stage 4 (phi) in the pipeline.
//
// Catches bugs that syntax checkers and phi-fixer can't see:
//
//  Pass 0 — AUTO‑REPAIR LAYER (NEW)
//    - ensureMissingComponents() → creates stub files for used but missing components
//    - ensureImports() → adds missing import statements for components
//    - cleanCSS() → removes invalid CSS imports (e.g. reset.css)
//
//  Pass 1 — FILE CONCATENATION DETECTOR
//    Two workers sometimes produce output that gets joined into one
//    string (e.g. "export default Foo;\nimport React..." in the same file).
//    We split them back apart before anything else runs.
//
//  Pass 2 — PROP INTERFACE RECONCILER
//    The most common runtime crash: parent passes individual props
//    (name={x} role={y}) but child destructures a single object
//    ({ testimonial }), or vice versa.
//    We parse both sides statically and patch the PARENT to match
//    the CHILD's interface — never touch the child because it's the
//    authoritative contract.
//
//  Pass 3 — MISSING PROP DEFAULT GUARD
//    Any component that destructures props without a default guard
//    gets one injected so undefined props degrade gracefully instead
//    of throwing.
//
//  Final Pass — NORMALIZE JSX
//    Groups imports, removes duplicates, ensures exactly one blank line after imports.

import type { StreamFile } from "@/lib/ai/types/stream.types";
// ─── Constants ────────────────────────────────────────────────────────────────
const MAX_CONTENT_SIZE_FOR_HEAVY_OPS = 50_000;
const IGNORED_COMPONENTS = new Set([
  "SVG", "Path", "Fragment", "Defs", "ClipPath", "React",
  "motion", "AnimatePresence", "Suspense", "MotionDiv", "MotionConfig"
]);

// ─── Types ───────────────────────────────────────────────────────────────────
interface ComponentInterface {
  propParam: string;
  isDestructuredObject: boolean;
  destructuredKeys: string[];
  isFlatDestructure: boolean;
}

interface UsageSite {
  componentName: string;
  rawProps: string;
  passedPropNames: string[];
  fullMatch: string;
  index: number;
}

// ─── Utility: Relative import path resolver (improved) ────────────────────────
function resolveImportPath(fromPath: string, toPath: string): string {
  const fromParts = fromPath.split("/").slice(0, -1);
  const toParts = toPath.split("/");

  let i = 0;
  while (i < fromParts.length && i < toParts.length && fromParts[i] === toParts[i]) {
    i++;
  }

  const up = fromParts.length - i;
  const down = toParts.slice(i);

  let relativePath = "../".repeat(up) + down.join("/");
  relativePath = relativePath.replace(/\.(jsx|tsx)$/, "");
  // Normalize: remove double slashes, ensure leading ./ or ../
  relativePath = relativePath.replace(/\/+/g, "/");
  if (!relativePath.startsWith(".")) {
    relativePath = "./" + relativePath;
  }
  // Same directory case: "./Component" not "././Component"
  relativePath = relativePath.replace(/^\.\/\.\//, "./");
  return relativePath;
}

// ─── Helper: Check if a component is already imported ─────────────────────────
function hasImportForComponent(content: string, componentName: string): boolean {
  // 🔥 FIXED: Now catches named imports and namespace imports
  const patterns = [
    new RegExp(`import\\s+${componentName}\\s+from`),                    // import Button from
    new RegExp(`import\\s+\\{[^}]*\\b${componentName}\\b[^}]*\\}\\s+from`), // import { Button } from
    new RegExp(`import\\s+\\*\\s+as\\s+${componentName}\\s+from`)       // import * as Button from
  ];
  return patterns.some((r) => r.test(content));
}

// ─── Helper: Insert import after "use" directives and top comments ────────────
function insertImportAfterDirectives(content: string, importLine: string): string {
  const lines = content.split("\n");
  let insertIndex = 0;
  // Skip "use client", "use server", single-line comments, and multiline comments at the very top
  while (
    insertIndex < lines.length &&
    (lines[insertIndex].trim().startsWith('"use') ||
      lines[insertIndex].trim().startsWith("'use") ||
      lines[insertIndex].trim().startsWith("//") ||
      lines[insertIndex].trim().startsWith("/*"))  // 🔥 FIXED: Now handles multiline comments
  ) {
    insertIndex++;
  }
  lines.splice(insertIndex, 0, importLine);
  return lines.join("\n");
}

// ─── Helper: Extract component names from JSX, ignoring non‑local ones ────────
function extractComponentUsages(content: string): Set<string> {
  const usages = new Set<string>();
  const matches = content.match(/<([A-Z][a-zA-Z0-9]*)/g);
  if (!matches) return usages;
  for (const m of matches) {
    const name = m.slice(1);
    if (!IGNORED_COMPONENTS.has(name)) {
      usages.add(name);
    }
  }
  return usages;
}

// ─────────────────────────────────────────────────────────────────────────────
// 🔥 AUTO‑REPAIR FUNCTIONS
// ─────────────────────────────────────────────────────────────────────────────

function ensureMissingComponents(files: StreamFile[]): StreamFile[] {
  const existing = new Set<string>();
  for (const file of files) {
    if (file.path.endsWith(".jsx") || file.path.endsWith(".tsx")) {
      const base = file.path.split("/").pop()!;
      const name = base.replace(/\.(jsx|tsx)$/, "");
      existing.add(name);
    }
  }

  const usedComponents = new Set<string>();
  for (const file of files) {
    if (!file.path.endsWith(".jsx") && !file.path.endsWith(".tsx")) continue;
    for (const name of extractComponentUsages(file.content)) {
      usedComponents.add(name);
    }
  }

  const newFiles: StreamFile[] = [];
  const createdPaths = new Set(files.map((f) => f.path));

  for (const name of usedComponents) {
    // 🔥 FIXED: Only create stub if component doesn't exist in project
    const existsInProject = files.some(f =>
      f.path.endsWith(`${name}.jsx`) || f.path.endsWith(`${name}.tsx`)
    );
    
    if (!existing.has(name) && !existsInProject) {
      const stubPath = `src/components/${name}.jsx`;
      if (createdPaths.has(stubPath)) continue;

      console.log(`🧱 [SEMANTIC] Stub created: ${name}`);

      const stubContent = `import React from "react";

export default function ${name}() {
  return <div>${name}</div>;
}`;

      newFiles.push({ path: stubPath, content: stubContent });
      createdPaths.add(stubPath);
    }
  }

  return [...files, ...newFiles];
}

function ensureImports(files: StreamFile[]): StreamFile[] {
  // Track per‑file inserted imports to avoid duplicates within the same file
  const insertedImportsPerFile = new Map<string, Set<string>>();

  return files.map((file) => {
    if (!file.path.endsWith(".jsx") && !file.path.endsWith(".tsx")) return file;
    if (file.content.length > MAX_CONTENT_SIZE_FOR_HEAVY_OPS) {
      console.log(`⏩ [SEMANTIC] Skipped large file: ${file.path}`);
      return file;
    }

    let content = file.content;
    const usedComponents = extractComponentUsages(content);
    if (usedComponents.size === 0) return file;

    let insertedSet = insertedImportsPerFile.get(file.path);
    if (!insertedSet) {
      insertedSet = new Set();
      insertedImportsPerFile.set(file.path, insertedSet);
    }

    for (const name of usedComponents) {
      // Skip if already imported in file content or already inserted in this pass
      if (hasImportForComponent(content, name)) continue;
      if (insertedSet.has(name)) continue;

      const targetFile = files.find((f) =>
        f.path.endsWith(`${name}.jsx`) || f.path.endsWith(`${name}.tsx`)
      );
      if (!targetFile) continue;

      const importPath = resolveImportPath(file.path, targetFile.path);
      const importLine = `import ${name} from "${importPath}";`;
      content = insertImportAfterDirectives(content, importLine);
      insertedSet.add(name);
      console.log(`📦 [SEMANTIC] Import added: ${name} in ${file.path} from "${importPath}"`);
    }

    return { ...file, content };
  });
}

function cleanCSS(files: StreamFile[]): StreamFile[] {
  return files.map((file) => {
    if (!file.path.endsWith(".css")) return file;

    let content = file.content;
    const before = content;
    content = content.replace(/@import\s+["'].*reset\.css["'];?/gi, "");

    if (before !== content) {
      console.log(`🧹 [SEMANTIC] Removed invalid CSS import in ${file.path}`);
    }

    return { ...file, content };
  });
}

function normalizeJSX(files: StreamFile[]): StreamFile[] {
  return files.map((file) => {
    if (!file.path.endsWith(".jsx") && !file.path.endsWith(".tsx")) return file;
    if (file.content.length > MAX_CONTENT_SIZE_FOR_HEAVY_OPS) return file;

    const lines = file.content.split("\n");
    const importLines: string[] = [];
    const otherLines: string[] = [];
    const seenImports = new Set<string>();

    // Separate imports from other lines, preserving order within each group
    for (const line of lines) {
      if (line.trim().startsWith("import ")) {
        if (!seenImports.has(line)) {
          seenImports.add(line);
          importLines.push(line);
        }
      } else {
        otherLines.push(line);
      }
    }

    // 🔥 FIXED: Sort imports for stable ordering
    importLines.sort((a, b) => a.localeCompare(b));

    // Trim leading empty lines from otherLines
    let startIdx = 0;
    while (startIdx < otherLines.length && otherLines[startIdx].trim() === "") {
      startIdx++;
    }
    const trimmedOther = otherLines.slice(startIdx);

    // Assemble: imports first, then exactly one blank line, then the rest
    const newContent = importLines.length > 0
      ? importLines.join("\n") + "\n\n" + trimmedOther.join("\n")
      : trimmedOther.join("\n");

    if (newContent !== file.content) {
      console.log(`🧽 [SEMANTIC] Normalized JSX in ${file.path}`);
    }

    return { ...file, content: newContent };
  });
}

// ─── PUBLIC ENTRY POINT ───────────────────────────────────────────────────────

export function runSemanticValidation(files: StreamFile[]): StreamFile[] {
  let result = [...files];

  result = ensureMissingComponents(result);
  result = ensureImports(result);
  result = cleanCSS(result);

  result = pass1_splitConcatenated(result);
  result = pass2_reconcileProps(result);
  result = pass3_propDefaultGuards(result);

  result = normalizeJSX(result);

  return result;
}

// ═══════════════════════════════════════════════════════════════════════════
// PASS 1 — FILE CONCATENATION DETECTOR
// ═══════════════════════════════════════════════════════════════════════════

function pass1_splitConcatenated(files: StreamFile[]): StreamFile[] {
  const result: StreamFile[] = [];
  const extraFiles: StreamFile[] = [];

  for (const file of files) {
    if (!file.path.endsWith(".jsx") && !file.path.endsWith(".tsx")) {
      result.push(file);
      continue;
    }

    const boundary = findConcatenationBoundary(file.content);
    if (!boundary) {
      result.push(file);
      continue;
    }

    const firstFile = file.content.slice(0, boundary).trim();
    const secondFile = file.content.slice(boundary).trim();

    console.log(`✂️  [SEMANTIC] Split concatenated file: ${file.path}`);
    result.push({ path: file.path, content: firstFile });

    const inferredPath = inferPathFromContent(secondFile, file.path);
    if (inferredPath) {
      console.log(`✂️  [SEMANTIC] Recovered second file as: ${inferredPath}`);
      extraFiles.push({ path: inferredPath, content: secondFile });
    }
  }

  return [...result, ...extraFiles];
}

function findConcatenationBoundary(content: string): number | null {
  const exportDefaultRe = /export\s+default\s+\w+\s*;/g;
  let lastMatch: RegExpExecArray | null = null;
  let m: RegExpExecArray | null;

  while ((m = exportDefaultRe.exec(content)) !== null) {
    lastMatch = m;
  }

  if (!lastMatch) return null;

  const afterExport = lastMatch.index + lastMatch[0].length;
  const remainder = content.slice(afterExport).trimStart();

  if (
    /^import\s+/.test(remainder) ||
    /^['"]use\s+(client|server)['"]/.test(remainder) ||
    /^\/\*\s*=/.test(remainder)
  ) {
    return afterExport + (content.slice(afterExport).length - remainder.length);
  }

  return null;
}

function inferPathFromContent(content: string, siblingPath: string): string | null {
  const fnMatch = content.match(/export\s+default\s+(?:function\s+)?([A-Z][a-zA-Z]+)/);
  if (!fnMatch) return null;

  const compName = fnMatch[1];
  const dir = siblingPath.split("/").slice(0, -1).join("/");
  return `${dir}/${compName}.jsx`;
}

// ═══════════════════════════════════════════════════════════════════════════
// PASS 2 — PROP INTERFACE RECONCILER
// ═══════════════════════════════════════════════════════════════════════════

function pass2_reconcileProps(files: StreamFile[]): StreamFile[] {
  const interfaceMap = new Map<string, ComponentInterface>();

  for (const file of files) {
    if (!file.path.endsWith(".jsx") && !file.path.endsWith(".tsx")) continue;
    if (file.content.length > MAX_CONTENT_SIZE_FOR_HEAVY_OPS) continue;
    const iface = parseComponentInterface(file.content, file.path);
    if (iface) {
      const compName = file.path.split("/").pop()!.replace(/\.(jsx|tsx)$/, "");
      interfaceMap.set(compName, iface);
    }
  }

  return files.map((file) => {
    if (!file.path.endsWith(".jsx") && !file.path.endsWith(".tsx")) return file;
    if (file.content.length > MAX_CONTENT_SIZE_FOR_HEAVY_OPS) return file;

    let content = file.content;
    let changed = false;

    for (const [compName, iface] of interfaceMap) {
      const usages = findComponentUsages(content, compName);

      for (const usage of usages) {
        const patch = reconcileUsage(usage, iface, compName);
        if (patch && patch !== usage.fullMatch) {
          content = content.slice(0, usage.index) + patch + content.slice(usage.index + usage.fullMatch.length);
          changed = true;
          console.log(`🔀 [SEMANTIC] Reconciled props for <${compName}> in ${file.path}`);
        }
      }
    }

    return changed ? { ...file, content } : file;
  });
}

function parseComponentInterface(
  content: string,
  filePath: string
): ComponentInterface | null {
  const compName = filePath.split("/").pop()!.replace(/\.(jsx|tsx)$/, "");

  const patterns = [
    new RegExp(`(?:const|let)\\s+${compName}\\s*=\\s*\\(\\{\\s*([^}]+)\\}\\)\\s*=>`),
    new RegExp(`function\\s+${compName}\\s*\\(\\{\\s*([^}]+)\\}\\)`),
  ];

  for (const pattern of patterns) {
    const m = content.match(pattern);
    if (!m) continue;

    const paramContent = m[1].trim();
    const keys = paramContent
      .split(",")
      .map((k) => k.trim().split(":")[0].trim().split("=")[0].trim())
      .filter((k) => k && /^[a-zA-Z_$]/.test(k));

    const singleObjectPropNames = new Set([
      "testimonial", "item", "card", "post", "product", "user", "member",
      "review", "comment", "article", "feature", "plan", "tier", "step",
      "metric", "stat", "faq", "question", "entry", "record", "row",
      "option", "choice", "result", "data", "node", "leaf", "child",
      "contact", "team", "person", "author", "project", "task", "event",
    ]);

    if (keys.length === 1 && singleObjectPropNames.has(keys[0])) {
      return {
        propParam: keys[0],
        isDestructuredObject: true,
        destructuredKeys: [],
        isFlatDestructure: false,
      };
    }

    if (keys.length > 1) {
      return {
        propParam: "",
        isDestructuredObject: false,
        destructuredKeys: keys,
        isFlatDestructure: true,
      };
    }
  }

  return null;
}

function findComponentUsages(content: string, compName: string): UsageSite[] {
  const usages: UsageSite[] = [];
  const tagRe = new RegExp(
    `<${compName}((?:\\s+[^>]*?)?)(?:\\s*\\/?>)`,
    "gs"
  );

  let m: RegExpExecArray | null;
  while ((m = tagRe.exec(content)) !== null) {
    const rawProps = m[1].trim();
    const passedPropNames = extractPropNames(rawProps);

    usages.push({
      componentName: compName,
      rawProps,
      passedPropNames,
      fullMatch: m[0],
      index: m.index,
    });
  }

  return usages;
}

function extractPropNames(rawProps: string): string[] {
  const names: string[] = [];
  const propRe = /([a-zA-Z_$][a-zA-Z0-9_$]*)(?:\s*=\s*(?:\{[^}]*\}|"[^"]*"|'[^']*'|\w+))?/g;
  let m: RegExpExecArray | null;

  while ((m = propRe.exec(rawProps)) !== null) {
    const name = m[1];
    if (!["key", "ref", "className", "style", "id", "onClick", "onChange",
          "onSubmit", "href", "src", "alt", "type", "disabled", "placeholder",
          "value", "defaultValue", "aria-label", "role", "tabIndex"].includes(name)) {
      names.push(name);
    }
  }

  return names;
}

function reconcileUsage(
  usage: UsageSite,
  iface: ComponentInterface,
  compName: string
): string | null {
  const { passedPropNames, rawProps } = usage;

  if (iface.isDestructuredObject && iface.propParam) {
    const objectPropName = iface.propParam;

    if (passedPropNames.includes(objectPropName)) return null;

    const propAssignments = extractPropAssignments(rawProps);
    if (propAssignments.length === 0) return null;

    const objProps = propAssignments
      .map(({ name, value }) => `${name}: ${value}`)
      .join(", ");

    const keyProp = extractKeyProp(rawProps);
    const indexProp = extractIndexProp(rawProps);

    const newTag = [
      `<${compName}`,
      `  ${objectPropName}={{ ${objProps} }}`,
      keyProp ? `  ${keyProp}` : "",
      indexProp ? `  ${indexProp}` : "",
      `/>`,
    ]
      .filter(Boolean)
      .join("\n              ");

    console.log(`  → Wrapping flat props into { ${objectPropName} } for <${compName}>`);
    return newTag;
  }

  if (iface.isFlatDestructure && iface.destructuredKeys.length > 0) {
    const nonSpecialProps = passedPropNames.filter(
      (p) => !["key", "index"].includes(p)
    );

    if (nonSpecialProps.length === 1) {
      const objVarName = extractPropValue(rawProps, nonSpecialProps[0]);
      if (!objVarName) return null;

      const flatProps = iface.destructuredKeys
        .map((k) => `${k}={${objVarName}.${k}}`)
        .join(" ");

      const keyProp = extractKeyProp(rawProps);
      const newTag = `<${compName} ${flatProps}${keyProp ? ` ${keyProp}` : ""} />`;

      console.log(`  → Spreading object into flat props for <${compName}>`);
      return newTag;
    }
  }

  return null;
}

interface PropAssignment {
  name: string;
  value: string;
}

function extractPropAssignments(rawProps: string): PropAssignment[] {
  const assignments: PropAssignment[] = [];
  const re = /([a-zA-Z_$][a-zA-Z0-9_$]*)\s*=\s*(\{[^}]*\}|"[^"]*"|'[^']*'|[\w.[\]]+)/g;
  let m: RegExpExecArray | null;

  while ((m = re.exec(rawProps)) !== null) {
    const name = m[1];
    let value = m[2];

    if (["key", "index", "className", "style", "id"].includes(name)) continue;

    if (value.startsWith("{") && value.endsWith("}")) {
      value = value.slice(1, -1).trim();
    }

    assignments.push({ name, value });
  }

  return assignments;
}

function extractKeyProp(rawProps: string): string | null {
  const m = rawProps.match(/key=\{[^}]+\}/);
  return m ? m[0] : null;
}

function extractIndexProp(rawProps: string): string | null {
  const m = rawProps.match(/index=\{[^}]+\}/);
  return m ? m[0] : null;
}

function extractPropValue(rawProps: string, propName: string): string | null {
  const re = new RegExp(`${propName}\\s*=\\s*\\{([^}]+)\\}`);
  const m = rawProps.match(re);
  return m ? m[1].trim() : null;
}

// ═══════════════════════════════════════════════════════════════════════════
// PASS 3 — MISSING PROP DEFAULT GUARD
// ═══════════════════════════════════════════════════════════════════════════

const SINGLE_OBJECT_PROP_NAMES = new Set([
  "testimonial", "item", "card", "post", "product", "user", "member",
  "review", "comment", "article", "feature", "plan", "tier", "step",
  "metric", "stat", "faq", "question", "entry", "record", "row",
  "option", "choice", "result", "data", "node", "leaf", "child",
  "contact", "team", "person", "author", "project", "task", "event",
]);

function pass3_propDefaultGuards(files: StreamFile[]): StreamFile[] {
  return files.map((file) => {
    if (!file.path.endsWith(".jsx") && !file.path.endsWith(".tsx")) return file;
    if (file.content.length > MAX_CONTENT_SIZE_FOR_HEAVY_OPS) return file;

    let content = file.content;
    let changed = false;

    const singleObjRe = /\(\{\s*([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\}\)\s*(?:=>)?\s*\{/g;
    let m: RegExpExecArray | null;

    while ((m = singleObjRe.exec(content)) !== null) {
      const paramName = m[1];
      if (!SINGLE_OBJECT_PROP_NAMES.has(paramName)) continue;

      const bodyStart = m.index + m[0].length;
      const lookahead = content.slice(bodyStart, bodyStart + 100);
      if (lookahead.includes(`if (!${paramName})`)) continue;

      const guard = `\n  if (!${paramName}) return null;`;
      content = content.slice(0, bodyStart) + guard + content.slice(bodyStart);
      changed = true;

      console.log(`🛡️  [SEMANTIC] Added null guard for '${paramName}' in ${file.path}`);
    }

    return changed ? { ...file, content } : file;
  });
}
// ==================== FIXED BOTTOM SECTION OF stream-pipeline.ts ====================
// Replace everything from "// ==================== ADD BELOW EVERYTHING ====================" to end of file

import { generateCodeFromAI } from "@/lib/ai/llm/generate-code";

export async function streamProjectPipeline(
  prompt: string,
  handlers: {
    onFile: (file: StreamFile) => void | Promise<void>;
    onLog?: (msg: string) => void;
    onPing?: () => void;
    onDone: () => void;
    onError: (msg: string) => void;
  }
) {
  try {
    handlers.onLog?.("🚀 Starting pipeline");
    handlers.onPing?.();

    // ── Stage 1: Call the real AI code generator ─────────────────────────
    handlers.onLog?.("🧠 Generating project files with AI...");
    const rawFiles = await generateCodeFromAI(prompt);

    if (!rawFiles || rawFiles.length === 0) {
      handlers.onError("AI returned no files. Please try again.");
      return;
    }

    handlers.onLog?.(
      `📦 Generated ${rawFiles.length} raw file(s) — running semantic validation...`
    );
    handlers.onPing?.();

    // ── Stage 2: Semantic validation + auto-repair ────────────────────────
    // runSemanticValidation is defined above in this same file
    const validated = runSemanticValidation(
      rawFiles.map((f) => ({ path: f.path, content: f.content }))
    );

    handlers.onLog?.(`✅ Validation done — ${validated.length} file(s) ready`);
    handlers.onPing?.();

    // ── Stage 3: Stream every file to the client/DB ───────────────────────
    for (const file of validated) {
      await handlers.onFile(file);
      handlers.onPing?.();
    }

    handlers.onDone();
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Pipeline failed";
    console.error("❌ [streamProjectPipeline]", msg);
    handlers.onError(msg);
  }
}