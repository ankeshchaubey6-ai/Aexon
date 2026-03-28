// src/app/api/ai/generate/route.ts
//
// POST /api/ai/generate
// Runs the full 5-stage pipeline and stores the result in the global store.
//
//  Stage 1 — kimi-k2-instruct    → JSON spec
//  Stage 2 — your code           → split into per-file tasks
//  Stage 3 — deepseek-v3.2       → parallel codegen (Promise.all)
//  Stage 4 — phi-3.5-mini        → syntax fix (only broken JSX)
//  Stage 5 — your code           → assemble + ensureBoilerplate
//

import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { Role } from "@prisma/client";

import { getAuthUserDetails } from "@/queries/auth";
import { createAIProject } from "@/queries/ai-projects";
import { AIOrchestrator } from "@/lib/ai/engine/ai-orchestrator";
import { generateProjectWithPipeline } from "@/lib/ai/llm/pipeline";
import { AIFileNode } from "@/lib/ai/types/ai-project.types";

export async function POST(req: NextRequest) {
  try {
    // ── Auth ────────────────────────────────────────────────────────────
    const clerkUser = await currentUser();
    if (!clerkUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // ── Body ─────────────────────────────────────────────────────────────
    const body = await req.json();
    const { subaccountId, prompt, name } = body as {
      subaccountId?: string;
      prompt?: string;
      name?: string;
    };

    if (!subaccountId || !prompt) {
      return NextResponse.json(
        { error: "Missing required fields: subaccountId, prompt" },
        { status: 400 }
      );
    }

    // ── Permission check ─────────────────────────────────────────────────
    const authUser = await getAuthUserDetails();
    if (!authUser || !authUser.agency) {
      return NextResponse.json({ error: "User not found" }, { status: 401 });
    }

    const role = clerkUser.privateMetadata.role as Role | undefined;
    const isOwnerOrAdmin =
      role === Role.AGENCY_OWNER || role === Role.AGENCY_ADMIN;

    if (!isOwnerOrAdmin) {
      const hasPermission = authUser.permissions.find(
        (p) => p.access && p.subAccountId === subaccountId
      );
      if (!hasPermission) {
        return NextResponse.json({ error: "No access" }, { status: 403 });
      }
    }

    // ── Pipeline — 5 stages ──────────────────────────────────────────────
    const projectId = crypto.randomUUID();
    let files: AIFileNode[] = [];

    try {
      files = await generateProjectWithPipeline(prompt);

      if (!Array.isArray(files) || files.length === 0) {
        throw new Error("Pipeline returned no files");
      }
    } catch (pipelineErr) {
      console.error("⚠️ Pipeline failed — using hard fallback:", pipelineErr);

      // Hard fallback: minimal runnable Vite+React app
      files = [
        {
          path: "package.json",
          content: JSON.stringify(
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
          type: "file",
        },
        {
          path: "index.html",
          content: `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"/><title>AI App</title></head><body><div id="root"></div><script type="module" src="/src/main.jsx"></script></body></html>`,
          type: "file",
        },
        {
          path: "src/main.jsx",
          content: `import React from 'react';\nimport ReactDOM from 'react-dom/client';\nimport App from './App';\nimport './App.css';\nReactDOM.createRoot(document.getElementById('root')).render(<React.StrictMode><App /></React.StrictMode>);`,
          type: "file",
        },
        {
          path: "vite.config.js",
          content: `import { defineConfig } from "vite";\nimport react from "@vitejs/plugin-react";\nexport default defineConfig({ plugins: [react()] });`,
          type: "file",
        },
        {
          path: "src/App.jsx",
          content: `import React from 'react';\nimport './App.css';\nexport default function App() { return <div className="app"><h1>Fallback App</h1></div>; }`,
          type: "file",
        },
        {
          path: "src/App.css",
          content: `.app { text-align: center; padding: 40px; font-family: sans-serif; }`,
          type: "file",
        },
      ];
    }

    // ── Store in global in-memory store ──────────────────────────────────
    AIOrchestrator.setProjectFiles(projectId, files);
    console.log(`✅ Project ${projectId} stored with ${files.length} files`);

    // ── Persist to DB / in-memory project store ───────────────────────────
    await createAIProject({
      id: projectId,
      name: name || prompt.slice(0, 50) || "AI Project",
      subaccountId,
      files,
      createdAt: new Date().toISOString(),
    });

    return NextResponse.json({
      success: true,
      projectId,
      files,
      fileCount: files.length,
    });
  } catch (err) {
    console.error("❌ /api/ai/generate error:", err);
    return NextResponse.json(
      { error: "Failed to generate project" },
      { status: 500 }
    );
  }
}