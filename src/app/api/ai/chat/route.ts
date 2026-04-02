// src/app/api/ai/chat/route.ts
// Compatible with stream-pipeline.ts v3.2.
//
// provisional=true files (Stage 0 boilerplate + placeholder App.jsx):
//   → sent to client via SSE so WebContainer boots immediately
//   → NOT saved to DB (so DB reload never returns an incomplete project)
//
// provisional=false files (Stage 7 final batch):
//   → saved to DB via upsert
//   → sent to client via SSE

import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { streamProjectPipeline } from "@/lib/ai/stream/stream-pipeline";

type FileType = { path: string; content: string; provisional?: boolean };

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { prompt, subAccountId } = body;

    if (!prompt || !subAccountId) {
      return new Response(
        JSON.stringify({ error: "prompt and subAccountId are required" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const project = await db.aIProject.create({
      data: { name: prompt.slice(0, 40), subAccountId },
    });

    const encoder = new TextEncoder();
    let isClosed = false;

    const stream = new ReadableStream({
      async start(controller) {
        const send = (data: object) => {
          if (isClosed) return;
          try {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
          } catch {}
        };

        const close = () => {
          if (isClosed) return;
          isClosed = true;
          try { controller.close(); } catch {}
        };

        send({ type: "start" });
        send({ type: "project", projectId: project.id });

        try {
          await streamProjectPipeline({
            prompt,

            onFile: async (file: FileType) => {
              if (isClosed) return;

              // Skip DB write for provisional Stage 0 files.
              // Only persist final Stage 7 files so DB always has complete projects.
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
                  console.error(`❌ DB upsert failed for ${file.path}:`, dbErr);
                }
              }

              // Always send to client regardless of provisional status
              send({ type: "file", file: { path: file.path, content: file.content } });
            },

            onDone: () => {
              send({ type: "done", projectId: project.id });
              close();
            },

            onError: (msg) => {
              send({ type: "error", message: msg });
              close();
            },
          });
        } catch (err) {
          console.error("❌ [Chat Route] Pipeline error:", err);
          send({ type: "error", message: "Generation failed" });
          close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
        "x-project-id": project.id,
      },
    });
  } catch (err) {
    console.error("❌ [Chat Route] Request error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}