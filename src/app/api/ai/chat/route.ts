//==================== FILE: src/app/api/ai/chat/route.ts ====================

// src/app/api/ai/chat/route.ts
//
// FIX — Duplicate project bug:
//   Before: /api/ai/chat always called db.aIProject.create() → two projects
//   After:  if `projectId` is supplied in the body, we REUSE that project
//           (update its name if needed, then upsert files into it).
//           Only when no projectId is given do we create a fresh record.
//
// FIX — Disconnection during generation:
//   Added `: keep-alive` SSE heartbeat every 15 s so proxies (Vercel, nginx,
//   Cloudflare) don't close the connection during long (~900 s) generations.
//   Also added X-Accel-Buffering: no to stop nginx buffering the stream.

import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { streamProjectPipeline } from "@/lib/ai/stream/stream-pipeline";
import type { StreamFile } from "@/lib/ai/stream/stream-pipeline";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { prompt, subAccountId, projectId: existingProjectId } = body as {
      prompt?: string;
      subAccountId?: string;
      projectId?: string; // passed by ChatPanel when a project already exists
    };

    if (!prompt || !subAccountId) {
      return new Response(
        JSON.stringify({ error: "prompt and subAccountId are required" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // ── Wake TiDB Cloud free tier ────────────────────────────────────────
    try {
      await db.$queryRaw`SELECT 1`;
    } catch {
      console.log("⏳ [DB] Cold start — waiting 35 s for TiDB wake-up");
      await new Promise((r) => setTimeout(r, 35_000));
      await db.$queryRaw`SELECT 1`;
    }

    // ── Resolve project record ───────────────────────────────────────────
    // If ChatPanel already has a projectId (created by CreateProjectModal),
    // reuse it — fixes the duplicate-history bug.
    // Otherwise create a fresh record (direct API calls / future flows).
    let project: { id: string };

    if (existingProjectId) {
      const found = await db.aIProject.findFirst({
        where: { id: existingProjectId, subAccountId },
        select: { id: true },
      });

      if (found) {
        project = found;
        console.log(`♻️  [Route] Reusing existing project ${project.id}`);
      } else {
        console.warn(`⚠️  [Route] projectId ${existingProjectId} not found — creating new`);
        project = await db.aIProject.create({
          data: { name: prompt.slice(0, 40), subAccountId },
          select: { id: true },
        });
      }
    } else {
      project = await db.aIProject.create({
        data: { name: prompt.slice(0, 40), subAccountId },
        select: { id: true },
      });
      console.log(`✨ [Route] Created new project ${project.id}`);
    }

    // ── SSE stream ───────────────────────────────────────────────────────
    const encoder = new TextEncoder();
    let isClosed = false;

    const stream = new ReadableStream({
      async start(controller) {
        const send = (data: object) => {
          if (isClosed) return;
          try {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
          } catch {
            isClosed = true;
          }
        };

        const close = () => {
          if (isClosed) return;
          isClosed = true;
          clearInterval(heartbeat);
          try { controller.close(); } catch { /* already closed */ }
        };

        // Keep-alive every 15 s — resets idle timer on every proxy.
        // SSE comment lines (": ...") are ignored by readers.
        const heartbeat = setInterval(() => {
          if (isClosed) { clearInterval(heartbeat); return; }
          try {
            controller.enqueue(encoder.encode(": keep-alive\n\n"));
          } catch {
            isClosed = true;
            clearInterval(heartbeat);
          }
        }, 15_000);

        send({ type: "start" });
        send({ type: "project", projectId: project.id });

        try {
          await streamProjectPipeline(prompt, {
            onFile: async (file: StreamFile) => {
              if (isClosed) return;

              if (!file.provisional) {
                try {
                  await db.aIProjectFile.upsert({
                    where: { projectId_path: { projectId: project.id, path: file.path } },
                    update: { content: file.content },
                    create: { projectId: project.id, path: file.path, content: file.content },
                  });
                } catch (dbErr) {
                  console.error(`❌ [DB] Upsert failed for ${file.path}:`, dbErr);
                }
              }

              send({ type: "file", file: { path: file.path, content: file.content } });
            },

            onLog: (_msg: string) => {
              // send({ type: "log", message: _msg }); // uncomment to debug
            },

            onDone: () => {
              send({ type: "done", projectId: project.id });
              close();
            },

            onError: (msg: string) => {
              send({ type: "error", message: msg });
              close();
            },
          });
        } catch (err) {
          console.error("❌ [Route] Pipeline error:", err);
          send({ type: "error", message: "Generation failed" });
          close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type":      "text/event-stream",
        "Cache-Control":     "no-cache, no-transform",
        "Connection":        "keep-alive",
        "X-Accel-Buffering": "no",
        "x-project-id":      project.id,
      },
    });

  } catch (err) {
    console.error("❌ [Route] Request error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}


