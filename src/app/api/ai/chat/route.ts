// src/app/api/ai/chat/route.ts

import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { streamProjectPipeline } from "@/lib/ai/stream/stream-pipeline";

type FileType = {
  path: string;
  content: string;
};

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
      data: {
        name: prompt.slice(0, 40),
        subAccountId,
      },
    });

    const encoder = new TextEncoder();

    // ✅ FIX 1: track closed state so parallel workers never enqueue after close
    let isClosed = false;

    const stream = new ReadableStream({
      async start(controller) {
        const send = (data: object) => {
          // ✅ Guard every enqueue — parallel workers race to write
          if (isClosed) return;
          try {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
          } catch {
            // swallow — controller may have closed between the check and enqueue
          }
        };

        const close = () => {
          if (isClosed) return;
          isClosed = true;
          try { controller.close(); } catch { /* already closed */ }
        };

        send({ type: "start" });
        send({ type: "project", projectId: project.id });

        try {
          await streamProjectPipeline({
            prompt,

            onFile: async (file: FileType) => {
              if (isClosed) return; // ✅ skip if already done

              // Save to DB (don't let DB errors crash the stream)
              try {
                await db.aIProjectFile.create({
                  data: {
                    projectId: project.id,
                    path: file.path,
                    content: file.content,
                  },
                });
              } catch (dbErr) {
                console.error(`❌ DB save failed for ${file.path}:`, dbErr);
              }

              send({ type: "file", file });
            },

            onDone: () => {
              send({ type: "done", projectId: project.id });
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