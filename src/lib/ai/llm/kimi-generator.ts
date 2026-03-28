// src/lib/ai/llm/kimi-generator.ts
import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.NVIDIA_API_KEY!,
  baseURL: "https://integrate.api.nvidia.com/v1",
});

export async function generateWithKimi(input: string) {
  console.log("🚀 KIMI GENERATOR");
  console.log(
    `📝 Input: ${input.substring(0, 100)}${input.length > 100 ? "..." : ""}`
  );

  try {
    const completion = await client.chat.completions.create({
      model: "moonshotai/kimi-k2-instruct",

      messages: [
        {
          role: "system",
          content: `You are a senior React engineer. Generate a complete working Vite + React project.

CRITICAL OUTPUT RULES:
- Return ONLY a valid JSON array. Nothing else.
- Start your response with [ and end with ]
- No markdown. No backticks. No explanation. No text before or after the array.
- Every string value inside the JSON must have all special characters properly escaped.

ARRAY FORMAT:
[
  { "path": "package.json", "content": "..." },
  { "path": "index.html", "content": "..." },
  { "path": "src/main.jsx", "content": "..." },
  { "path": "src/App.jsx", "content": "..." },
  { "path": "src/App.css", "content": "..." }
]

REQUIRED FILES (must all be present):
- package.json
- index.html
- src/main.jsx
- src/App.jsx
- src/App.css
- vite.config.js

REACT RULES:
- Do NOT use react-router-dom
- Do NOT import libraries not in package.json
- Only use: react, react-dom
- App must run with: npm install && npm run dev
- Keep code simple and working — do not over-engineer`,
        },
        {
          role: "user",
          content: `Build a React app for: ${input}`,
        },
      ],

      temperature: 0.3,
      // 🔥 Raised from 5000 — a 6-file project needs ~8000-10000 tokens
      max_tokens: 12000,
    });

    let text = completion.choices[0]?.message?.content || "";

    if (!text) {
      console.error("❌ Empty response from AI");
      return createFallbackProject(input);
    }

    console.log(`📝 Raw response length: ${text.length}`);

    // Strip markdown fences
    let cleanedText = text
      .replace(/```json\s*/gi, "")
      .replace(/```javascript\s*/gi, "")
      .replace(/```js\s*/gi, "")
      .replace(/```\s*/g, "")
      .trim();

    // =========================
    // 🔥 SMART ARRAY EXTRACTION
    // Find the first [ and the matching closing ] by tracking bracket depth.
    // This is far more reliable than lastIndexOf("]") when there is trailing
    // text or nested arrays inside string values.
    // =========================
    const arrayStart = cleanedText.indexOf("[");
    if (arrayStart === -1) {
      console.error("❌ No JSON array found in response");
      return createFallbackProject(input);
    }

    const arrayText = extractBalancedArray(cleanedText, arrayStart);

    if (!arrayText) {
      console.error(
        "❌ Could not extract balanced JSON array — response likely truncated"
      );
      console.log(
        `📝 First 500 chars of response:\n${cleanedText.slice(0, 500)}`
      );
      // Attempt partial recovery before giving up
      const partial = attemptPartialRecovery(cleanedText, arrayStart);
      if (partial && partial.length > 0) {
        console.log(
          `✅ Partial recovery: salvaged ${partial.length} file(s)`
        );
        return finalise(partial, input);
      }
      return createFallbackProject(input);
    }

    console.log(`📝 Extracted array length: ${arrayText.length}`);

    // =========================
    // 🔄 PARSE WITH RECOVERY
    // =========================
    let parsed: any[] = [];

    try {
      parsed = JSON.parse(arrayText);
      console.log("✅ Successfully parsed JSON");
    } catch {
      console.error("❌ JSON parse failed, trying recovery...");

      // Strategy 1: remove trailing commas
      try {
        parsed = JSON.parse(arrayText.replace(/,(\s*[}\]])/g, "$1"));
        console.log("✅ Recovery: removed trailing commas");
      } catch {
        // Strategy 2: close any unclosed string then close array
        try {
          const closed = closeUnclosedJSON(arrayText);
          parsed = JSON.parse(closed);
          console.log("✅ Recovery: closed unclosed JSON");
        } catch {
          // Strategy 3: extract individual file objects with regex
          const salvaged = salvageFileObjects(arrayText);
          if (salvaged.length > 0) {
            console.log(
              `✅ Recovery: salvaged ${salvaged.length} file object(s) via regex`
            );
            parsed = salvaged;
          } else {
            console.error("❌ All recovery strategies failed");
            return createFallbackProject(input);
          }
        }
      }
    }

    if (!Array.isArray(parsed)) {
      console.error("❌ Parsed result is not an array");
      return createFallbackProject(input);
    }

    const files = parsed.filter(
      (f) =>
        f &&
        typeof f === "object" &&
        typeof f.path === "string" &&
        typeof f.content === "string" &&
        f.path.trim().length > 0
    );

    if (files.length === 0) {
      console.error("❌ No valid files found in AI response");
      return createFallbackProject(input);
    }

    console.log(`✅ Found ${files.length} files from AI`);
    console.log("📁 Files:", files.map((f: any) => f.path).join(", "));

    return finalise(files, input);
  } catch (error) {
    console.error("❌ Kimi Generator Error:", error);
    return createFallbackProject(input);
  }
}

// =========================
// 🔧 EXTRACT BALANCED ARRAY
// Walks character-by-character tracking bracket/string depth.
// Returns the full balanced [...] substring, or null if truncated.
// =========================
function extractBalancedArray(text: string, startIndex: number): string | null {
  let depth = 0;
  let inString = false;
  let escape = false;

  for (let i = startIndex; i < text.length; i++) {
    const ch = text[i];

    if (escape) {
      escape = false;
      continue;
    }

    if (ch === "\\" && inString) {
      escape = true;
      continue;
    }

    if (ch === '"') {
      inString = !inString;
      continue;
    }

    if (inString) continue;

    if (ch === "[") depth++;
    else if (ch === "]") {
      depth--;
      if (depth === 0) {
        return text.slice(startIndex, i + 1);
      }
    }
  }

  // Reached end of string without closing — truncated response
  return null;
}

// =========================
// 🛠️ CLOSE UNCLOSED JSON
// Adds closing brackets/braces to handle token-truncated responses.
// =========================
function closeUnclosedJSON(text: string): string {
  let result = text.trimEnd();

  // Remove trailing partial token
  result = result.replace(/,\s*$/, "");
  result = result.replace(/"[^"]*$/, '"...');

  let objectDepth = 0;
  let arrayDepth = 0;
  let inString = false;
  let escape = false;

  for (const ch of result) {
    if (escape) { escape = false; continue; }
    if (ch === "\\" && inString) { escape = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (ch === "{") objectDepth++;
    else if (ch === "}") objectDepth--;
    else if (ch === "[") arrayDepth++;
    else if (ch === "]") arrayDepth--;
  }

  for (let i = 0; i < objectDepth; i++) result += "}";
  for (let i = 0; i < arrayDepth; i++) result += "]";

  return result;
}

// =========================
// 🧲 SALVAGE FILE OBJECTS
// Last-resort: extract individual {path, content} objects via regex.
// Works even when the outer array structure is broken.
// =========================
function salvageFileObjects(text: string): any[] {
  const results: any[] = [];
  const pattern =
    /\{\s*"path"\s*:\s*"([^"]+)"\s*,\s*"content"\s*:\s*"((?:[^"\\]|\\.)*)"\s*\}/g;
  let match;

  while ((match = pattern.exec(text)) !== null) {
    try {
      const obj = JSON.parse(match[0]);
      if (obj.path && typeof obj.content === "string") {
        results.push(obj);
      }
    } catch {
      // Individual object was malformed — skip it
    }
  }

  return results;
}

// =========================
// 🛡️ ATTEMPT PARTIAL RECOVERY
// =========================
function attemptPartialRecovery(text: string, arrayStart: number): any[] | null {
  const partial = text.slice(arrayStart);

  try {
    const closed = closeUnclosedJSON(partial);
    const parsed = JSON.parse(closed);
    if (Array.isArray(parsed) && parsed.length > 0) return parsed;
  } catch { /* continue */ }

  const salvaged = salvageFileObjects(partial);
  if (salvaged.length > 0) return salvaged;

  return null;
}

// =========================
// 🏁 FINALISE
// =========================
function finalise(files: any[], prompt: string): any[] {
  let result = files.map((file) => ({
    ...file,
    content: cleanFileContent(file.content, file.path),
  }));

  result = ensureRequiredFiles(result, prompt);

  const validation = validateProjectFiles(result);
  if (!validation.isValid) {
    console.warn("⚠️ Project validation issues:", validation.issues);
  } else {
    console.log("✅ Project validation passed");
  }

  console.log(`✅ Final project with ${result.length} files ready`);
  return result;
}

// =========================
// 🔥 DEDUPLICATE IMPORTS
// =========================
function deduplicateImports(content: string): string {
  const lines = content.split("\n");
  const importMap = new Map<string, Set<string>>();
  const defaultImportMap = new Map<string, string>();
  const otherLines: string[] = [];

  for (const line of lines) {
    const importMatch = line.match(
      /import\s+(?:(\w+)\s*,?\s*)?(?:\{([^}]+)\})?\s*from\s*['"]([^'"]+)['"]/
    );

    if (importMatch) {
      const defaultImport = importMatch[1]?.trim();
      const namedImports =
        importMatch[2]
          ?.split(",")
          .map((s) => s.trim())
          .filter((s) => s) || [];
      const source = importMatch[3];

      if (!importMap.has(source)) importMap.set(source, new Set());
      if (defaultImport) defaultImportMap.set(source, defaultImport);
      namedImports.forEach((n) => importMap.get(source)!.add(n));
    } else {
      otherLines.push(line);
    }
  }

  const uniqueImports: string[] = [];
  for (const [source, namedSet] of importMap) {
    const named = Array.from(namedSet);
    const def = defaultImportMap.get(source);
    if (def && named.length > 0) {
      uniqueImports.push(`import ${def}, { ${named.join(", ")} } from '${source}';`);
    } else if (def) {
      uniqueImports.push(`import ${def} from '${source}';`);
    } else if (named.length > 0) {
      uniqueImports.push(`import { ${named.join(", ")} } from '${source}';`);
    }
  }

  return [...uniqueImports, ...otherLines].join("\n");
}

// =========================
// 🧹 CLEAN FILE CONTENT
// =========================
function cleanFileContent(content: string, _path: string): string {
  let cleaned = content
    .replace(/^```jsx?\s*/gm, "")
    .replace(/^```javascript\s*/gm, "")
    .replace(/^```css\s*/gm, "")
    .replace(/^```html\s*/gm, "")
    .replace(/^```\s*$/gm, "")
    .trim();

  cleaned = deduplicateImports(cleaned);
  return cleaned;
}

// =========================
// 🛡️ SAFE JSX STRING
// =========================
function safeJSXString(str: string): string {
  return JSON.stringify(str);
}

// =========================
// 🔧 ENSURE REQUIRED FILES
// =========================
function ensureRequiredFiles(files: any[], prompt: string): any[] {
  const fileMap = new Map(files.map((f) => [f.path, f]));

  let projectName = "AI App";
  try {
    const parsed = JSON.parse(prompt);
    if (parsed?.projectName)
      projectName = String(parsed.projectName).slice(0, 50);
  } catch {
    projectName = prompt.slice(0, 50);
  }

  const displayPrompt = prompt.slice(0, 150);

  const ensureFile = (
    path: string,
    content: string,
    validate?: (c: string) => boolean
  ) => {
    const existing = fileMap.get(path);
    if (!existing) {
      fileMap.set(path, { path, content });
      console.log(`➕ Added missing file: ${path}`);
    } else if (validate && !validate(existing.content)) {
      console.log(`🔧 Fixed invalid file: ${path}`);
      fileMap.set(path, { path, content });
    }
  };

  ensureFile(
    "package.json",
    JSON.stringify(
      {
        name: "ai-app",
        private: true,
        version: "0.0.0",
        type: "module",
        scripts: { dev: "vite" },
        dependencies: { react: "^18.2.0", "react-dom": "^18.2.0" },
        devDependencies: {
          vite: "^5.0.0",
          "@vitejs/plugin-react": "^4.0.0",
        },
      },
      null,
      2
    ),
    (c) => { try { JSON.parse(c); return true; } catch { return false; } }
  );

  ensureFile(
    "index.html",
    `<!DOCTYPE html>
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
</html>`,
    (c) => c.includes('<div id="root"></div>')
  );

  ensureFile(
    "src/main.jsx",
    `import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './App.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);`,
    (c) => c.includes("ReactDOM.createRoot")
  );

  ensureFile(
    "src/App.jsx",
    `import React, { useState } from 'react';
import './App.css';

const APP_TITLE = ${safeJSXString(projectName)};
const APP_DESC = ${safeJSXString(displayPrompt)};

function App() {
  const [count, setCount] = useState(0);
  return (
    <div className="app">
      <h1>{APP_TITLE}</h1>
      <p>{APP_DESC}</p>
      <button onClick={() => setCount(count + 1)}>
        Clicked {count} times
      </button>
    </div>
  );
}

export default App;`,
    (c) => c.includes("export default")
  );

  ensureFile(
    "src/App.css",
    `* { margin: 0; padding: 0; box-sizing: border-box; }
body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  min-height: 100vh;
}
.app {
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px;
  text-align: center;
  color: white;
}
button {
  background: rgba(255,255,255,0.2);
  color: white;
  border: 2px solid white;
  padding: 12px 24px;
  font-size: 1rem;
  border-radius: 10px;
  cursor: pointer;
  margin-top: 20px;
}
button:hover { background: rgba(255,255,255,0.3); }`,
    (c) => c.trim().length > 0
  );

  if (!fileMap.has("vite.config.js")) {
    fileMap.set("vite.config.js", {
      path: "vite.config.js",
      content: `import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
export default defineConfig({ plugins: [react()] });`,
    });
    console.log(`➕ Added missing file: vite.config.js`);
  }

  return Array.from(fileMap.values());
}

// =========================
// ✅ VALIDATE PROJECT FILES
// =========================
function validateProjectFiles(files: any[]): {
  isValid: boolean;
  issues: string[];
} {
  const issues: string[] = [];
  const required = [
    "package.json",
    "index.html",
    "src/main.jsx",
    "src/App.jsx",
    "src/App.css",
  ];

  required.forEach((r) => {
    if (!files.some((f) => f.path === r)) issues.push(`Missing: ${r}`);
  });

  const pkg = files.find((f) => f.path === "package.json");
  if (pkg) {
    try { JSON.parse(pkg.content); } catch { issues.push("package.json invalid JSON"); }
  }

  const main = files.find((f) => f.path === "src/main.jsx");
  if (main && !main.content.includes("ReactDOM.createRoot"))
    issues.push("src/main.jsx missing ReactDOM.createRoot");

  const html = files.find((f) => f.path === "index.html");
  if (html && !html.content.includes('<div id="root"></div>'))
    issues.push("index.html missing root div");

  return { isValid: issues.length === 0, issues };
}

// =========================
// 🔄 FALLBACK PROJECT
// =========================
function createFallbackProject(prompt: string): any[] {
  console.log("🔄 Creating fallback project");

  let projectName = "AI App";
  try {
    const parsed = JSON.parse(prompt);
    if (parsed?.projectName)
      projectName = String(parsed.projectName).slice(0, 50);
  } catch {
    projectName = prompt.slice(0, 50);
  }

  const displayPrompt = prompt.slice(0, 150);

  return [
    {
      path: "package.json",
      content: JSON.stringify(
        {
          name: "ai-fallback-app",
          private: true,
          version: "0.0.0",
          type: "module",
          scripts: { dev: "vite" },
          dependencies: { react: "^18.2.0", "react-dom": "^18.2.0" },
          devDependencies: {
            vite: "^5.0.0",
            "@vitejs/plugin-react": "^4.0.0",
          },
        },
        null,
        2
      ),
    },
    {
      path: "index.html",
      content: `<!DOCTYPE html>
<html>
  <head><meta charset="UTF-8" /><title>${projectName}</title></head>
  <body><div id="root"></div><script type="module" src="/src/main.jsx"></script></body>
</html>`,
    },
    {
      path: "src/main.jsx",
      content: `import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './App.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode><App /></React.StrictMode>
);`,
    },
    {
      path: "src/App.jsx",
      content: `import React, { useState } from 'react';
import './App.css';

const APP_TITLE = ${safeJSXString(projectName)};
const APP_DESC = ${safeJSXString(displayPrompt)};

function App() {
  const [count, setCount] = useState(0);
  return (
    <div className="app">
      <h1>{APP_TITLE}</h1>
      <p>{APP_DESC}</p>
      <button onClick={() => setCount(count + 1)}>Clicked {count} times</button>
    </div>
  );
}

export default App;`,
    },
    {
      path: "src/App.css",
      content: `.app { text-align: center; padding: 40px; font-family: sans-serif; }
button { padding: 10px 20px; font-size: 16px; margin-top: 20px; cursor: pointer;
  background: #007bff; color: white; border: none; border-radius: 5px; }
button:hover { background: #0056b3; }`,
    },
    {
      path: "vite.config.js",
      content: `import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
export default defineConfig({ plugins: [react()] });`,
    },
  ];
}