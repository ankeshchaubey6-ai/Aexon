import OpenAI from "openai";
import { fixWholeProjectWithRetry } from "@/lib/ai/engine/project-fixer";

const client = new OpenAI({
  apiKey: process.env.NVIDIA_API_KEY!,
  baseURL: "https://integrate.api.nvidia.com/v1",
});

const DEBUG =
  typeof window !== "undefined"
    ? ((window as unknown as Record<string, unknown>).AI_DEBUG ?? false)
    : false;

function logWarn(...args: unknown[]) { if (DEBUG) console.warn(...args); }
function logError(...args: unknown[]) { if (DEBUG) console.error(...args); }
function logInfo(...args: unknown[]) { if (DEBUG) console.log(...args); }

export type AIFile = {
  path: string;
  content: string;
};

type RawAIFile = {
  path?: unknown;
  content?: unknown;
  [key: string]: unknown;
};

const FORBIDDEN_PACKAGES = [
  "framer-motion",
  "lucide-react",
  "clsx",
  "zustand",
  "recharts",
  "axios",
  "react-hook-form",
  "zod",
  "react-router-dom",
  "react-router",
  "three",
  "@react-three/fiber",
  "@react-three/drei",
  "gsap",
  "react-intersection-observer",
  "@tanstack/react-query",
  "preact",
  "styled-components",
  "@emotion/react",
  "@emotion/styled",
];

const SYSTEM_PROMPT = `
CRITICAL CONTRACT:
If your output violates ANY rule, it will be completely discarded.

You MUST self-validate BEFORE returning.

You MUST internally simulate:
* import resolution
* file existence
* export correctness

If ANY issue exists → FIX BEFORE OUTPUT.

Never output invalid code.

CRITICAL HARD RULE:
If you import ANY external library (framer-motion, lucide-react, clsx, zustand, recharts, axios, react-hook-form, zod, etc.), your output will be REJECTED and discarded.

You MUST implement:
- animations using CSS only
- icons using text or emoji
- class merging using template strings

ONLY allowed imports:
- react
- react-dom
- local files (relative imports)

CSS FILES — ABSOLUTE PROHIBITION:
- NEVER create any .css files
- NEVER import any .css files (e.g. import './App.css' is FORBIDDEN)
- NEVER write any import statement ending in .css
- ALL styling must be done exclusively with inline style={{}} props
- If you need to style something, use: style={{ color: 'red', padding: '20px' }}
- There is NO exception to this rule. Any .css import will cause immediate rejection.

You are a React developer generating a simple, valid Vite + React app.

## STRICT FILE STRUCTURE
Every .jsx file MUST follow this EXACT structure:

import React from 'react';

export default function ComponentName() {
  return (
    <div>
      CONTENT
    </div>
  );
}

RULES (violations will crash the build):
- Always include: import React from 'react';
- Always include exactly ONE export default per file
- JSX must be fully valid and every tag must be closed
- No empty return statements
- No fragments (<> </>) unless wrapping multiple top-level elements
- No default parameter values using JSX

## IMPORTS
- Only import files that exist in your output array
- Use relative imports only: ./components/X or ../components/X
- NEVER use @ alias or absolute paths
- NEVER import from external packages except: react, react-dom
- NEVER import .css files — this will cause IMMEDIATE REJECTION

## BANNED FEATURES — NEVER USE THESE
- NO .css files of any kind
- NO CSS imports of any kind
- NO animations or transitions
- NO custom hooks
- NO useEffect (unless the feature is completely impossible without it)
- NO useContext or Context API
- NO React Router or any routing library
- NO external component libraries
- NO icon libraries
- NO framer-motion
- NO zustand
- NO recharts
- NO react-hook-form
- NO zod
- NO axios
- NO lucide-react
- NO any library not in: react, react-dom

## PROJECT CONSTRAINTS
- Maximum 6 files total
- Maximum 4 components
- All components go in src/components/ — no deeper nesting
- No barrel index files
- File structure must be flat and predictable
- Only .jsx and .js files are allowed — NO .css files

## OUTPUT RULES — ABSOLUTE
- Return ONLY a valid JSON array — nothing else
- No markdown fences, no explanation, no preamble, no trailing text
- No trailing commas anywhere in the JSON
- All strings must be properly escaped (use \\n for newlines inside JSON strings)
- Do NOT use actual newlines inside JSON string values — escape them as \\n
- Do NOT use unescaped double quotes inside string values — escape them as \\"
- Every object must have exactly two keys: "path" and "content"
- "path" must be a valid relative file path string (e.g. "src/App.jsx")
- "content" must be a string with the full file content
- Each file must have exactly ONE export default
- Component filenames MUST be valid JS identifiers — never start with a digit
- NEVER include test files
- NEVER include .css files

## REQUIRED FILES
Always include:
- src/App.jsx
- src/main.jsx

src/main.jsx must be exactly:
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
ReactDOM.createRoot(document.getElementById('root')).render(<App />);

## QUALITY RULES
- All features FULLY FUNCTIONAL — no TODOs, no placeholders
- Use ONLY inline styles: style={{ key: 'value' }} — NO external CSS
- Use only useState for state management
- Keep components simple and self-contained

OUTPUT FORMAT:
[
  { "path": "src/App.jsx", "content": "import React from 'react';\\n\\nexport default function App() {\\n  return (\\n    <div style={{ padding: '40px' }}>Hello</div>\\n  );\\n}" },
  { "path": "src/main.jsx", "content": "import React from 'react';\\nimport ReactDOM from 'react-dom/client';\\nimport App from './App.jsx';\\nReactDOM.createRoot(document.getElementById('root')).render(<App />);" }
]
`.trim();

const RETRY_SUFFIX =
  "\n\nYour previous output failed validation. You MUST strictly follow all rules. Any syntax error, missing export default, banned import, .css import, or structural violation will be rejected. Keep it simple. Return only the JSON array. Remember: NO .css files, NO CSS imports — inline styles ONLY.";

function hasForbiddenImports(code: string): boolean {
  const pattern = new RegExp(
    `(?:^|\\n)import\\s+.*?\\s+from\\s+['"](${FORBIDDEN_PACKAGES.join("|")})[^'"]*['"]`,
    "gm"
  );
  return pattern.test(code);
}

function hasCssImport(code: string): boolean {
  return /import\s+.*\.css['"]/.test(code) || /import\s+['"][^'"]+\.css['"]/.test(code);
}

function extractImports(code: string): string[] {
  const matches = code.match(/import\s+.*?from\s+['"][^'"]+['"]/g) || [];
  return matches
    .map((m) => m.match(/from\s+['"]([^'"]+)['"]/)?.[1])
    .filter(Boolean) as string[];
}

function resolveImportPath(from: string, relative: string): string {
  const base = from.split("/").slice(0, -1);
  const parts = relative.split("/");

  for (const p of parts) {
    if (p === ".") continue;
    if (p === "..") base.pop();
    else base.push(p);
  }

  let resolved = base.join("/");
  if (!resolved.match(/\.\w+$/)) resolved += ".jsx";
  return resolved;
}

function hasNamedExport(code: string): boolean {
  return /export\s+(const|function|class)\s+/.test(code);
}

function validateFilesStrict(files: AIFile[]): boolean {
  if (!files || files.length === 0) return false;

  const fileSet = new Set(files.map((f) => f.path));

  for (const f of files) {
    // Hard fail: no .css files allowed at all
    if (f.path.endsWith(".css")) {
      logWarn("[AI][VALIDATE] Rejected: .css file found in output:", f.path);
      return false;
    }

    if (!f.content || f.content.trim().length < 30) return false;
    if (!/export\s+default\s/.test(f.content)) return false;
    if (hasNamedExport(f.content)) return false;
    if (hasForbiddenImports(f.content)) return false;

    // Hard fail: no CSS imports allowed
    if (hasCssImport(f.content)) {
      logWarn("[AI][VALIDATE] Rejected: .css import found in file:", f.path);
      return false;
    }

    const localImportLines = (
      f.content.match(/import\s+.*?from\s+['"][^'"]+['"]/g) || []
    ).filter((line) => {
      const src = line.match(/from\s+['"]([^'"]+)['"]/)?.[1] ?? "";
      return src.startsWith(".");
    });

    for (const line of localImportLines) {
      if (/import\s+\{.*?\}\s+from/.test(line)) return false;
    }

    const imports = extractImports(f.content);
    for (const imp of imports) {
      if (!imp.startsWith(".")) continue;
      const resolved = resolveImportPath(f.path, imp);
      if (!fileSet.has(resolved)) return false;
    }

    if (f.path.endsWith(".jsx")) {
      if (!/return\s*\(/.test(f.content) && !/return\s+</.test(f.content)) return false;
      if (/return\s*\(\s*\)/.test(f.content) || /return\s*null\s*;?\s*$/.test(f.content)) return false;
      if (!/import\s+React\s+from\s+['"]react['"]/.test(f.content)) return false;

      const hookUsages = f.content.match(/\buse[A-Z][a-zA-Z]+\b/g) || [];
      const allowedHooks = new Set(["useState"]);
      for (const hook of hookUsages) {
        if (!allowedHooks.has(hook)) return false;
      }
    }
  }

  return true;
}

function stripCssImports(content: string): string {
  return content
    .replace(/import\s+['"][^'"]+\.css['"];?\n?/g, "")
    .replace(/import\s+\w+\s+from\s+['"][^'"]+\.css['"];?\n?/g, "");
}

function autoRepair(files: AIFile[]): AIFile[] {
  const forbiddenPattern = new RegExp(
    `^import\\s+.*?\\s+from\\s+['"](${FORBIDDEN_PACKAGES.join("|")})[^'"]*['"];?\\s*$`,
    "gm"
  );

  return files
    .filter((f) => {
      // Hard fail safety: discard any .css files entirely
      if (f.path.endsWith(".css")) {
        logWarn("[AI][REPAIR] Discarding .css file:", f.path);
        return false;
      }
      return true;
    })
    .map((f) => {
      let content = f.content;

      // Strip all CSS imports
      content = stripCssImports(content);

      content = content.replace(forbiddenPattern, "");
      content = content.replace(/import\s+\{[^}]+\}\s+from\s+['"][^'"]+['"]\s*;?\n?/g, "");

      if (f.path.endsWith(".jsx") && !/import\s+React\s+from\s+['"]react['"]/.test(content)) {
        content = `import React from 'react';\n${content}`;
      }

      if (f.path.endsWith(".jsx") && !/export\s+default\s/.test(content)) {
        const funcMatch = content.match(/^function\s+([A-Z][a-zA-Z0-9]*)\s*\(/m);
        if (funcMatch) {
          content = content.replace(
            /^(function\s+[A-Z][a-zA-Z0-9]*\s*\()/m,
            "export default $1"
          );
        } else {
          content += `\n\nexport default function Repaired() { return <div>Component</div>; }\n`;
        }
      }

      content = content.replace(/\n{3,}/g, "\n\n").trim();

      return { ...f, content };
    });
}

function buildSafeProject(): AIFile[] {
  return [
    {
      path: "src/App.jsx",
      content: `import React from 'react';

export default function App() {
  return (
    <div style={{ padding: "40px", textAlign: "center", fontFamily: "sans-serif" }}>
      <h1>App</h1>
      <p>Your project is ready. Describe what you want to build.</p>
    </div>
  );
}
`,
    },
    {
      path: "src/main.jsx",
      content: `import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
ReactDOM.createRoot(document.getElementById('root')).render(<App />);
`,
    },
  ];
}

function finalSanitize(files: AIFile[]): AIFile[] {
  const forbiddenPattern = new RegExp(
    `^import\\s+.*?\\s+from\\s+['"](${FORBIDDEN_PACKAGES.join("|")})[^'"]*['"];?\\s*$`,
    "gm"
  );

  return files
    .filter((f) => {
      // Hard fail safety: discard any .css files entirely
      if (f.path.endsWith(".css")) {
        logWarn("[AI][SANITIZE] Discarding .css file:", f.path);
        return false;
      }
      return true;
    })
    .map((f) => {
      let content = sanitizeContent(f.content);

      // Strip all CSS imports
      content = stripCssImports(content);

      content = content.replace(forbiddenPattern, "");

      if (f.path.endsWith(".jsx") && !/import\s+React\s+from\s+['"]react['"]/.test(content)) {
        content = `import React from 'react';\n${content}`;
      }

      if (f.path.endsWith(".jsx") && !/export\s+default\s/.test(content)) {
        content += `\n\nexport default function SafeComponent() { return <div>Component</div>; }\n`;
      }

      // Hard fail safety: if any CSS import survived, replace file with safe fallback content
      if (hasCssImport(content)) {
        logWarn("[AI][SANITIZE] CSS import survived sanitization in:", f.path, "— replacing with safe fallback");
        content = `import React from 'react';\n\nexport default function SafeComponent() {\n  return <div style={{ padding: '20px' }}>Component</div>;\n}\n`;
      }

      return { ...f, content };
    });
}

export async function generateCodeFromAI(
  input: string,
  options?: { fix?: boolean }
): Promise<AIFile[]> {
  const shouldFix = options?.fix ?? true;

  const result1 = await attemptGeneration(input, false);
  if (result1) {
    return finalSanitize(await applyFix(result1, shouldFix, input));
  }

  const result2 = await attemptGeneration(input, true);
  if (result2) {
    return finalSanitize(await applyFix(result2, shouldFix, input));
  }

  logError("[AI] FINAL FAILURE — fallback used");
  return finalSanitize(buildSafeProject());
}

async function attemptGeneration(
  input: string,
  isRetry: boolean
): Promise<AIFile[] | null> {
  try {
    const userContent = `Project Plan or Prompt:\n${input}\n\nGenerate the full project code now. Return only the JSON array. Remember: NO .css files, NO CSS imports — use inline styles only.${isRetry ? RETRY_SUFFIX : ""}`;

    const completion = await client.chat.completions.create({
      model: "moonshotai/kimi-k2-instruct",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userContent },
      ],
      temperature: isRetry ? 0.1 : 0.2,
      top_p: 0.9,
      max_tokens: 32768,
    });

    const rawText = completion.choices[0]?.message?.content ?? "";
    if (!rawText.trim()) return null;

    const cleaned = stripMarkdown(rawText);
    const jsonString = extractJsonArray(cleaned);
    if (!jsonString) return null;

    const parsed = repairAndParse(jsonString);
    if (!parsed || !Array.isArray(parsed) || parsed.length === 0) return null;

    const files: AIFile[] = [];
    const pathsSeen = new Set<string>();

    for (const item of parsed) {
      if (typeof item !== "object" || item === null) continue;

      const raw = item as RawAIFile;
      const filePath = sanitizePath(raw.path);
      if (!filePath) continue;

      // Hard fail safety: discard .css files at parse time
      if (filePath.endsWith(".css")) {
        logWarn("[AI][PARSE] Discarding .css file from AI output:", filePath);
        continue;
      }

      if (pathsSeen.has(filePath)) continue;
      pathsSeen.add(filePath);

      const content = sanitizeContent(raw.content);
      files.push({ path: filePath, content });
    }

    if (files.length === 0) return null;

    const repaired = autoRepair(files);

    if (!validateFilesStrict(repaired)) return null;

    return repaired;
  } catch {
    return null;
  }
}

async function applyFix(
  files: AIFile[],
  shouldFix: boolean,
  _input: string
): Promise<AIFile[]> {
  if (!shouldFix) return files;

  try {
    const fixResult = await fixWholeProjectWithRetry(
      files.map((f) => ({ path: f.path, content: f.content })),
      2
    );

    if (fixResult.ok) {
      const fixedMap = new Map(fixResult.files.map((f) => [f.path, f.content]));
      const merged = files.map((f) => ({
        ...f,
        content: fixedMap.get(f.path) ?? f.content,
      }));

      const repaired = autoRepair(merged);
      if (!validateFilesStrict(repaired)) return files;

      return repaired;
    }

    return files;
  } catch {
    return files;
  }
}

function stripMarkdown(text: string): string {
  return text
    .replace(/^```[a-zA-Z]*\s*/gm, "")
    .replace(/^```\s*$/gm, "")
    .trim();
}

function extractJsonArray(text: string): string | null {
  const start = text.indexOf("[");
  if (start === -1) return null;

  let depth = 0;
  let inString = false;
  let escapeNext = false;

  for (let i = start; i < text.length; i++) {
    const ch = text[i];

    if (escapeNext) { escapeNext = false; continue; }
    if (ch === "\\" && inString) { escapeNext = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;

    if (ch === "[") depth++;
    else if (ch === "]") {
      depth--;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }

  const last = text.lastIndexOf("]");
  if (last > start) return text.slice(start, last + 1);
  return null;
}

function repairAndParse(jsonString: string): unknown | null {
  try { return JSON.parse(jsonString); } catch (_) {}

  try {
    const fixed = jsonString.replace(/,\s*]/g, "]").replace(/,\s*}/g, "}");
    return JSON.parse(fixed);
  } catch (_) {}

  try {
    const fixed = jsonString
      .replace(/\r\n/g, "\\n")
      .replace(/\r/g, "\\n")
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
      .replace(/,\s*]/g, "]")
      .replace(/,\s*}/g, "}");
    return JSON.parse(fixed);
  } catch (_) {}

  try { return salvageFilesFromText(jsonString); } catch (_) {}

  return null;
}

function salvageFilesFromText(text: string): AIFile[] | null {
  const results: AIFile[] = [];
  const pattern = /\{\s*"path"\s*:\s*"([^"]+)"\s*,\s*"content"\s*:\s*"([\s\S]*?)"\s*\}/g;

  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text)) !== null) {
    const filePath = match[1].trim();

    // Hard fail safety: skip .css files during salvage
    if (filePath.endsWith(".css")) {
      logWarn("[AI][SALVAGE] Skipping .css file:", filePath);
      continue;
    }

    const content = match[2]
      .replace(/\\n/g, "\n")
      .replace(/\\t/g, "\t")
      .replace(/\\"/g, '"')
      .replace(/\\\\/g, "\\");
    if (filePath) results.push({ path: filePath, content });
  }

  return results.length > 0 ? results : null;
}

function sanitizePath(raw: unknown): string | null {
  if (typeof raw !== "string") return null;

  const p = raw
    .trim()
    .replace(/\\/g, "/")
    .replace(/^\/+/, "")
    .replace(/\.\.+\//g, "")
    .replace(/[<>:"|?*\x00-\x1F]/g, "");

  if (!p || !/\.\w+$/.test(p)) return null;

  // Reject .css paths at sanitization level
  if (p.endsWith(".css")) return null;

  return p;
}

function sanitizeContent(raw: unknown): string {
  if (raw === null || raw === undefined) return "";

  let content = typeof raw === "string" ? raw : String(raw);

  const MAX_FILE_CHARS = 60_000;
  if (content.length > MAX_FILE_CHARS) {
    const cutPoint = content.lastIndexOf("\n", MAX_FILE_CHARS);
    content = content.slice(0, cutPoint > 0 ? cutPoint : MAX_FILE_CHARS);
    if (!content.includes("export default")) {
      content += "\n\nexport default function Placeholder() { return <div>placeholder</div>; }\n";
    }
  }

  content = content
    .replace(/\\n/g, "\n")
    .replace(/\\t/g, "\t")
    .replace(/\\r/g, "")
    .replace(/\\"/g, '"')
    .replace(/\\\\/g, "\\");

  content = content
    .replace(/<\/buutton>/g, "</button>")
    .replace(/<\/buton>/g, "</button>")
    .replace(/<\/diiv>/g, "</div>")
    .replace(/<\/spann>/g, "</span>");

  content = content.replace(/^\s*n\s*$/gm, "");
  content = content.replace(/\n{3,}/g, "\n\n");

  // Strip all CSS imports
  content = stripCssImports(content);

  const forbiddenPattern = new RegExp(
    `^import\\s+.*?\\s+from\\s+['"](${FORBIDDEN_PACKAGES.join("|")})[^'"]*['"];?\\s*$`,
    "gm"
  );
  content = content.replace(forbiddenPattern, "");

  return content;
}

void logInfo;
void logWarn;