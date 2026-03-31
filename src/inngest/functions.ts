// src/inngest/functions.ts

import { inngest } from "./client";
import { planProject } from "@/lib/ai/llm/pipeline"; // ✅ FIXED: correct import
import { generateFilesInParallel } from "@/lib/ai/llm/deepseek-generator"; // ✅ FIXED: use actual generator
import { db } from "@/lib/db";

// =========================
// TYPES
// =========================
type AIFile = {
  path: string;
  content: string;
};

type EventData = {
  prompt: string;
  projectId: string;
  subaccountId: string;
};

// =========================
// INNGEST FUNCTION (FIXED)
// =========================
export const aiBuilderFunction = inngest.createFunction(
  { id: "ai-builder-run" },
  { event: "ai/build" }, // ✅ FIXED: was missing — this is why nothing triggered

  async ({ event, step }: any) => {
    const { prompt, projectId, subaccountId } = event.data as EventData;

    // ── Save user message ──────────────────────────────
    await step.run("save-user-message", async () => {
      await db.aIMessage.create({
        data: {
          projectId,
          role: "USER",
          content: prompt,
          status: "DONE",
        },
      });
    });

    // ── Create assistant placeholder ───────────────────
    const assistantMessageId = await step.run(
      "create-assistant-message",
      async () => {
        const msg = await db.aIMessage.create({
          data: {
            projectId,
            role: "ASSISTANT",
            content: "Building your app...",
            status: "PENDING",
          },
        });
        return msg.id;
      }
    );

    // ── Stage 1: Plan ──────────────────────────────────
    const plan = await step.run("plan-project", async () => {
      return planProject(prompt);
    });

    if (!plan) {
      await step.run("mark-failed", async () => {
        await db.aIMessage.update({
          where: { id: assistantMessageId },
          data: { content: "❌ Planning failed. Please try again.", status: "ERROR" },
        });
      });
      return { projectId, files: 0, error: "Planning failed" };
    }

    // ── Stage 2: Generate files in parallel ───────────
    const generatedFiles: AIFile[] = await step.run(
      "generate-code",
      async () => {
        const results = await generateFilesInParallel(plan);
        return results.map((f) => ({ path: f.path, content: f.content }));
      }
    );

    // ── Save files to DB ───────────────────────────────
    await step.run("save-files", async () => {
      if (!generatedFiles.length) return;

      await db.aIProjectFile.deleteMany({ where: { projectId } });

      await db.aIProjectFile.createMany({
        data: generatedFiles.map((f) => ({
          projectId,
          path: f.path,
          content: f.content,
        })),
      });
    });

    // ── Update assistant message ───────────────────────
    await step.run("update-message", async () => {
      await db.aIMessage.update({
        where: { id: assistantMessageId },
        data: {
          content: `🚀 Done! Generated ${generatedFiles.length} files. Preview is ready.`,
          status: "DONE",
          filesGenerated: generatedFiles.length,
        },
      });
    });

    return { projectId, files: generatedFiles.length };
  }
);