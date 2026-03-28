import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.NVIDIA_API_KEY!,
  baseURL: "https://integrate.api.nvidia.com/v1",
});

// ─────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────
export type AIFile = {
  path: string;
  content: string;
};

type RawAIFile = {
  path?: unknown;
  content?: unknown;
  [key: string]: unknown;
};

// ─────────────────────────────────────────────
// SYSTEM PROMPT
// ─────────────────────────────────────────────
const SYSTEM_PROMPT = `
You are an expert React developer generating a production-quality Vite + React + Tailwind app.

## BASE TEMPLATE — ALREADY EXISTS (DO NOT RE-OUTPUT THESE)
The sandbox already has these files set up. Only output them if you need to CHANGE them:
- package.json (all common deps pre-installed — see below)
- vite.config.js (@ alias → src/)
- tailwind.config.js, postcss.config.js
- index.html (Inter font included)
- src/index.css (Tailwind directives + CSS variables + utility classes)
- src/main.jsx (BrowserRouter + QueryClientProvider + Toaster already wrapping App)

## PRE-INSTALLED PACKAGES (DO NOT install these — they are already in package.json)
react, react-dom, react-router-dom, clsx, lucide-react, axios, date-fns,
zustand, framer-motion, recharts, @tanstack/react-query,
react-hook-form, zod, @hookform/resolvers, react-hot-toast, react-icons

## PRE-BUILT COMPONENTS — import from "@/components/ui"
Button, Input, Textarea, Select, Card, Badge, Spinner, Modal,
Skeleton, Avatar, Divider, Alert, Table, Progress, Tooltip

Usage example:
import { Button, Card, Modal, Badge } from "@/components/ui";

## PRE-BUILT HOOKS — import from "@/hooks"
useLocalStorage, useToggle, useDebounce, useClickOutside,
useMediaQuery, useDarkMode, useFetch, useCounter, useForm, usePagination

## PRE-BUILT UTILITIES — import from "@/lib/utils"
cn, formatCurrency, formatDate, truncate, debounce, generateId,
capitalize, groupBy, deepClone, sleep, storage

## PRE-BUILT CSS CLASSES (use directly in className — already in src/index.css)
Buttons: btn btn-primary btn-secondary btn-outline btn-ghost btn-danger btn-lg btn-sm
Cards: card card-body card-hover
Forms: input label input-error
Badges: badge badge-primary badge-success badge-warning badge-danger badge-gray
Layout: container-app section
Animations: animate-fade-in animate-slide-up animate-slide-down animate-scale-in
Text: gradient-text

## WHAT TO OUTPUT
Only output YOUR app files. ALWAYS include src/App.jsx.
For extra packages not in the pre-installed list, output a modified package.json with ONLY the new additions.

## STRICT OUTPUT RULES
- Return ONLY a valid JSON array — nothing else
- No markdown fences, no explanation, no preamble, no trailing text
- No trailing commas anywhere in the JSON
- All strings must be properly escaped (use \\n for newlines inside JSON strings)
- Do NOT use actual newlines inside JSON string values — escape them as \\n
- Do NOT use unescaped double quotes inside string values — escape them as \\"
- Every object must have exactly two keys: "path" and "content"
- "path" must be a valid relative file path string (e.g. "src/App.jsx")
- "content" must be a string with the full file content

## QUALITY RULES
- All features FULLY FUNCTIONAL — no TODOs, no placeholders, no lorem ipsum
- Realistic data and real UI interactions
- Every page: navbar + main content + footer
- Use React Router (Routes/Route in App.jsx, Link/useNavigate in pages)
- Use @ alias: import from "@/components/ui" NOT "../../components/ui"
- Charts → recharts. Forms → react-hook-form + zod. State → zustand. Icons → lucide-react
- Beautiful, responsive, production-quality UI using Tailwind classes

OUTPUT FORMAT:
[
  { "path": "src/App.jsx", "content": "import { Routes, Route } from \\"react-router-dom\\"..." },
  { "path": "src/pages/Home.jsx", "content": "export default function Home() {..." }
]
`.trim();

// ─────────────────────────────────────────────
// MAIN EXPORT
// ─────────────────────────────────────────────
export async function generateCodeFromAI(input: string): Promise<AIFile[]> {
  console.log("🔥 Generating code with Kimi K2...");

  let rawText = "";

  try {
    const completion = await client.chat.completions.create({
      model: "moonshotai/kimi-k2-instruct",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: `Project Plan or Prompt:\n${input}\n\nGenerate the full project code now. Return only the JSON array.`,
        },
      ],
      temperature: 0.2,
      top_p: 0.9,
      max_tokens: 32768,
    });

    rawText = completion.choices[0]?.message?.content ?? "";

    if (!rawText.trim()) {
      console.error("❌ Empty response from model");
      return fallbackFile("Model returned an empty response.");
    }

    const cleaned = stripMarkdown(rawText);
    const jsonString = extractJsonArray(cleaned);

    if (!jsonString) {
      console.error("❌ No JSON array found in response");
      return fallbackFile("No JSON array detected in model response.");
    }

    const parsed = repairAndParse(jsonString);

    if (!parsed) {
      console.error("❌ JSON parse failed after repair attempts");
      return fallbackFile("JSON parsing failed. Model output may be malformed.");
    }

    if (!Array.isArray(parsed)) {
      return fallbackFile("Model returned JSON but it was not an array.");
    }

    if (parsed.length === 0) {
      return fallbackFile("Model returned an empty file list.");
    }

    const files: AIFile[] = [];
    const pathsSeen = new Set<string>();

    for (let i = 0; i < parsed.length; i++) {
      const item = parsed[i] as RawAIFile;

      if (typeof item !== "object" || item === null) continue;

      const filePath = sanitizePath(item.path);
      if (!filePath) continue;
      if (pathsSeen.has(filePath)) continue;
      pathsSeen.add(filePath);

      const content = sanitizeContent(item.content);
      files.push({ path: filePath, content });
    }

    if (files.length === 0) {
      return fallbackFile("All generated files failed validation.");
    }

    console.log(`✅ Generated ${files.length} file(s)`);
    return files;

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("❌ Fatal error during AI generation:", message);
    return fallbackFile(`AI request failed: ${message}`);
  }
}

// ─────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────

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
  // Strategy 1: as-is
  try { return JSON.parse(jsonString); } catch (_) {}

  // Strategy 2: remove trailing commas
  try {
    const fixed = jsonString.replace(/,\s*]/g, "]").replace(/,\s*}/g, "}");
    return JSON.parse(fixed);
  } catch (_) {}

  // Strategy 3: normalize line endings + strip control chars
  try {
    const fixed = jsonString
      .replace(/\r\n/g, "\\n")
      .replace(/\r/g, "\\n")
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
      .replace(/,\s*]/g, "]")
      .replace(/,\s*}/g, "}");
    return JSON.parse(fixed);
  } catch (_) {}

  // Strategy 4: regex salvage
  try { return salvageFilesFromText(jsonString); } catch (_) {}

  return null;
}

function salvageFilesFromText(text: string): AIFile[] | null {
  const results: AIFile[] = [];
  const pattern = /\{\s*"path"\s*:\s*"([^"]+)"\s*,\s*"content"\s*:\s*"([\s\S]*?)"\s*\}/g;

  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text)) !== null) {
    const filePath = match[1].trim();
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
  return p;
}

function sanitizeContent(raw: unknown): string {
  if (raw === null || raw === undefined) return "";

  let content = typeof raw === "string" ? raw : String(raw);

  content = content
    .replace(/\\n/g, "\n")
    .replace(/\\t/g, "\t")
    .replace(/\\r/g, "")
    .replace(/\\"/g, '"')
    .replace(/\\\\/g, "\\");

  // Fix common AI typos
  content = content
    .replace(/<\/buutton>/g, "</button>")
    .replace(/<\/buton>/g, "</button>")
    .replace(/<\/diiv>/g, "</div>")
    .replace(/<\/spann>/g, "</span>");

  // Strip lone 'n' lines (model artifact)
  content = content.replace(/^\s*n\s*$/gm, "");

  // Collapse 3+ blank lines to 2
  content = content.replace(/\n{3,}/g, "\n\n");

  return content;
}

// ─────────────────────────────────────────────
// FALLBACK
// ─────────────────────────────────────────────
function fallbackFile(errorMessage: string): AIFile[] {
  const escaped = errorMessage
    .slice(0, 3000)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  return [
    {
      path: "src/App.jsx",
      content: `import { Button, Card, Alert } from "@/components/ui";

export default function App() {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-8">
      <Card className="max-w-md w-full p-8 text-center space-y-4">
        <h1 className="text-2xl font-bold text-slate-900">⚠️ Generation Issue</h1>
        <Alert variant="warning">
          <p className="text-sm">${escaped}</p>
        </Alert>
        <p className="text-slate-500 text-sm">
          Try describing your app more specifically — include pages, features, and design style.
        </p>
        <Button onClick={() => window.location.reload()}>Try Again</Button>
      </Card>
    </div>
  );
}
`,
    },
  ];
}