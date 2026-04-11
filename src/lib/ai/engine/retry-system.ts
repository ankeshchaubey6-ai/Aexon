import type { StreamFile } from "@/lib/ai/stream/stream-pipeline";
import { checkSyntax } from "@/lib/ai/validation/syntax-checker";

const MAX_RETRIES = 2;

function sameErrors(a: string[], b: string[]) {
  return JSON.stringify(a) === JSON.stringify(b);
}

function extractMessages(errors: { message: string }[]) {
  return errors.map((e) => e.message).sort();
}

function hasCriticalCorruption(files: StreamFile[]): boolean {
  return files.some((file) => {
    const c = file.content;
    if (!c || !c.trim()) return true;
    if (/\);\s*=>/.test(c)) return true;
    if (/er-motion['"]/.test(c)) return true;
    if (/<REDACTED/.test(c)) return true;
    const exportDefaultCount = (c.match(/export\s+default/g) ?? []).length;
    if (exportDefaultCount > 1) return true;
    return false;
  });
}

function isOutputValid(files: StreamFile[]): boolean {
  return files.every((file) => {
    if (!file.content || !file.content.trim()) return false;
    if (/\.(jsx|tsx)$/.test(file.path) && !/export\s+default/.test(file.content)) return false;
    return true;
  });
}

function fallbackProject(): StreamFile[] {
  return [
    {
      path: "src/App.jsx",
      content: `
import React from 'react';

export default function App() {
  return (
    <div style={{ padding: "40px", textAlign: "center" }}>
      <h1>⚠️ Safe Fallback</h1>
      <p>Original generation failed, fallback loaded.</p>
    </div>
  );
}
      `,
    },
    {
      path: "src/main.jsx",
      content: `
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
      `,
    },
  ];
}

function basicFix(files: StreamFile[]): StreamFile[] {
  return files.map((file) => {
    let c = file.content;

    c = c.replace(/useMemo\s*\(\s*\(,\s*\[\]\s*\)/g, "useMemo(() => null, [])");
    c = c.replace(/useCallback\s*\(\s*\(([^)]*),\s*\[\]\s*\)\s*\)/g, "useCallback(($1) => {}, [])");
    c = c.replace(/\{\s*if\s*\([^}]+\)\s*\}/g, "");
    c = c.replace(/=\s*\/\s*>/g, "=>");
    c = c.replace(/<REDACTED[^>]*>/g, "");

    return { ...file, content: c };
  });
}

export async function runWithRetry(
  initialFiles: StreamFile[]
): Promise<StreamFile[]> {
  let files = initialFiles;
  let retries = 0;
  let prevErrors: string[] = [];

  if (hasCriticalCorruption(files)) {
    return fallbackProject();
  }

  while (retries < MAX_RETRIES) {
    const errors = checkSyntax(files);

    if (errors.length === 0) {
      return isOutputValid(files) ? files : fallbackProject();
    }

    const currentErrors = extractMessages(errors);

    if (sameErrors(prevErrors, currentErrors)) {
      return fallbackProject();
    }

    prevErrors = currentErrors;

    files = basicFix(files);

    if (hasCriticalCorruption(files)) {
      return fallbackProject();
    }

    retries++;
  }

  return isOutputValid(files) ? files : fallbackProject();
}