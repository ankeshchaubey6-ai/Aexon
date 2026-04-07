// src/app/api/ai/chat/route.ts
//
// v8.5 — Network suspension fix
//
// CHANGES from v8.4:
//   1. Heartbeat reduced from 15 s → 8 s (below Vercel's 10 s idle-connection kill)
//   2. onPing callback wired into streamProjectPipeline so the pipeline can emit
//      pings from INSIDE sleeps (rate-limiter waits, retry backoffs, fix-pass waits).
//      Previously, the setInterval could not fire while the event loop was blocked
//      on a long nvidia.chat.completions.create() call.
//   3. "Transfer-Encoding": "chunked" added — tells proxies this is a streaming
//      response and they must not buffer it.
//   4. Timeout increased to 1800 s (30 min) to match the user's request.
//      The pipeline's own per-call timeouts (180 s plan, 120 s file, 60 s fix)
//      are unchanged — the route timeout is only a dead-man's switch for
//      completely hung processes.

import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { streamProjectPipeline } from "@/lib/ai/stream/stream-pipeline";
import type { StreamFile } from "@/lib/ai/stream/stream-pipeline";

// 30 min hard deadline — only fires if the pipeline is completely hung
// (zero LLM responses for 30 min). Normal builds finish in 600-900 s.
const GENERATION_TIMEOUT_MS = 30 * 60 * 1000; // 1 800 000 ms

// Heartbeat MUST be < Vercel's idle connection timeout (10 s).
// 8 s gives a comfortable margin.
const HEARTBEAT_INTERVAL_MS = 8_000;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { prompt, subAccountId, projectId: existingProjectId } = body as {
      prompt?: string;
      subAccountId?: string;
      projectId?: string;
    };

    if (!prompt || !subAccountId) {
      return new Response(
        JSON.stringify({ error: "prompt and subAccountId are required" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // ── Wake TiDB Cloud free tier ──────────────────────────────────────────
    try {
      await db.$queryRaw`SELECT 1`;
    } catch {
      console.log("⏳ [DB] Cold start — waiting 35 s for TiDB wake-up");
      await new Promise((r) => setTimeout(r, 35_000));
      await db.$queryRaw`SELECT 1`;
    }

    // ── Resolve or create project record ──────────────────────────────────
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

    // ── SSE stream ─────────────────────────────────────────────────────────
    const encoder = new TextEncoder();
    let isClosed = false;

    const stream = new ReadableStream({
      async start(controller) {
        // ── Low-level enqueue helpers ────────────────────────────────────
        const enqueueRaw = (chunk: string) => {
          if (isClosed) return;
          try {
            controller.enqueue(encoder.encode(chunk));
          } catch {
            isClosed = true;
          }
        };

        const send = (data: object) => {
          enqueueRaw(`data: ${JSON.stringify(data)}\n\n`);
        };

        // Ping = SSE comment. Zero-cost for the client, keeps TCP alive.
        const ping = () => {
          enqueueRaw(": ping\n\n");
        };

        const close = () => {
          if (isClosed) return;
          isClosed = true;
          clearInterval(heartbeat);
          try { controller.close(); } catch { /* already closed */ }
        };

        // ── Route-level heartbeat (fires between event-loop ticks) ───────
        // This catches gaps that the pipeline's onPing can't cover — e.g.
        // while the NVIDIA SDK is awaiting a non-streaming HTTP response.
        const heartbeat = setInterval(() => {
          if (isClosed) { clearInterval(heartbeat); return; }
          ping();
        }, HEARTBEAT_INTERVAL_MS);

        send({ type: "start" });
        send({ type: "project", projectId: project.id });

        try {
          await Promise.race([
            streamProjectPipeline(prompt, {
              onFile: async (file: StreamFile) => {
                if (isClosed) return;

                // Only persist non-provisional (final) files to DB
                if (!file.provisional) {
                  try {
                    await db.aIProjectFile.upsert({
                      where: {
                        projectId_path: { projectId: project.id, path: file.path },
                      },
                      update: { content: file.content },
                      create: {
                        projectId: project.id,
                        path: file.path,
                        content: file.content,
                      },
                    });
                  } catch (dbErr) {
                    console.error(`❌ [DB] Upsert failed for ${file.path}:`, dbErr);
                  }
                }

                send({ type: "file", file: { path: file.path, content: file.content } });
              },

              onLog: (_msg: string) => {
                // send({ type: "log", message: _msg }); // uncomment to debug in client
              },

              // ── KEY FIX: pipeline calls this from inside sleeps ────────
              // sleepWithPing() in the pipeline breaks long rate-limiter
              // waits into PING_INTERVAL_MS chunks and calls onPing each time.
              // This guarantees bytes flow even during 60+ s waits with no LLM call.
              onPing: ping,

              onDone: () => {
                send({ type: "done", projectId: project.id });
                close();
              },

              onError: (msg: string) => {
                send({ type: "error", message: msg });
                close();
              },
            }),

            // Hard deadline — dead-man's switch only
            new Promise<never>((_, reject) =>
              setTimeout(
                () => reject(new Error(`Generation timed out after ${GENERATION_TIMEOUT_MS / 1000}s`)),
                GENERATION_TIMEOUT_MS
              )
            ),
          ]);
        } catch (err) {
          const msg = err instanceof Error ? err.message : "Generation failed";
          console.error("❌ [Route] Pipeline error:", msg);
          send({ type: "error", message: msg });
          close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type":       "text/event-stream",
        "Cache-Control":      "no-cache, no-transform",
        "Connection":         "keep-alive",
        // Tell proxies this is chunked — do NOT buffer until the response ends
        "Transfer-Encoding":  "chunked",
        // Disable nginx/Vercel edge response buffering
        "X-Accel-Buffering":  "no",
        "x-project-id":       project.id,
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