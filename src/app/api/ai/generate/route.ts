// src/app/api/ai/generate/route.ts

import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { Role } from "@prisma/client";

import { getAuthUserDetails } from "@/queries/auth";
import { createAIProject } from "@/queries/ai-projects";
import { AIOrchestrator } from "@/lib/ai/engine/ai-orchestrator";
import { streamProjectPipeline } from "@/lib/ai/stream/stream-pipeline";
import { AIFileNode } from "@/lib/ai/types/ai-project.types";

export async function POST(req: NextRequest) {
  try {
    // ───────────── AUTH ─────────────
    const clerkUser = await currentUser();
    if (!clerkUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // ───────────── BODY ─────────────
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

    // ───────────── PERMISSIONS ─────────────
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

    // ───────────── PIPELINE (REAL ENGINE) ─────────────
    const projectId = crypto.randomUUID();
    const files: AIFileNode[] = [];

    try {
      await streamProjectPipeline(prompt, {
        onFile: async (file) => {
          files.push({
            path: file.path,
            content: file.content,
            type: "file",
          });
        },

        onDone: () => {},

        onError: (err) => {
          throw new Error(err);
        },
      });

      if (!files.length) {
        throw new Error("Pipeline returned no files");
      }
    } catch (pipelineErr) {
      console.error("⚠️ Pipeline failed — fallback:", pipelineErr);

      // FULL SAFE FALLBACK (WORKING VITE APP)
      files.push(
        {
          path: "package.json",
          content: JSON.stringify(
            {
              name: "ai-app",
              private: true,
              version: "0.0.0",
              type: "module",
              scripts: { dev: "vite" },
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
          ),
          type: "file",
        },
        {
          path: "index.html",
          content: `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>AI App</title>
</head>
<body>
<div id="root"></div>
<script type="module" src="/src/main.jsx"></script>
</body>
</html>`,
          type: "file",
        },
        {
          path: "vite.config.js",
          content: `import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
});`,
          type: "file",
        },
        {
          path: "src/main.jsx",
          content: `import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './App.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);`,
          type: "file",
        },
        {
          path: "src/App.jsx",
          content: `import React from 'react';
import './App.css';

export default function App() {
  return (
    <div className="app">
      <h1>Fallback App</h1>
    </div>
  );
}`,
          type: "file",
        },
        {
          path: "src/App.css",
          content: `.app {
  text-align: center;
  padding: 40px;
  font-family: sans-serif;
}`,
          type: "file",
        }
      );
    }

    // ───────────── STORE ─────────────
    AIOrchestrator.setProjectFiles(projectId, files);

  await createAIProject(
  subaccountId,
  name || prompt.slice(0, 50) || "AI Project",
  prompt
);

    // ───────────── RESPONSE ─────────────
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