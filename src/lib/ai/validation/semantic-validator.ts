// src/lib/ai/validation/semantic-validator.ts
//
// Cross-file semantic validation — runs after Stage 3 (codegen) and
// before Stage 4 (phi) in the pipeline.
//
// Catches bugs that syntax checkers and phi-fixer can't see:
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

import type { StreamFile } from "@/lib/ai/stream/stream-pipeline";

// ─── Types ───────────────────────────────────────────────────────────────────

interface ComponentInterface {
  /** The variable name used in the function signature, e.g. "testimonial" */
  propParam: string;
  /** Whether the prop param is a destructured object: ({ a, b, c }) */
  isDestructuredObject: boolean;
  /** Top-level keys if destructured: ['name', 'role', 'quote'] */
  destructuredKeys: string[];
  /** Whether it takes individual flat props: ({ name, role, quote }) */
  isFlatDestructure: boolean;
}

interface UsageSite {
  /** The JSX component name, e.g. "TestimonialCard" */
  componentName: string;
  /** Raw JSX attribute string, e.g. 'name={x} role={y} avatarInitials={z}' */
  rawProps: string;
  /** Parsed prop names passed at the call site */
  passedPropNames: string[];
  /** Full match for replacement */
  fullMatch: string;
  /** Start index in parent content */
  index: number;
}

// ─── Public entry point ───────────────────────────────────────────────────────

export function runSemanticValidation(files: StreamFile[]): StreamFile[] {
  let result = [...files];

  // Pass 1: split concatenated files
  result = pass1_splitConcatenated(result);

  // Pass 2: reconcile prop interfaces
  result = pass2_reconcileProps(result);

  // Pass 3: inject missing prop default guards
  result = pass3_propDefaultGuards(result);

  return result;
}

// ═══════════════════════════════════════════════════════════════════════════
// PASS 1 — FILE CONCATENATION DETECTOR
//
// Symptom: content of fileA ends with "export default Foo;" and is
// immediately followed by "import React" or another file's content
// in the same string. This happens when two LLM responses land in
// the same buffer slot.
//
// Fix: detect the boundary and keep only the first valid component.
// The second piece will be in allPaths and will have its own entry —
// or if not, ensureBoilerplate handles it.
// ═══════════════════════════════════════════════════════════════════════════

function pass1_splitConcatenated(files: StreamFile[]): StreamFile[] {
  const result: StreamFile[] = [];
  const extraFiles: StreamFile[] = [];

  for (const file of files) {
    if (!file.path.endsWith(".jsx")) {
      result.push(file);
      continue;
    }

    // Look for the pattern: export default Foo; ... import (another file begins)
    // The boundary is an "export default" followed by content that looks like
    // a new file (starts with import or 'use client' or a comment block)
    const boundary = findConcatenationBoundary(file.content);

    if (!boundary) {
      result.push(file);
      continue;
    }

    const firstFile = file.content.slice(0, boundary).trim();
    const secondFile = file.content.slice(boundary).trim();

    console.log(`✂️  [SEMANTIC] Split concatenated file: ${file.path}`);
    result.push({ path: file.path, content: firstFile });

    // Try to identify what the second piece is
    const inferredPath = inferPathFromContent(secondFile, file.path);
    if (inferredPath) {
      console.log(`✂️  [SEMANTIC] Recovered second file as: ${inferredPath}`);
      extraFiles.push({ path: inferredPath, content: secondFile });
    }
  }

  return [...result, ...extraFiles];
}

function findConcatenationBoundary(content: string): number | null {
  // Find all "export default X;" positions
  const exportDefaultRe = /export\s+default\s+\w+\s*;/g;
  let lastMatch: RegExpExecArray | null = null;
  let m: RegExpExecArray | null;

  while ((m = exportDefaultRe.exec(content)) !== null) {
    lastMatch = m;
  }

  if (!lastMatch) return null;

  const afterExport = lastMatch.index + lastMatch[0].length;
  const remainder = content.slice(afterExport).trimStart();

  // If what follows looks like a new file (import statement or use client)
  if (
    /^import\s+/.test(remainder) ||
    /^['"]use\s+(client|server)['"]/.test(remainder) ||
    /^\/\*\s*=/.test(remainder) // comment header like /* === */
  ) {
    return afterExport + (content.slice(afterExport).length - remainder.length);
  }

  return null;
}

function inferPathFromContent(content: string, siblingPath: string): string | null {
  // Try to extract the component name from "export default function Foo"
  // or "export default Foo;"
  const fnMatch = content.match(/export\s+default\s+(?:function\s+)?([A-Z][a-zA-Z]+)/);
  if (!fnMatch) return null;

  const compName = fnMatch[1];
  const dir = siblingPath.split("/").slice(0, -1).join("/");
  return `${dir}/${compName}.jsx`;
}

// ═══════════════════════════════════════════════════════════════════════════
// PASS 2 — PROP INTERFACE RECONCILER
//
// This catches the exact bug in the error report:
//   Child:  ({ testimonial }) — expects one object
//   Parent: <TestimonialCard name={x} role={y} ... />  — passes flat props
//
// Algorithm:
//  1. For each JSX file, parse its component interface (what it expects)
//  2. For each other file, find call sites for that component
//  3. If the call site disagrees with the interface, patch the PARENT
//
// We patch the parent (not the child) because:
//  - The child is the authoritative contract
//  - Patching the child would require changing its internal logic
//  - Patching the parent is a localised, safe transformation
// ═══════════════════════════════════════════════════════════════════════════

function pass2_reconcileProps(files: StreamFile[]): StreamFile[] {
  // Build interface map: componentName → interface
  const interfaceMap = new Map<string, ComponentInterface>();

  for (const file of files) {
    if (!file.path.endsWith(".jsx")) continue;
    const iface = parseComponentInterface(file.content, file.path);
    if (iface) {
      const compName = file.path.split("/").pop()!.replace(".jsx", "");
      interfaceMap.set(compName, iface);
    }
  }

  // For each file, find mismatched call sites and patch
  return files.map((file) => {
    if (!file.path.endsWith(".jsx")) return file;

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

/** Parse what a component expects from its props */
function parseComponentInterface(
  content: string,
  filePath: string
): ComponentInterface | null {
  const compName = filePath.split("/").pop()!.replace(".jsx", "");

  // Match: function Foo({ a, b, c }) or const Foo = ({ a, b, c }) =>
  // or function Foo(props) or const Foo = (props) =>
  // or function Foo({ wrapper }) — single object prop (our bug case)

  const patterns = [
    // Arrow function with destructured object param: ({ testimonial })
    new RegExp(`(?:const|let)\\s+${compName}\\s*=\\s*\\(\\{\\s*([^}]+)\\}\\)\\s*=>`),
    // Regular function with destructured object param
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

    // Heuristic: if there's only ONE key and it's camelCase without
    // a corresponding JSX attribute pattern (not 'name','role','text', etc.),
    // it's likely a single object prop (e.g. "testimonial", "item", "card")
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

    // Multiple keys → flat destructure
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

/** Find all usages of a component in a file's JSX */
function findComponentUsages(content: string, compName: string): UsageSite[] {
  const usages: UsageSite[] = [];

  // Match self-closing: <ComponentName ... />
  // and opening tag: <ComponentName ...>
  // We capture everything between < and the closing > or />
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

/** Extract prop names from a JSX attribute string */
function extractPropNames(rawProps: string): string[] {
  const names: string[] = [];
  // Match: propName={...} or propName="..." or propName
  const propRe = /([a-zA-Z_$][a-zA-Z0-9_$]*)(?:\s*=\s*(?:\{[^}]*\}|"[^"]*"|'[^']*'|\w+))?/g;
  let m: RegExpExecArray | null;

  while ((m = propRe.exec(rawProps)) !== null) {
    const name = m[1];
    // Skip React special props and HTML attributes
    if (!["key", "ref", "className", "style", "id", "onClick", "onChange",
          "onSubmit", "href", "src", "alt", "type", "disabled", "placeholder",
          "value", "defaultValue", "aria-label", "role", "tabIndex"].includes(name)) {
      names.push(name);
    }
  }

  return names;
}

/**
 * Given a usage site and the child's expected interface,
 * return the corrected JSX tag string, or null if no change needed.
 */
function reconcileUsage(
  usage: UsageSite,
  iface: ComponentInterface,
  compName: string
): string | null {
  const { passedPropNames, rawProps, fullMatch } = usage;

  // Case 1: Child expects a single object prop (e.g. testimonial={...})
  // but parent is passing flat props (name={x} role={y} ...)
  if (iface.isDestructuredObject && iface.propParam) {
    const objectPropName = iface.propParam;

    // Check if parent is already passing the object prop
    if (passedPropNames.includes(objectPropName)) return null; // already correct

    // Parent is passing flat props — we need to wrap them into an object
    // Extract all the prop assignments from rawProps
    const propAssignments = extractPropAssignments(rawProps);

    if (propAssignments.length === 0) return null;

    // Build the object: testimonial={{ name: testimonial.name, role: ...}}
    // We need to figure out the variable name in the parent's map callback
    // Look for patterns like: testimonials.map((testimonial, index) => ...)
    // For now, build inline object from the prop values
    const objProps = propAssignments
      .map(({ name, value }) => `${name}: ${value}`)
      .join(", ");

    // Reconstruct tag: <TestimonialCard testimonial={{ name: x, role: y }} key={...} />
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

  // Case 2: Child expects flat props but parent passes a single object
  if (iface.isFlatDestructure && iface.destructuredKeys.length > 0) {
    // Parent is passing: <Foo item={x} /> but child expects { name, role }
    // Check if any single non-key/index prop is being passed
    const nonSpecialProps = passedPropNames.filter(
      (p) => !["key", "index"].includes(p)
    );

    if (nonSpecialProps.length === 1) {
      const objVarName = extractPropValue(rawProps, nonSpecialProps[0]);
      if (!objVarName) return null;

      // Spread the object into flat props
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
  // Match: propName={value} or propName="value"
  const re = /([a-zA-Z_$][a-zA-Z0-9_$]*)\s*=\s*(\{[^}]*\}|"[^"]*"|'[^']*'|[\w.[\]]+)/g;
  let m: RegExpExecArray | null;

  while ((m = re.exec(rawProps)) !== null) {
    const name = m[1];
    let value = m[2];

    // Skip special props
    if (["key", "index", "className", "style", "id"].includes(name)) continue;

    // Strip outer braces: {testimonial.name} → testimonial.name
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
//
// Any component that destructures a single object prop (the "testimonial"
// pattern) should have a null guard so it degrades gracefully even if
// the parent passes undefined. We inject: if (!testimonial) return null;
// at the top of the function body.
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
    if (!file.path.endsWith(".jsx")) return file;

    let content = file.content;
    let changed = false;

    // Find: const Foo = ({ testimonial }) => { or function Foo({ testimonial }) {
    const singleObjRe = /\(\{\s*([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\}\)\s*(?:=>)?\s*\{/g;
    let m: RegExpExecArray | null;

    while ((m = singleObjRe.exec(content)) !== null) {
      const paramName = m[1];
      if (!SINGLE_OBJECT_PROP_NAMES.has(paramName)) continue;

      // Find the opening brace of the function body
      const bodyStart = m.index + m[0].length;

      // Check if guard already exists
      const lookahead = content.slice(bodyStart, bodyStart + 100);
      if (lookahead.includes(`if (!${paramName})`)) continue;

      // Inject guard after the opening brace
      const guard = `\n  if (!${paramName}) return null;`;
      content = content.slice(0, bodyStart) + guard + content.slice(bodyStart);
      changed = true;

      console.log(`🛡️  [SEMANTIC] Added null guard for '${paramName}' in ${file.path}`);
    }

    // Also add default props for flat destructuring to prevent undefined crashes
    // Pattern: const { name = '', role = '', rating = 0 } = props/testimonial
    // We don't auto-add these as they require knowing the type — the null
    // guard above is sufficient for the crash case

    return changed ? { ...file, content } : file;
  });
}