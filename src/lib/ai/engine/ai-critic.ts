//=================== FILE: src/lib/ai/engine/ai-critic.ts ====================

// src/lib/ai/engine/ai-critic.ts
// Stage 4 — AI critic using GLM-4.7 (fast, tool-calling, free endpoint)
// Checks generated files against a contract of known exports/paths.
// Returns structured errors — never touches the code itself.

import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.NVIDIA_API_KEY!,
  baseURL: "https://integrate.api.nvidia.com/v1",
});

const CRITIC_MODEL = "z-ai/glm-4.7";

// ── Types ────────────────────────────────────────────────────────────────────

export type CriticErrorType =
  | "IMPORT"      // imported name has no matching export anywhere
  | "PROP"        // component called with different props than it expects
  | "UNDEFINED"   // JSX uses a variable never declared/imported
  | "GHOST_FILE"  // import path references a file not in the project
  | "TYPO";       // obvious package name typo

export type CriticError = {
  file: string;
  errorType: CriticErrorType;
  description: string;
  suggestedFix: string;
};

export type AIFile = { path: string; content: string };

// ── Static helpers (no AI needed) ────────────────────────────────────────────

function extractExports(content: string): string[] {
  const names: string[] = [];
  const patterns = [
    /export\s+default\s+(?:function|class)\s+(\w+)/g,
    /export\s+(?:const|function|class|let|var)\s+(\w+)/g,
    /export\s+default\s+(\w+)\s*;/g,
  ];
  for (const re of patterns) {
    let m;
    while ((m = re.exec(content)) !== null) names.push(m[1]);
  }
  return [...new Set(names)];
}

function extractImports(content: string): Array<{ name: string; from: string }> {
  const imports: Array<{ name: string; from: string }> = [];
  const re = /import\s+(?:\{([^}]+)\}|(\w+))\s+from\s+['"]([^'"]+)['"]/g;
  let m;
  while ((m = re.exec(content)) !== null) {
    const source = m[3];
    if (m[1]) {
      m[1].split(",").map((s) => s.trim().split(" as ").pop()!.trim())
        .filter(Boolean).forEach((name) => imports.push({ name, from: source }));
    }
    if (m[2]) imports.push({ name: m[2], from: source });
  }
  return imports;
}

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
    if (pattern.test(content)) errors.push(`Likely typo: use "${correct}"`);
  }
  return errors;
}

// ── Main export ───────────────────────────────────────────────────────────────

export async function runAICritic(files: AIFile[]): Promise<CriticError[]> {
  const allErrors: CriticError[] = [];

  // ── Pass 1: deterministic checks (no AI cost) ──────────────────────────

  const allowedPaths = new Set(files.map((f) => f.path));
  const exportMap = new Map<string, string[]>(); // path → export names

  for (const f of files) {
    exportMap.set(f.path, extractExports(f.content));
  }

  // Build a flat set of all exported names across the whole project
  const allExports = new Set<string>();
  for (const names of exportMap.values()) names.forEach((n) => allExports.add(n));

  for (const f of files) {
    if (!/\.(js|jsx)$/.test(f.path)) continue;

    // Ghost file check
    const imports = extractImports(f.content);
    for (const { name, from } of imports) {
      if (!from.startsWith(".")) continue; // skip node_modules

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
          description: `Imports "${name}" from "${from}" — file not found in project`,
          suggestedFix: `Remove import or create file at ${candidates[0]}`,
        });
      }
    }

    // Typo check
    for (const msg of detectTypos(f.content)) {
      allErrors.push({ file: f.path, errorType: "TYPO", description: msg, suggestedFix: "Fix the package name" });
    }
  }

  // If we already found errors, skip the AI call for small projects
  // (AI critic is most valuable for prop/import mismatches which need semantic understanding)
  const jsxFiles = files.filter((f) => f.path.endsWith(".jsx") && f.content.length > 200);
  if (jsxFiles.length === 0) return allErrors;

  // ── Pass 2: AI semantic check ──────────────────────────────────────────

  try {
    const fileIndex = jsxFiles.map((f) => ({
      path: f.path,
      exports: exportMap.get(f.path) ?? [],
      imports: extractImports(f.content).map((i) => i.name),
      // Send a short slice to keep tokens low
      snippet: f.content.slice(0, 1500),
    }));

    const response = await client.chat.completions.create({
      model: CRITIC_MODEL,
      temperature: 0,
      max_tokens: 1500,
      messages: [
        {
          role: "system",
          content: `You are a React code reviewer. Analyze these files and find ONLY these error types:
IMPORT — imported name exists in no file's exports
PROP — component called with different props than its function signature expects
UNDEFINED — JSX uses a PascalCase component tag that is never imported or defined

Return ONLY a JSON array. No explanation. No markdown.
Format: [{"file":"path","errorType":"IMPORT","description":"...","suggestedFix":"..."}]
If no errors found: []`,
        },
        {
          role: "user",
          content: `Project file index:\n${JSON.stringify(fileIndex, null, 2)}`,
        },
      ],
    });

    const raw = response.choices[0]?.message?.content ?? "[]";
    const cleaned = raw.replace(/```json?|```/g, "").trim();
    const aiErrors: CriticError[] = JSON.parse(cleaned);

    if (Array.isArray(aiErrors)) {
      allErrors.push(...aiErrors.filter(
        (e) => e.file && e.errorType && e.description
      ));
    }
  } catch (err) {
    // AI critic failure is non-fatal — deterministic errors still get through
    console.warn("⚠️ [critic] AI pass failed (non-fatal):", err instanceof Error ? err.message : err);
  }

  if (allErrors.length > 0) {
    console.log(`🔍 [critic] Found ${allErrors.length} error(s):`, allErrors.map((e) => `${e.file}:${e.errorType}`));
  } else {
    console.log("✅ [critic] No errors found");
  }

  return allErrors;
}

