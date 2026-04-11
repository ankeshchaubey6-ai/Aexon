import * as parser from "@babel/parser";
import traverse, { NodePath } from "@babel/traverse";
import generate from "@babel/generator";
import * as t from "@babel/types";

export type AIFile = { path: string; content: string };

const CORRUPTION_PATTERNS = [
  /\);\s*=>/,
  /er-motion['"]/,
  /<REDACTED/,
];

const KNOWN_INVALID_TAGS: Record<string, string> = {
  sco: "svg",
  buutton: "button",
  buton: "button",
  diiv: "div",
  spann: "span",
};

const VALID_SVG_CHILDREN = new Set([
  "svg", "g", "path", "circle", "rect", "line", "polyline", "polygon",
  "ellipse", "text", "tspan", "defs", "use", "symbol", "clipPath",
  "linearGradient", "radialGradient", "stop", "mask", "pattern",
  "filter", "feBlend", "feColorMatrix", "feComposite", "feGaussianBlur",
  "feMerge", "feMergeNode", "feOffset", "title", "desc", "animate",
  "animateTransform", "animateMotion",
]);

const DANGEROUS_OUTPUT_PATTERNS = [
  /<\/sco>/,
  /export\s+default[\s\S]*export\s+default/,
  /<\/[^a-zA-Z][^>]*>/,
];

const POST_GEN_INVALID_PATTERNS = [
  /return\s*\(\s*\)\s*;/,
  /return\s*\[\s*\]\s*;/,
  /return\s+null\s*;/,
  /return\s*\(\s*\)\s*}/,
];

// Matches "Adjacent JSX elements must be wrapped" at the string level
// so we can catch anything the AST pass misses before it reaches Vite.
const ADJACENT_JSX_PATTERN = /(<\/[A-Za-z][A-Za-z0-9]*>\s*<[A-Za-z])|(<\/[A-Za-z][A-Za-z0-9]*\s*\/>\s*<[A-Za-z])/;

function isJS(path: string) {
  return /\.(js|jsx|ts|tsx)$/.test(path);
}

function isJSX(path: string) {
  return /\.(jsx|tsx)$/.test(path);
}

function safeFallback(file: AIFile): AIFile {
  const content = isJSX(file.path)
    ? `import React from 'react';\nexport default function SafeComponent() { return <div />; }`
    : `export default {};`;
  return { path: file.path, content };
}

function isCorrupted(content: string): boolean {
  if (!content || !content.trim()) return true;
  return CORRUPTION_PATTERNS.some((pattern) => pattern.test(content));
}

function hasExportDefaultInCode(code: string): boolean {
  return /export\s+default/.test(code);
}

function hasDuplicateExportDefault(code: string): boolean {
  const matches = code.match(/export\s+default/g);
  return matches ? matches.length > 1 : false;
}

function isCssImport(source: string): boolean {
  return (
    source.endsWith(".css") ||
    source.includes(".module.css") ||
    source.endsWith(".scss") ||
    source.endsWith(".sass") ||
    source.endsWith(".less")
  );
}

function stripCssImports(code: string): string {
  return code
    .replace(/^import\s+['"][^'"]*\.css['"]\s*;?\s*$/gm, "")
    .replace(/^import\s+\w+\s+from\s+['"][^'"]*\.css['"]\s*;?\s*$/gm, "")
    .replace(/^import\s+\{[^}]*\}\s+from\s+['"][^'"]*\.css['"]\s*;?\s*$/gm, "")
    .replace(/^import\s+['"][^'"]*\.scss['"]\s*;?\s*$/gm, "")
    .replace(/^import\s+['"][^'"]*\.sass['"]\s*;?\s*$/gm, "")
    .replace(/^import\s+['"][^'"]*\.less['"]\s*;?\s*$/gm, "")
    .replace(/\n{3,}/g, "\n\n");
}

function hasCssImportInCode(code: string): boolean {
  return /import\s+(?:['"][^'"]*\.css['"]|[^'"]*\s+from\s+['"][^'"]*\.css['"]|[^'"]*\s+from\s+['"][^'"]*\.scss['"]|[^'"]*\s+from\s+['"][^'"]*\.sass['"]|[^'"]*\s+from\s+['"][^'"]*\.less['"])/.test(code);
}

// ─── JSX root helpers ────────────────────────────────────────────────────────

function makeSafeDivElement(): t.JSXElement {
  return t.jsxElement(
    t.jsxOpeningElement(t.jsxIdentifier("div"), [], true),
    null,
    [],
    true
  );
}

/**
 * Wrap an arbitrary list of JSX-compatible children into a single <div>.
 * This is the canonical fix for "Adjacent JSX elements must be wrapped".
 */
function wrapChildrenInDiv(
  children: t.JSXElement["children"]
): t.JSXElement {
  const safeChildren = children.filter(
    (c): c is t.JSXElement["children"][number] =>
      t.isJSXElement(c) ||
      t.isJSXFragment(c) ||
      t.isJSXText(c) ||
      t.isJSXExpressionContainer(c) ||
      t.isJSXSpreadChild(c)
  );

  if (safeChildren.length === 0) return makeSafeDivElement();

  return t.jsxElement(
    t.jsxOpeningElement(t.jsxIdentifier("div"), [], false),
    t.jsxClosingElement(t.jsxIdentifier("div")),
    safeChildren,
    false
  );
}

/**
 * Flatten a (possibly nested) JSXFragment tree into a flat child array,
 * recursively unwrapping inner fragments.
 */
function flattenFragment(
  fragment: t.JSXFragment
): t.JSXElement["children"] {
  const result: t.JSXElement["children"] = [];
  for (const child of fragment.children) {
    if (t.isJSXFragment(child)) {
      result.push(...flattenFragment(child));
    } else {
      result.push(child);
    }
  }
  return result;
}

/**
 * Guarantee that `expr` is a single-root JSX element.
 *
 * Rules (in order):
 *  1. null / undefined            → <div />
 *  2. JSXFragment                 → always wrap into <div> (no exceptions)
 *  3. SequenceExpression          → collect JSX children → wrap in <div>
 *  4. ArrayExpression             → collect JSX elements → wrap in <div>
 *  5. JSXElement with >1 JSX     → this can't happen (JSXElement has one
 *     root by definition), but its *children* are validated below
 *  6. Anything else that isn't    → <div />
 *     a JSXElement
 *
 * For case 5 we also guard against a JSXElement whose children list
 * somehow contains multiple top-level JSX siblings (shouldn't be
 * possible in well-formed AST, but we defend it anyway).
 */
function enforceJsxSingleRoot(
  arg: t.Expression | null | undefined
): t.JSXElement {
  // ── 1. nothing ──────────────────────────────────────────────────────────
  if (!arg) return makeSafeDivElement();

  // ── 2. Fragment → always div-wrap ────────────────────────────────────────
  if (t.isJSXFragment(arg)) {
    const flat = flattenFragment(arg);
    return wrapChildrenInDiv(flat);
  }

  // ── 3. SequenceExpression (e.g. comma-separated JSX) ────────────────────
  if (t.isSequenceExpression(arg)) {
    const jsxChildren = arg.expressions.filter(
      (e): e is t.JSXElement | t.JSXFragment =>
        t.isJSXElement(e) || t.isJSXFragment(e)
    );
    if (jsxChildren.length === 0) return makeSafeDivElement();
    if (jsxChildren.length === 1 && t.isJSXElement(jsxChildren[0])) {
      return jsxChildren[0];
    }
    return wrapChildrenInDiv(jsxChildren as t.JSXElement["children"]);
  }

  // ── 4. ArrayExpression (e.g. [<A/>, <B/>]) ──────────────────────────────
  if (t.isArrayExpression(arg)) {
    const jsxEls = (arg.elements ?? []).filter(
      (e): e is t.JSXElement => e !== null && t.isJSXElement(e)
    );
    if (jsxEls.length === 0) return makeSafeDivElement();
    if (jsxEls.length === 1) return jsxEls[0];
    return wrapChildrenInDiv(jsxEls);
  }

  // ── 5. JSXElement — validate it is truly a single root ──────────────────
  if (t.isJSXElement(arg)) {
    // Guard: if children somehow contains multiple JSX element siblings,
    // this is technically impossible in a valid JSXElement (they are all
    // inside the one root tag), so we just return arg as-is; the element
    // IS the single root.  We do NOT re-wrap it — that would add a spurious
    // extra div.  What we DO do is recursively sanitise any Fragment children
    // so they can't escape as siblings at runtime.
    sanitizeJsxElementChildren(arg);
    return arg;
  }

  // ── 6. Anything else (identifier, call, conditional, …) ─────────────────
  // Conditional expressions and logical expressions can legitimately appear
  // as JSX return values (e.g. `condition ? <A/> : <B/>`), so we preserve
  // them.  Everything else gets replaced with a safe div.
  if (t.isConditionalExpression(arg) || t.isLogicalExpression(arg)) {
    // Still valid single-root JSX (the branches are JSX).
    return arg as unknown as t.JSXElement; // type-cast; Babel accepts this
  }

  return makeSafeDivElement();
}

/**
 * Walk a JSXElement's children and recursively unwrap any Fragments
 * into wrapping divs so they can never produce adjacent siblings at
 * the top level of a return statement.
 */
function sanitizeJsxElementChildren(el: t.JSXElement): void {
  el.children = el.children.map((child) => {
    if (t.isJSXFragment(child)) {
      // Replace the fragment with a <div> wrapping its contents
      return wrapChildrenInDiv(flattenFragment(child));
    }
    if (t.isJSXElement(child)) {
      sanitizeJsxElementChildren(child); // recurse
    }
    return child;
  });
}

// ─── rest of AST helpers (unchanged) ────────────────────────────────────────

function makeSafeDefaultExport(): t.ExportDefaultDeclaration {
  return t.exportDefaultDeclaration(
    t.functionDeclaration(
      t.identifier("App"),
      [],
      t.blockStatement([t.returnStatement(makeSafeDivElement())])
    )
  );
}

function makeReactImport(): t.ImportDeclaration {
  return t.importDeclaration(
    [t.importDefaultSpecifier(t.identifier("React"))],
    t.stringLiteral("react")
  );
}

function ensureFunctionHasJsxReturn(
  fn: t.FunctionDeclaration | t.FunctionExpression | t.ArrowFunctionExpression
): void {
  try {
    if (t.isArrowFunctionExpression(fn) && !t.isBlockStatement(fn.body)) {
      const expr = fn.body as t.Expression;
      fn.body = t.blockStatement([
        t.returnStatement(enforceJsxSingleRoot(expr)),
      ]);
      return;
    }

    if (!t.isBlockStatement(fn.body)) {
      (fn as t.FunctionDeclaration).body = t.blockStatement([
        t.returnStatement(makeSafeDivElement()),
      ]);
      return;
    }

    const body = fn.body as t.BlockStatement;
    const returnIdx = body.body.findIndex((stmt) => t.isReturnStatement(stmt));

    if (returnIdx === -1) {
      body.body.push(t.returnStatement(makeSafeDivElement()));
      return;
    }

    const returnStmt = body.body[returnIdx] as t.ReturnStatement;
    returnStmt.argument = enforceJsxSingleRoot(returnStmt.argument);
  } catch {
    (fn as t.FunctionDeclaration).body = t.blockStatement([
      t.returnStatement(makeSafeDivElement()),
    ]);
  }
}

function isValidJsxExpression(
  expr: t.Expression | t.JSXEmptyExpression
): boolean {
  if (t.isJSXEmptyExpression(expr)) return false;
  if (t.isIfStatement(expr as t.Node)) return false;
  if (
    t.isStringLiteral(expr) ||
    t.isNumericLiteral(expr) ||
    t.isNullLiteral(expr) ||
    t.isIdentifier(expr) ||
    t.isMemberExpression(expr) ||
    t.isCallExpression(expr) ||
    t.isJSXElement(expr) ||
    t.isJSXFragment(expr) ||
    t.isTemplateLiteral(expr)
  ) {
    return true;
  }
  if (t.isConditionalExpression(expr)) return true;
  if (t.isLogicalExpression(expr)) return true;
  if (t.isArrayExpression(expr)) return true;
  return false;
}

// ─── main export ─────────────────────────────────────────────────────────────

export function astPreProcess(files: AIFile[]): AIFile[] {
  return files.map((file) => {
    if (!isJS(file.path)) return file;

    if (isCorrupted(file.content)) {
      return safeFallback(file);
    }

    // PRE-PARSE SAFETY NET: strip CSS imports before the AST even sees the
    // source, so malformed CSS import syntax cannot cause a parse error that
    // short-circuits the pipeline.
    const preStripped = stripCssImports(file.content);

    try {
      let ast: ReturnType<typeof parser.parse>;
      try {
        ast = parser.parse(preStripped, {
          sourceType: "module",
          plugins: ["jsx"],
        });
      } catch {
        return safeFallback(file);
      }

      let hasExportDefault = false;
      let hasReactImport = false;
      let exportDefaultCount = 0;

      const declaredNames = new Map<string, NodePath>();

      traverse(ast, {
        ImportDeclaration(path: NodePath<t.ImportDeclaration>) {
          // ── PHASE 0: CSS elimination — must be the very first check ──────
          const source = path.node.source.value;
          if (isCssImport(source)) {
            path.remove();
            return;
          }
          // ─────────────────────────────────────────────────────────────────

          if (source.startsWith("@")) {
            path.remove();
            return;
          }

          if (source === "react") {
            hasReactImport = true;
          }

          const seen = new Set<string>();
          path.node.specifiers = path.node.specifiers.filter((s) => {
            let name = "";
            if (t.isImportSpecifier(s)) {
              name = t.isIdentifier(s.imported)
                ? s.imported.name
                : s.imported.value;
            } else if (t.isImportDefaultSpecifier(s)) {
              name = s.local.name;
            }
            if (seen.has(name)) return false;
            seen.add(name);
            return true;
          });

          // PHASE 1: remove empty imports
          if (
            path.node.specifiers.length === 0 &&
            source !== "react" &&
            source !== "react-dom"
          ) {
            path.remove();
          }
        },

        ExportNamedDeclaration(path: NodePath<t.ExportNamedDeclaration>) {
          path.remove();
        },

        FunctionDeclaration(path: NodePath<t.FunctionDeclaration>) {
          const name = path.node.id?.name;
          if (!name) return;
          if (declaredNames.has(name)) {
            try { declaredNames.get(name)!.remove(); } catch {}
          }
          declaredNames.set(name, path);
        },

        ExportDefaultDeclaration(
          path: NodePath<t.ExportDefaultDeclaration>
        ) {
          exportDefaultCount++;

          if (exportDefaultCount > 1) {
            path.remove();
            return;
          }

          hasExportDefault = true;

          const decl = path.node.declaration;

          const isFunction =
            t.isFunctionDeclaration(decl) ||
            t.isFunctionExpression(decl) ||
            t.isArrowFunctionExpression(decl);
          const isClass =
            t.isClassDeclaration(decl) || t.isClassExpression(decl);

          if (!isFunction && !isClass) {
            path.replaceWith(makeSafeDefaultExport());
            return;
          }

          if (isFunction) {
            try {
              ensureFunctionHasJsxReturn(
                decl as
                  | t.FunctionDeclaration
                  | t.FunctionExpression
                  | t.ArrowFunctionExpression
              );
            } catch {
              path.replaceWith(makeSafeDefaultExport());
            }
          }
        },

        JSXIdentifier(path: NodePath<t.JSXIdentifier>) {
          const name = path.node.name;
          if (KNOWN_INVALID_TAGS[name]) {
            path.node.name = KNOWN_INVALID_TAGS[name];
            return;
          }
          if (!/^[A-Za-z]/.test(name)) {
            path.node.name = "div";
          }
        },

        JSXElement(path: NodePath<t.JSXElement>) {
          try {
            const opening = path.node.openingElement;
            const closing = path.node.closingElement;

            if (!opening || (!closing && !opening.selfClosing)) {
              path.remove();
              return;
            }

            const openName = t.isJSXIdentifier(opening.name)
              ? opening.name.name
              : null;
            const closeName =
              closing && t.isJSXIdentifier(closing.name)
                ? closing.name.name
                : null;

            if (
              closing &&
              openName &&
              closeName &&
              openName !== closeName
            ) {
              path.replaceWith(
                t.jsxElement(
                  t.jsxOpeningElement(
                    t.jsxIdentifier("div"),
                    opening.attributes,
                    false
                  ),
                  t.jsxClosingElement(t.jsxIdentifier("div")),
                  path.node.children,
                  false
                )
              );
              return;
            }

            // ── SVG child safety ─────────────────────────────────────────
            if (openName === "svg") {
              const safeChildren = path.node.children.filter((child) => {
                if (t.isJSXElement(child)) {
                  const childName = t.isJSXIdentifier(
                    child.openingElement.name
                  )
                    ? child.openingElement.name.name
                    : null;
                  return childName
                    ? VALID_SVG_CHILDREN.has(childName)
                    : false;
                }
                return (
                  t.isJSXText(child) || t.isJSXExpressionContainer(child)
                );
              });

              if (safeChildren.length !== path.node.children.length) {
                if (safeChildren.length === 0) {
                  path.replaceWith(
                    t.jsxElement(
                      t.jsxOpeningElement(t.jsxIdentifier("div"), [], true),
                      null,
                      [],
                      true
                    )
                  );
                  return;
                }
                path.node.children = safeChildren;
              }
            }

            // ── Fragment children inside JSXElement → replace with div ───
            // A Fragment child would produce adjacent siblings when rendered.
            path.node.children = path.node.children.map((child) => {
              if (t.isJSXFragment(child)) {
                return wrapChildrenInDiv(flattenFragment(child));
              }
              return child;
            });
          } catch {
            try { path.remove(); } catch {}
          }
        },

        // ── ReturnStatement: single-root JSX enforcement ─────────────────
        ReturnStatement(path: NodePath<t.ReturnStatement>) {
          try {
            const arg = path.node.argument;

            // Replace with safe div for obviously broken cases first
            if (!arg) {
              path.node.argument = makeSafeDivElement();
              return;
            }

            if (
              t.isArrayExpression(arg) &&
              (arg.elements ?? []).length === 0
            ) {
              path.node.argument = makeSafeDivElement();
              return;
            }

            // Delegate ALL root-JSX normalisation to enforceJsxSingleRoot.
            // This covers: Fragment, SequenceExpression, ArrayExpression,
            // bare non-JSX values, and plain JSXElement (with child
            // fragment sanitisation).
            path.node.argument = enforceJsxSingleRoot(arg);
          } catch {
            path.node.argument = makeSafeDivElement();
          }
        },

        JSXExpressionContainer(
          path: NodePath<t.JSXExpressionContainer>
        ) {
          try {
            const expr = path.node.expression;

            if (t.isJSXEmptyExpression(expr)) {
              path.remove();
              return;
            }

            if (!isValidJsxExpression(expr as t.Expression)) {
              path.node.expression = t.nullLiteral();
            }
          } catch {
            try { path.remove(); } catch {}
          }
        },

        ArrowFunctionExpression(
          path: NodePath<t.ArrowFunctionExpression>
        ) {
          try {
            const body = path.node.body;

            if (!body) {
              path.node.body = t.blockStatement([
                t.returnStatement(makeSafeDivElement()),
              ]);
              return;
            }

            if (!t.isBlockStatement(body)) {
              // Concise arrow: `() => <Foo />` or `() => <><A/><B/></>`
              const single = enforceJsxSingleRoot(body as t.Expression);
              path.node.body = t.blockStatement([
                t.returnStatement(single),
              ]);
              return;
            }

            const block = body as t.BlockStatement;
            if (block.body.length === 0) {
              block.body.push(t.returnStatement(makeSafeDivElement()));
            }
          } catch {
            path.node.body = t.blockStatement([
              t.returnStatement(makeSafeDivElement()),
            ]);
          }
        },
      });

      ast.program.body = ast.program.body.filter(
        (node) => !t.isExportNamedDeclaration(node)
      );

      if (!hasExportDefault) {
        ast.program.body.push(makeSafeDefaultExport());
      }

      if (!hasReactImport) {
        ast.program.body.unshift(makeReactImport());
      }

      let output: { code: string };
      try {
        output = generate(ast, { retainLines: false, compact: false });
      } catch {
        return safeFallback(file);
      }

      if (!output.code || !output.code.trim()) {
        return safeFallback(file);
      }

      // POST-GENERATE PHASE 2: CSS safety net ────────────────────────────────
      if (hasCssImportInCode(output.code)) {
        const reStripped = stripCssImports(output.code);
        if (hasCssImportInCode(reStripped)) {
          return safeFallback(file);
        }
        output = { code: reStripped };
      }

      // POST-GENERATE PHASE 3: adjacent-JSX safety net ──────────────────────
      // The AST pass should have eliminated all cases, but as a final
      // guarantee we check the generated source for the pattern that Vite
      // rejects.  If it's still present, the file is unsafe — fallback.
      if (ADJACENT_JSX_PATTERN.test(output.code)) {
        return safeFallback(file);
      }

      if (!hasExportDefaultInCode(output.code)) {
        return safeFallback(file);
      }

      if (hasDuplicateExportDefault(output.code)) {
        return safeFallback(file);
      }

      for (const pattern of DANGEROUS_OUTPUT_PATTERNS) {
        if (pattern.test(output.code)) {
          return safeFallback(file);
        }
      }

      for (const pattern of POST_GEN_INVALID_PATTERNS) {
        if (pattern.test(output.code)) {
          return safeFallback(file);
        }
      }

      if (isJSX(file.path) && !/<[A-Za-z]/.test(output.code)) {
        return safeFallback(file);
      }

      return { ...file, content: output.code };
    } catch {
      return safeFallback(file);
    }
  });
}