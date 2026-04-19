// src/app/api/ai/generate/route.ts
//
// FIX: The original code used `crypto.randomUUID()` as `projectId` for both
// SSE events AND the DB upsert, but `dbProject.id` is the actual FK-anchored
// DB record. Files saved under the random UUID were orphaned — they had no
// parent AIProject row, so getAIProjectById returned 0 files on reload.
//
// Fix: remove the random `projectId` entirely. Use `dbProject.id` everywhere.

import { NextRequest } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { Role } from "@prisma/client";

import { getAuthUserDetails } from "@/queries/auth";
import { createAIProject, upsertAIProjectFiles } from "@/queries/ai-projects";
import { streamProjectPipeline } from "@/lib/ai/stream/stream-pipeline";
import { db } from "@/lib/db";
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

  // ───────────── CREATE DB PROJECT BEFORE STREAMING ─────────────
  // FIX: Create the DB record HERE, outside the stream, so we have the real
  // `dbProject.id` available to both the SSE events and the file upsert.
  // Previously a random UUID was created here and used for saves — that UUID
  // had no matching AIProject row, making all saved files unreachable.
  let dbProject: { id: string };
  try {
    dbProject = await createAIProject(
      subaccountId,
      name || prompt.slice(0, 50) || "AI Project",
      prompt
    );
  } catch (err) {
    console.error("[generate] Failed to create DB project:", err);
    return new Response(JSON.stringify({ error: "Failed to create project" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  // ───────────── SSE STREAM ─────────────
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
        // FIX: Emit the real DB project ID so the client URL and store use it.
        send({
          type: "project_init",
          projectId: dbProject.id,    // ← was a random UUID before
          dbProjectId: dbProject.id,
          name: name || prompt.slice(0, 50),
        });

        await streamProjectPipeline(prompt, {
          onFile: async (file) => {
            const safeFile = file;
            const existing = allFiles.findIndex((f) => f.path === safeFile.path);
            const node: AIFileNode = {
              path: safeFile.path,
              content: safeFile.content,
              type: "file",
            };
            if (existing >= 0) {
              allFiles[existing] = node;
            } else {
              allFiles.push(node);
            }

            send({
              type: "file",
              path: safeFile.path,
              content: safeFile.content,
              provisional: safeFile.provisional ?? false,
              size: safeFile.content.length,
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
            console.log(`✅ Pipeline completed for project ${dbProject.id}`);
          },
        });

        // ── LOG: Show all collected files before saving ──
        console.log(`[SAVE] Collected ${allFiles.length} files for project ${dbProject.id}:`);
        allFiles.forEach((f) => console.log(`  - ${f.path} (${f.content.length} bytes)`));

        // ── Warn on missing required boilerplate ──
        const REQUIRED_FILES = ["package.json", "index.html", "src/main.jsx", "src/App.jsx"];
        const missingRequired = REQUIRED_FILES.filter((r) => !allFiles.find((f) => f.path === r));
        if (missingRequired.length > 0) {
          console.warn(`⚠️ MISSING REQUIRED FILES: ${missingRequired.join(", ")}`);
        }

        // ── FIX: Save files under dbProject.id (the FK-anchored row) ──
        if (allFiles.length > 0) {
          try {
            await upsertAIProjectFiles(dbProject.id, allFiles);
            console.log(`✅ Saved ${allFiles.length} files to DB under project ${dbProject.id}`);

            const verify = await db.aIProjectFile.count({ where: { projectId: dbProject.id } });
            console.log(`   DB verification: ${verify} files (expected: ${allFiles.length})`);
            if (verify !== allFiles.length) {
              console.error(`   ❌ MISMATCH: saved ${allFiles.length}, DB shows ${verify}`);
            }
          } catch (dbErr) {
            console.error("⚠️ DB save failed:", dbErr);
          }
        } else {
          console.error("❌ NO FILES COLLECTED — nothing to save");
        }

        // FIX: Send the real dbProject.id in the done event so the client
        // store and URL both reflect the correct project ID.
        send({ type: "done", fileCount: allFiles.length, projectId: dbProject.id });

      } catch (err) {
        const msg = (err as Error)?.message ?? "Generation failed";
        console.error("❌ [generate/stream] crash:", msg);
        send({ type: "error", message: msg });

        const fallback = makeFallbackFiles(prompt);
        for (const f of fallback) {
          send({ type: "file", path: f.path, content: f.content, provisional: false });
        }

        // Save fallback files under the real project ID too
        try {
          await upsertAIProjectFiles(dbProject.id, fallback);
        } catch (dbErr) {
          console.error("⚠️ Fallback DB save failed:", dbErr);
        }

        send({ type: "done", fileCount: fallback.length, projectId: dbProject.id, fallback: true });
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
      // FIX: Expose the real project ID in the response header too
      "x-project-id": dbProject.id,
    },
  });
}

// ─── Fallback files (CSS-free, inline styles only) ────────────────────────────
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
          scripts: {
  dev: "node node_modules/vite/dist/node/cli.js --host"
},
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
      content: `import React from 'react';\nimport { createRoot } from 'react-dom/client';\nimport App from './App.jsx';\ncreateRoot(document.getElementById('root')).render(<React.StrictMode><App /></React.StrictMode>);`,
      type: "file",
    },
    {
      path: "src/App.jsx",
      content: `import React from 'react';\nexport default function App() { return <div style={{padding:'2rem',fontFamily:'sans-serif',color:'#111',background:'#fff'}}><h1 style={{marginBottom:'0.5rem'}}>${label}</h1><p style={{color:'#666'}}>Generation failed — please try again.</p></div>; }`,
      type: "file",
    },
  ];
}