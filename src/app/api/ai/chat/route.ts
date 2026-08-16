// src/app/api/ai/chat/route.ts

import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { streamProjectPipeline } from "@/lib/ai/stream/stream-pipeline";
import type { StreamFile } from "@/lib/ai/stream/stream-pipeline";

const GENERATION_TIMEOUT_MS = 30 * 60 * 1000;
const HEARTBEAT_INTERVAL_MS = 8_000;
const inFlightProjects = new Map<string, boolean>();

export async function POST(req: NextRequest) {
  let projectIdForLock: string | null = null;
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

    if (inFlightProjects.get(project.id)) {
      return new Response(
        JSON.stringify({ error: "Build already in progress for this project" }),
        { status: 409, headers: { "Content-Type": "application/json" } }
      );
    }

    inFlightProjects.set(project.id, true);
    projectIdForLock = project.id;

    // ── SSE STREAM ───────────────────────────────────────
    const encoder = new TextEncoder();
    let isClosed = false;
    let isDone = false;

    // Track all files (with provisional flag) for a single bulk upsert at done.
    // This avoids per-file DB round trips and ensures atomicity.
    // Smart deduplication: final emits (provisional=false) override provisional ones.
    const allFiles = new Map<string, StreamFile>();
    
    // Track pending onFile promises so onDone waits for all callbacks to settle
    const pendingOnFile: Promise<void>[] = [];

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

                // Track this async operation so onDone can wait for all onFile calls to complete
                const p = (async () => {
                  // Smart deduplication: prefer final (provisional=false) over provisional
                  const existing = allFiles.get(file.path);
                  const incomingIsFinal = file.provisional === false;
                  const existingIsFinal = existing?.provisional === false;
                  
                  // Only overwrite if: no existing, OR incoming is final, 
                  // OR existing is also provisional (last provisional wins)
                  if (!existing || incomingIsFinal || !existingIsFinal) {
                    allFiles.set(file.path, file);
                  }

                  // Stream the file to client immediately
                  send({
                    type: "file",
                    file: { path: file.path, content: file.content },
                  });
                })();
                
                pendingOnFile.push(p);
                // Do NOT await here — let it run concurrently
              },

              onLog: (message: string) => {
                send({ type: "log", message });
              },

              onPing: ping,

              onDone: async () => {
                if (isDone) {
                  console.warn('[chat/route] onDone called twice — ignoring duplicate');
                  return;
                }
                isDone = true;

                // ── Wait for all onFile callbacks to settle before saving ──
                // This ensures allFiles is complete before the bulk upsert
                await Promise.allSettled(pendingOnFile);

                // ── Bulk upsert ALL collected files at pipeline completion ──
                // This is the single source of truth for what gets persisted.
                const filesToSave = Array.from(allFiles.values()).map(
                  (file) => ({ path: file.path, content: file.content })
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
        } finally {
          if (projectIdForLock) inFlightProjects.delete(projectIdForLock);
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
    if (projectIdForLock) inFlightProjects.delete(projectIdForLock);
    console.error("❌ [chat/route] Request error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}