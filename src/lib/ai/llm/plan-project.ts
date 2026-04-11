//==================== FILE: src/lib/ai/llm/plan-project.ts ====================

import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.NVIDIA_API_KEY!,
  baseURL: "https://integrate.api.nvidia.com/v1",
});

export async function planProject(prompt: string) {
  console.log("🧠 PLANNER RUNNING");

  try {
    const completion = await client.chat.completions.create({
      model: "moonshotai/kimi-k2-instruct",

      messages: [
        {
          role: "system",
          content: `
You are a world-class React system architect.

Return ONLY valid JSON. No markdown. No explanation.

SCHEMA:
{
  "projectName": "PascalCaseName",
  "description": "one sentence",
  "globalContext": "brief design explanation",
  "files": [
    {
      "path": "src/components/Hero.jsx",
      "description": "Hero section",
      "dependencies": [],
      "isAnimation": false
    }
  ]
}

RULES (STRICT):
- ONLY React + Vite (NO Next.js)
- ONLY inline styles (style={{}})
- NO CSS files
- NO Tailwind
- NO className styling
- NO external UI libraries
- NO framer-motion
- NO lucide-react
- NO react-router

ALWAYS include:
- src/App.jsx

FILE RULES:
- All paths MUST start with "src/"
- Use folders:
  - src/components/
  - src/sections/
  - src/layouts/

PLAN:
- 8–12 files minimum
- Modular structure
- Reusable components

Components must:
- Be functional components
- Export default
- Return JSX
`,
        },
        {
          role: "user",
          content: prompt,
        },
      ],

      temperature: 0.2,
      max_tokens: 2000,
    });

    let text = completion.choices[0]?.message?.content || "";

    text = text.replace(/```json/g, "").replace(/```/g, "").trim();

    const first = text.indexOf("{");
    const last = text.lastIndexOf("}");

    if (first !== -1 && last !== -1) {
      text = text.slice(first, last + 1);
    }

    const parsed = JSON.parse(text);

    // Validate required fields
    if (!parsed.files || !Array.isArray(parsed.files)) {
      console.warn("⚠️ Planner response missing files array");
      return null;
    }

    // Filter: keep only files with valid paths starting with "src/"
    parsed.files = parsed.files.filter(
      (f: any) => f.path && typeof f.path === "string" && f.path.startsWith("src/")
    );

    // Remove any CSS files
    parsed.files = parsed.files.filter(
      (f: any) => !f.path.endsWith(".css")
    );

    // Additional filter: require a valid description string
    parsed.files = parsed.files.filter((f: any) =>
      f.path &&
      typeof f.path === "string" &&
      f.path.startsWith("src/") &&
      f.description &&
      typeof f.description === "string"
    );

    // Enforce minimum file count
    if (parsed.files.length < 3) {
      console.warn(`⚠️ Planner generated only ${parsed.files.length} valid files (minimum 3 required)`);
      return null;
    }

    // Ensure App.jsx exists
    const hasApp = parsed.files.some((f: any) => f.path === "src/App.jsx");
    if (!hasApp) {
      parsed.files.push({
        path: "src/App.jsx",
        description: "Root component",
        dependencies: [],
        isAnimation: false,
      });
    }

    // Ensure projectName and description exist (fallback)
    if (!parsed.projectName) {
      parsed.projectName = "AIApp";
    }
    if (!parsed.description) {
      parsed.description = prompt.slice(0, 100);
    }
    if (!parsed.globalContext) {
      parsed.globalContext = "Modern React application with inline styles.";
    }

    return parsed;
  } catch (err) {
    console.error("❌ Planner failed:", err);
    return null;
  }
}