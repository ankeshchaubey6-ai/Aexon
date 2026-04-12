// src/app/api/ai/chat/route.ts

import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { streamProjectPipeline } from "@/lib/ai/stream/stream-pipeline";
import type { StreamFile } from "@/lib/ai/stream/stream-pipeline";

const GENERATION_TIMEOUT_MS = 30 * 60 * 1000;
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

    // ── Wake DB ──────────────────────────────────────────
    try {
      await db.$queryRaw`SELECT 1`;
    } catch {
      await new Promise((r) => setTimeout(r, 35_000));
      await db.$queryRaw`SELECT 1`;
    }

    // ── Project handling ─────────────────────────────────
    let project: { id: string };

    if (existingProjectId) {
      const found = await db.aIProject.findFirst({
        where: { id: existingProjectId, subAccountId },
        select: { id: true },
      });

      project = found
        ? found
        : await db.aIProject.create({
            data: { name: prompt.slice(0, 40), subAccountId },
            select: { id: true },
          });
    } else {
      project = await db.aIProject.create({
        data: { name: prompt.slice(0, 40), subAccountId },
        select: { id: true },
      });
    }

    // ── SSE STREAM ───────────────────────────────────────
    const encoder = new TextEncoder();
    let isClosed = false;

    const stream = new ReadableStream({
      async start(controller) {
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

        const ping = () => enqueueRaw(": ping\n\n");

        const close = () => {
          if (isClosed) return;
          isClosed = true;
          clearInterval(heartbeat);
          try { controller.close(); } catch {}
        };

        const heartbeat = setInterval(() => {
          if (isClosed) return clearInterval(heartbeat);
          ping();
        }, HEARTBEAT_INTERVAL_MS);

        send({ type: "start" });
        send({ type: "project", projectId: project.id });

        try {
          await Promise.race([
            streamProjectPipeline(prompt, {
              onFile: async (file: StreamFile) => {
                if (isClosed) return;

                // Prevent empty/corrupt writes
                if (!file.content || file.content.length < 10) {
                  return;
                }

                if (!(file as any).provisional) {
                  await db.aIProjectFile.upsert({
                    where: {
                      projectId_path: {
                        projectId: project.id,
                        path: file.path,
                      },
                    },
                    update: { content: file.content },
                    create: {
                      projectId: project.id,
                      path: file.path,
                      content: file.content,
                    },
                  });
                }

                send({
                  type: "file",
                  file: { path: file.path, content: file.content },
                });
              },

              onLog: (message: string) => {
                send({ type: "log", message });
              },

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

            new Promise<never>((_, reject) =>
              setTimeout(
                () =>
                  reject(
                    new Error(
                      `Generation timed out after ${GENERATION_TIMEOUT_MS / 1000}s`
                    )
                  ),
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
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        "Connection": "keep-alive",
        "Transfer-Encoding": "chunked",
        "X-Accel-Buffering": "no",
        "x-project-id": project.id,
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