// src/app/api/ai/generate/route.ts
//
// PRODUCTION STREAMING ARCHITECTURE v2.0
//
// SSE EVENT PROTOCOL:
//   data: {"type":"project_init","projectId":"...","name":"..."}\n\n
//   data: {"type":"file","path":"...","content":"...","provisional":true}\n\n
//   data: {"type":"file","path":"...","content":"...","provisional":false}\n\n
//   data: {"type":"log","message":"..."}\n\n
//   data: {"type":"error","message":"..."}\n\n
//   data: {"type":"done","fileCount":12}\n\n
//   : keep-alive\n\n   ← heartbeat (SSE comment)

import { NextRequest } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { Role } from "@prisma/client";

import { getAuthUserDetails } from "@/queries/auth";
import { createAIProject, upsertAIProjectFiles } from "@/queries/ai-projects";
import { streamProjectPipeline } from "@/lib/ai/stream/stream-pipeline";
import { AIFileNode } from "@/lib/ai/types/ai-project.types";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  // ───────────── AUTH ─────────────
  const clerkUser = await currentUser();
  if (!clerkUser) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  // ───────────── BODY ─────────────
  let body: { subaccountId?: string; prompt?: string; name?: string };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { subaccountId, prompt, name } = body;

  if (!subaccountId || !prompt) {
    return new Response(
      JSON.stringify({ error: "Missing required fields: subaccountId, prompt" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  // ───────────── PERMISSIONS ─────────────
  const authUser = await getAuthUserDetails();
  if (!authUser?.agency) {
    return new Response(JSON.stringify({ error: "User not found" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const role = clerkUser.privateMetadata.role as Role | undefined;
  const isOwnerOrAdmin = role === Role.AGENCY_OWNER || role === Role.AGENCY_ADMIN;

  if (!isOwnerOrAdmin) {
    const hasPermission = authUser.permissions.find(
      (p) => p.access && p.subAccountId === subaccountId
    );
    if (!hasPermission) {
      return new Response(JSON.stringify({ error: "No access" }), {
        status: 403,
        headers: { "Content-Type": "application/json" },
      });
    }
  }

  // ───────────── SSE STREAM ─────────────
  const projectId = crypto.randomUUID();
  const allFiles: AIFileNode[] = [];

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();

      const send = (data: object) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        } catch {
          // client disconnected – ignore, pipeline will finish and save to DB anyway
        }
      };

      const ping = () => {
        try {
          controller.enqueue(encoder.encode(`: keep-alive\n\n`));
        } catch {}
      };

      const heartbeat = setInterval(ping, 8_000);

      try {
        // Create the DB project record first
        const dbProject = await createAIProject(
          subaccountId,
          name || prompt.slice(0, 50) || "AI Project",
          prompt
        );

        send({
          type: "project_init",
          projectId,
          dbProjectId: dbProject?.id ?? projectId,
          name: name || prompt.slice(0, 50),
        });

        // ── Run pipeline with all required callbacks ──
        await streamProjectPipeline(prompt, {
          onFile: async (file) => {
            const existing = allFiles.findIndex((f) => f.path === file.path);
            const node: AIFileNode = {
              path: file.path,
              content: file.content,
              type: "file",
            };
            if (existing >= 0) {
              allFiles[existing] = node;
            } else {
              allFiles.push(node);
            }

            send({
              type: "file",
              path: file.path,
              content: file.content,
              provisional: file.provisional ?? false,
              size: file.content.length,
            });
          },

          onLog: (message) => {
            send({ type: "log", message });
          },

          onError: (message) => {
            send({ type: "error", message });
          },

          onPing: ping,

          onDone: () => {
            // Called when pipeline finishes successfully
            console.log(`✅ Pipeline completed for project ${projectId}`);
          },
        });

        // ── Save ALL files to DB once generation is complete ──
        if (allFiles.length > 0) {
          try {
            await upsertAIProjectFiles(projectId, allFiles);
            console.log(`✅ Saved ${allFiles.length} files to DB for project ${projectId}`);
          } catch (dbErr) {
            console.error("⚠️ DB save failed:", dbErr);
          }
        }

        send({ type: "done", fileCount: allFiles.length, projectId });
      } catch (err) {
        const msg = (err as Error)?.message ?? "Generation failed";
        console.error("❌ [generate/stream] crash:", msg);
        send({ type: "error", message: msg });

        // Emit safe fallback files
        const fallback = makeFallbackFiles(prompt);
        for (const f of fallback) {
          send({
            type: "file",
            path: f.path,
            content: f.content,
            provisional: false,
          });
        }
        send({ type: "done", fileCount: fallback.length, projectId, fallback: true });
      } finally {
        clearInterval(heartbeat);
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "Transfer-Encoding": "chunked",
      "X-Accel-Buffering": "no",
    },
  });
}

// ─── Fallback files (same as before) ──────────────────────────────────────────
function makeFallbackFiles(prompt: string): AIFileNode[] {
  const label = prompt.slice(0, 40).replace(/'/g, "\\'");
  return [
    {
      path: "package.json",
      content: JSON.stringify(
        {
          name: "ai-app",
          private: true,
          version: "0.0.0",
          type: "module",
          scripts: { dev: "vite --host", build: "vite build" },
          dependencies: { react: "^18.2.0", "react-dom": "^18.2.0" },
          devDependencies: { vite: "^5.2.6", "@vitejs/plugin-react": "^4.2.1" },
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
  <head><meta charset="UTF-8"/><title>AI App</title></head>
  <body><div id="root"></div><script type="module" src="/src/main.jsx"></script></body>
</html>`,
      type: "file",
    },
    {
      path: "vite.config.js",
      content: `import { defineConfig } from 'vite';\nimport react from '@vitejs/plugin-react';\nexport default defineConfig({ plugins: [react()], server: { host: true } });`,
      type: "file",
    },
    {
      path: "src/main.jsx",
      content: `import React from 'react';\nimport ReactDOM from 'react-dom/client';\nimport App from './App.jsx';\nReactDOM.createRoot(document.getElementById('root')).render(<React.StrictMode><App /></React.StrictMode>);`,
      type: "file",
    },
    {
      path: "src/App.jsx",
      content: `import React from 'react';\nexport default function App() { return <div style={{padding:'2rem',fontFamily:'sans-serif'}}><h1>${label}</h1><p style={{color:'#888'}}>Generation failed — please try again.</p></div>; }`,
      type: "file",
    },
    {
      path: "src/App.css",
      content: "* { box-sizing: border-box; }\nbody { margin: 0; }",
      type: "file",
    },
  ];
}