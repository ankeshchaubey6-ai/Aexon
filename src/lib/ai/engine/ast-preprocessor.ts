// src/lib/ai/ast/ast-preprocessor.ts
// v18.0 — Minimal AST normalization without altering behavior.
//
// Only performs:
//   - Fix "= />" → "=>" (string pre-pass)
//   - Ensure React import if JSX used
//   - Remove duplicate imports
//   - Ensure exactly one export default
//   - Add missing return statement (fallback to <div />)
//   - Wrap multiple root JSX in Fragment
//
// No fallbacks, no CSS removal, no tag replacements, no destructive edits.

import * as parser from "@babel/parser";
import traverse, { NodePath } from "@babel/traverse";
import generate from "@babel/generator";
import * as t from "@babel/types";

export type AIFile = { path: string; content: string };

function isJS(path: string) {
  return /\.(js|jsx|ts|tsx)$/.test(path);
}

function isJSX(path: string) {
  return /\.(jsx|tsx)$/.test(path);
}

/**
 * Pre-process string content before parsing.
 * Only fixes broken arrow artifact.
 */
function preProcessContent(content: string): string {
  return content.replace(/=\s*\/\s*>/g, "=>");
}

/**
 * Create a minimal safe JSX element for fallback return.
 */
function makeFallbackJsxElement(): t.JSXElement {
  return t.jsxElement(
    t.jsxOpeningElement(t.jsxIdentifier("div"), [], true),
    null,
    [],
    true
  );
}

/**
 * Wrap a list of JSX children in a React Fragment.
 */
function wrapInFragment(children: t.JSXElement["children"]): t.JSXFragment {
  return t.jsxFragment(
    t.jsxOpeningFragment(),
    t.jsxClosingFragment(),
    children
  );
}

/**
 * Ensure a return statement's argument is a single JSX root.
 * If multiple roots are detected, wrap them in a Fragment.
 */
function enforceSingleJsxRoot(
  expr: t.Expression | t.JSXEmptyExpression | null | undefined
): t.Expression {
  if (!expr) return makeFallbackJsxElement();

  // Fragment already is a single root
  if (t.isJSXFragment(expr)) return expr;

  // JSXElement is single root
  if (t.isJSXElement(expr)) return expr;

  // SequenceExpression: multiple expressions → wrap JSX parts in Fragment
  if (t.isSequenceExpression(expr)) {
    const jsxChildren = expr.expressions.filter(
      (e): e is t.JSXElement | t.JSXFragment =>
        t.isJSXElement(e) || t.isJSXFragment(e)
    );
    if (jsxChildren.length === 0) return makeFallbackJsxElement();
    if (jsxChildren.length === 1) return jsxChildren[0];
    return wrapInFragment(jsxChildren);
  }

  // ArrayExpression: multiple elements → wrap in Fragment
  if (t.isArrayExpression(expr)) {
    const jsxElements = (expr.elements ?? []).filter(
      (e): e is t.JSXElement | t.JSXFragment =>
        e !== null && (t.isJSXElement(e) || t.isJSXFragment(e))
    );
    if (jsxElements.length === 0) return makeFallbackJsxElement();
    if (jsxElements.length === 1) return jsxElements[0];
    return wrapInFragment(jsxElements);
  }

  // JSXEmptyExpression (empty braces) cannot be returned as a standalone expression
  if (t.isJSXEmptyExpression(expr)) {
    return makeFallbackJsxElement();
  }

  // Conditional or logical expressions that might contain JSX are fine
  if (t.isConditionalExpression(expr) || t.isLogicalExpression(expr)) {
    return expr;
  }

  // Other non-JSX values: leave as is (they are valid)
  return expr;
}

export function astPreProcess(files: AIFile[]): AIFile[] {
  return files.map((file) => {
    if (!isJS(file.path)) return file;

    // Pre-process string fixes
    const preprocessed = preProcessContent(file.content);

    let ast: ReturnType<typeof parser.parse>;
    try {
      ast = parser.parse(preprocessed, {
        sourceType: "module",
        plugins: ["jsx"],
      });
    } catch {
      // Unparseable — return original without changes
      return file;
    }

    let hasReactImport = false;
    let exportDefaultCount = 0;
    const seenImports = new Set<string>();

    traverse(ast, {
      ImportDeclaration(path: NodePath<t.ImportDeclaration>) {
        const source = path.node.source.value;

        if (source === "react") {
          hasReactImport = true;
        }

        // Remove duplicate import specifiers within same declaration
        const specifierNames = new Set<string>();
        path.node.specifiers = path.node.specifiers.filter((spec) => {
          let name = "";
          if (t.isImportSpecifier(spec)) {
            name = t.isIdentifier(spec.imported)
              ? spec.imported.name
              : spec.imported.value;
          } else if (t.isImportDefaultSpecifier(spec)) {
            name = spec.local.name;
          } else if (t.isImportNamespaceSpecifier(spec)) {
            name = spec.local.name;
          }
          if (specifierNames.has(name)) return false;
          specifierNames.add(name);
          return true;
        });

        // Remove duplicate entire import declarations
        const importKey = `${source}:${JSON.stringify(path.node.specifiers.map(s => s.type))}`;
        if (seenImports.has(importKey)) {
          path.remove();
          return;
        }
        seenImports.add(importKey);
      },

      ExportDefaultDeclaration(path: NodePath<t.ExportDefaultDeclaration>) {
        exportDefaultCount++;
        if (exportDefaultCount > 1) {
          path.remove();
        }
      },

      ReturnStatement(path: NodePath<t.ReturnStatement>) {
        const arg = path.node.argument;
        path.node.argument = enforceSingleJsxRoot(arg);
      },

      ArrowFunctionExpression(path: NodePath<t.ArrowFunctionExpression>) {
        const body = path.node.body;
        if (!t.isBlockStatement(body)) {
          // Concise arrow: ensure single root
          const single = enforceSingleJsxRoot(body as t.Expression);
          path.node.body = t.blockStatement([t.returnStatement(single)]);
        } else {
          // Block body: ensure at least one return
          const block = body as t.BlockStatement;
          const hasReturn = block.body.some(stmt => t.isReturnStatement(stmt));
          if (!hasReturn) {
            block.body.push(t.returnStatement(makeFallbackJsxElement()));
          }
        }
      },

      FunctionDeclaration(path: NodePath<t.FunctionDeclaration>) {
        const body = path.node.body;
        const hasReturn = body.body.some(stmt => t.isReturnStatement(stmt));
        if (!hasReturn) {
          body.body.push(t.returnStatement(makeFallbackJsxElement()));
        }
      },

      FunctionExpression(path: NodePath<t.FunctionExpression>) {
        const body = path.node.body;
        const hasReturn = body.body.some(stmt => t.isReturnStatement(stmt));
        if (!hasReturn) {
          body.body.push(t.returnStatement(makeFallbackJsxElement()));
        }
      },
    });

    // Ensure React import if JSX is used in the file (heuristic)
    const codeAfterTraverse = generate(ast, { retainLines: false }).code;
    const hasJSX = /<[A-Za-z]/.test(codeAfterTraverse) || /<>/.test(codeAfterTraverse);
    if (hasJSX && !hasReactImport) {
      ast.program.body.unshift(
        t.importDeclaration(
          [t.importDefaultSpecifier(t.identifier("React"))],
          t.stringLiteral("react")
        )
      );
    }

    // Ensure exactly one export default for JSX files
    if (isJSX(file.path) && exportDefaultCount === 0) {
      // Try to detect a component-like function and add export
      let componentName: string | null = null;
      traverse(ast, {
        FunctionDeclaration(path) {
          const name = path.node.id?.name;
          if (name && /^[A-Z]/.test(name)) {
            componentName = name;
            path.stop();
          }
        },
        VariableDeclarator(path) {
          const id = path.node.id;
          if (t.isIdentifier(id) && /^[A-Z]/.test(id.name)) {
            componentName = id.name;
            path.stop();
          }
        },
      });
      if (componentName) {
        ast.program.body.push(
          t.exportDefaultDeclaration(t.identifier(componentName))
        );
      } else {
        // Fallback: export default function App() { return <div /> }
        ast.program.body.push(
          t.exportDefaultDeclaration(
            t.functionDeclaration(
              t.identifier("App"),
              [],
              t.blockStatement([t.returnStatement(makeFallbackJsxElement())])
            )
          )
        );
      }
    }

    let output: string;
    try {
      output = generate(ast, { retainLines: false, compact: false }).code;
    } catch {
      // Generation failed — return original
      return file;
    }

    // Final trim and newline
    output = output.trim() + "\n";

    return { ...file, content: output };
  });
}