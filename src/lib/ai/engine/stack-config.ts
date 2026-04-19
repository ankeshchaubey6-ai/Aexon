// src/lib/ai/engine/stack-config.ts
//
// The pipeline uses Vite + React (not Next.js).
// All boilerplate generation is driven from here so pipeline.ts
// and deepseek-generator.ts share a single source of truth.
//

export const DEFAULT_STACK = {
  framework: "vite",
  ui: "react",
  language: "jsx",        // plain JSX — no TypeScript
  styling: "inline",      // inline styles only — no CSS files
  bundler: "vite@5",
  reactVersion: "18.2.0",
} as const;

// ─────────────────────────────────────────────
// BOILERPLATE FILE GENERATORS
// ─────────────────────────────────────────────

export function makePackageJson(projectName: string): string {
  return JSON.stringify(
    {
      name: projectName.toLowerCase().replace(/\s+/g, "-"),
      private: true,
      version: "0.0.0",
      type: "module",
      scripts: {
        dev: "vite",
        build: "vite build",
        preview: "vite preview",
      },
      dependencies: {
        react: "^18.2.0",
        "react-dom": "^18.2.0",
      },
      devDependencies: {
        vite: "^5.0.0",
        "@vitejs/plugin-react": "^4.0.0",
      },
    },
    null,
    2
  );
}

export function makeIndexHtml(projectName: string): string {
  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${projectName}</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>`;
}

export function makeMainJsx(): string {
  return `import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);`;
}

export function makeViteConfig(): string {
  return `import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
});`;
}

// ─────────────────────────────────────────────
// REQUIRED FILES — enforced by Stage 5 assembler
// ─────────────────────────────────────────────

export interface RequiredFile {
  path: string;
  generator: (projectName: string) => string;
}

export const REQUIRED_FILES: RequiredFile[] = [
  { path: "package.json",   generator: makePackageJson },
  { path: "index.html",     generator: makeIndexHtml },
  { path: "src/main.jsx",   generator: () => makeMainJsx() },
  { path: "vite.config.js", generator: () => makeViteConfig() },
];

// ─────────────────────────────────────────────
// SYSTEM PROMPT CONSTANTS
// Shared across deepseek-generator and pipeline
// ─────────────────────────────────────────────

export const CODEGEN_RULES = `
RULES (enforced):
- React functional components with hooks only — no class components
- No react-router-dom; no external libraries besides react and react-dom
- Export default at the bottom of every .jsx file
- All imports use relative paths (e.g. ./components/Header — NOT @/)
- No TypeScript; plain .jsx files only
- Write complete, production-quality code — no placeholders, no TODOs
- Use inline styles (style={{}}) for all styling — DO NOT import or use any .css files
- Components: use realistic copy, unicode/emoji icons, real content
`.trim();

export const VALIDATOR_RULES = `
Fix ONLY syntax errors:
- Unclosed JSX tagsw
- Missing export default
- Missing React import (import React from 'react')
- Unbalanced braces or parentheses
- Broken import statements

Do NOT change logic, component names, styling, or functionality.
Preserve every line that is already valid.
`.trim();