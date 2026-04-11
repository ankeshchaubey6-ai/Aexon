//==================== FILE: src/lib/ai/engine/ai-critic.ts ====================

import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.NVIDIA_API_KEY!,
  baseURL: "https://integrate.api.nvidia.com/v1",
});

const CRITIC_MODEL = "z-ai/glm-4.7";

// ── TYPES ────────────────────────────────────────────────────────────────────

export type CriticErrorType =
  | "IMPORT"
  | "PROP"
  | "UNDEFINED"
  | "GHOST_FILE"
  | "TYPO";

export type CriticError = {
  file: string;
  errorType: CriticErrorType;
  description: string;
  suggestedFix: string;
};

export type AIFile = { path: string; content: string };

// ── HELPERS ──────────────────────────────────────────────────────────────────

function extractExports(content: string): string[] {
  const names = new Set<string>();

  const patterns = [
    /export\s+default\s+(?:function|class)\s+(\w+)/g,
    /export\s+(?:const|function|class|let|var)\s+(\w+)/g,
    /export\s+default\s+(\w+)\s*;/g,
  ];

  for (const re of patterns) {
    let m;
    while ((m = re.exec(content)) !== null) {
      names.add(m[1]);
    }
  }

  return [...names];
}

function extractImports(content: string): Array<{ name: string; from: string }> {
  const imports: Array<{ name: string; from: string }> = [];

  const re =
    /import\s+(?:\{([^}]+)\}|(\w+))\s+from\s+['"]([^'"]+)['"]/g;

  let m;
  while ((m = re.exec(content)) !== null) {
    const source = m[3];

    if (m[1]) {
      m[1]
        .split(",")
        .map((s) => s.trim().split(" as ").pop()!.trim())
        .filter(Boolean)
        .forEach((name) => imports.push({ name, from: source }));
    }

    if (m[2]) {
      imports.push({ name: m[2], from: source });
    }
  }

  return imports;
}

// ── TYPO DETECTION ───────────────────────────────────────────────────────────

const KNOWN_TYPOS: Array<[RegExp, string]> = [
  [/frimmer-motion/, "framer-motion"],
  [/recat$/, "react"],
  [/lodahs/, "lodash"],
  [/react-ruter/, "react-router-dom"],
  [/zustad/, "zustand"],
  [/tanstak/, "@tanstack"],
  [/lucidereact/, "lucide-react"],
  [/frammer/, "framer-motion"],
];

function detectTypos(content: string): string[] {
  const errors: string[] = [];

  for (const [pattern, correct] of KNOWN_TYPOS) {
    if (pattern.test(content)) {
      errors.push(`Likely typo: use "${correct}"`);
    }
  }

  return errors;
}

// ── MAIN ─────────────────────────────────────────────────────────────────────

export async function runAICritic(files: AIFile[]): Promise<CriticError[]> {
  const allErrors: CriticError[] = [];

  if (!files || files.length === 0) return allErrors;

  // ── PASS 1: STATIC CHECKS ────────────────────────────────────────────────

  const allowedPaths = new Set(files.map((f) => f.path));
  const exportMap = new Map<string, string[]>();

  for (const f of files) {
    exportMap.set(f.path, extractExports(f.content));
  }

  const allExports = new Set<string>();
  for (const names of exportMap.values()) {
    names.forEach((n) => allExports.add(n));
  }

  for (const f of files) {
    if (!/\.(js|jsx)$/.test(f.path)) continue;

    const imports = extractImports(f.content);

    for (const { name, from } of imports) {
      if (!from.startsWith(".")) continue;

      const dir = f.path.split("/").slice(0, -1).join("/");
      const raw = from.replace(/^\.\//, "");

      const candidates = [
        `${dir}/${raw}`,
        `${dir}/${raw}.jsx`,
        `${dir}/${raw}.js`,
      ];

      const exists = candidates.some((c) => allowedPaths.has(c));

      if (!exists) {
        allErrors.push({
          file: f.path,
          errorType: "GHOST_FILE",
          description: `Import "${name}" from "${from}" not found`,
          suggestedFix: `Create file: ${candidates[0]}`,
        });
      }
    }

    // Typo detection
    for (const msg of detectTypos(f.content)) {
      allErrors.push({
        file: f.path,
        errorType: "TYPO",
        description: msg,
        suggestedFix: "Fix package name",
      });
    }
  }

  // ── PASS 2: AI ANALYSIS ────────────────────────────────────────────────

  const jsxFiles = files.filter(
    (f) => f.path.endsWith(".jsx") && f.content.length > 150
  );

  if (jsxFiles.length === 0) return allErrors;

  try {
    const fileIndex = jsxFiles.map((f) => ({
      path: f.path,
      exports: exportMap.get(f.path) ?? [],
      imports: extractImports(f.content).map((i) => i.name),
      snippet: f.content.slice(0, 1200),
    }));

    const response = await client.chat.completions.create({
      model: CRITIC_MODEL,
      temperature: 0,
      max_tokens: 1200,
      messages: [
        {
          role: "system",
          content: `Detect ONLY:
IMPORT — missing export
PROP — wrong props
UNDEFINED — component used but not defined

Return JSON only.`,
        },
        {
          role: "user",
          content: JSON.stringify(fileIndex),
        },
      ],
    });

    const raw = response.choices[0]?.message?.content ?? "[]";

    let parsed: CriticError[] = [];

    try {
      parsed = JSON.parse(raw.replace(/```json?|```/g, "").trim());
    } catch {
      console.warn("⚠️ critic JSON parse failed");
    }

    if (Array.isArray(parsed)) {
      allErrors.push(
        ...parsed.filter((e) => e.file && e.errorType && e.description)
      );
    }
  } catch (err) {
    console.warn(
      "⚠️ [critic] AI failed:",
      err instanceof Error ? err.message : err
    );
  }

  // ── FINAL LOG ────────────────────────────────────────────────────────────

  if (allErrors.length > 0) {
    console.log(
      `🔍 [critic] ${allErrors.length} error(s)`,
      allErrors.map((e) => `${e.file}:${e.errorType}`)
    );
  } else {
    console.log("✅ [critic] clean");
  }

  return allErrors;
}