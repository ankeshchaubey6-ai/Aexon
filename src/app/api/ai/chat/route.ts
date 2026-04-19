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

    // Track all final (non-provisional) files for a single bulk upsert at done.
    // This avoids per-file DB round trips and ensures atomicity.
    const finalFiles = new Map<string, string>(); // path → content

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

                // FIX: Remove the `provisional` guard. The pipeline's smartEmitFile
                // deduplicates by content — if a file's content didn't change between
                // the provisional S2 emit and the final S4 emit, onFile is never called
                // with provisional=false. This means boilerplate files (package.json,
                // index.html, src/main.jsx) whose content is stable across stages were
                // never saved to DB. Saving on every onFile call is safe because:
                //   1. The pipeline controls emission (dedup map prevents redundant calls)
                //   2. We do a final bulk upsert at done anyway
                //   3. Provisional files will be overwritten if a final version arrives

                // Stream the file to client immediately
                send({
                  type: "file",
                  file: { path: file.path, content: file.content },
                });

                // Collect for bulk save — last write wins (correct behavior)
                finalFiles.set(file.path, file.content);
              },

              onLog: (message: string) => {
                send({ type: "log", message });
              },

              onPing: ping,

              onDone: async () => {
                // ── Bulk upsert ALL collected files at pipeline completion ──
                // This is the single source of truth for what gets persisted.
                const filesToSave = Array.from(finalFiles.entries()).map(
                  ([path, content]) => ({ path, content })
                );

                console.log(
                  `[chat/route] onDone — saving ${filesToSave.length} files to DB for project ${project.id}`
                );
                filesToSave.forEach((f) => console.log(`  - ${f.path}`));

                if (filesToSave.length > 0) {
                  try {
                    await db.$transaction(
                      filesToSave.map((file) =>
                        db.aIProjectFile.upsert({
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
                        })
                      )
                    );

                    // Verify
                    const count = await db.aIProjectFile.count({
                      where: { projectId: project.id },
                    });
                    console.log(
                      `[chat/route] ✅ Saved. DB now has ${count} files (expected: ${filesToSave.length})`
                    );
                    if (count !== filesToSave.length) {
                      console.warn(
                        `[chat/route] ⚠️ Mismatch: saved ${filesToSave.length}, DB shows ${count}`
                      );
                    }
                  } catch (dbErr) {
                    console.error("[chat/route] ❌ DB save failed:", dbErr);
                  }
                } else {
                  console.error("[chat/route] ❌ No files collected — nothing to save");
                }

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
          console.error("❌ [chat/route] Pipeline error:", msg);
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
    console.error("❌ [chat/route] Request error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}