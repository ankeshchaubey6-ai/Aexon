import { inngest } from "./client";
import { planProject } from "@/lib/ai/llm/plan-project";
import { generateCodeFromAI } from "@/lib/ai/llm/generate-code";
import { loadBaseTemplate } from "@/lib/ai/template/load-template";
import { mergeFiles } from "@/lib/ai/engine/merge-files";
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
  isNewProject: boolean;
};

// =========================
// FUNCTION (FIXED)
// =========================
export const aiBuilderFunction = inngest.createFunction(
  { id: "ai-builder-run" }, // ✅ ONLY ONE CONFIG OBJECT

  async ({ event, step }: any) => {
    const { prompt, projectId, subaccountId, isNewProject } =
      event.data as EventData;

    // -------------------------
    // USER MESSAGE
    // -------------------------
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

    // -------------------------
    // ASSISTANT PLACEHOLDER
    // -------------------------
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

    // -------------------------
    // PLAN
    // -------------------------
    const plan = await step.run("plan-project", async () => {
      return planProject(prompt);
    });

    // -------------------------
    // AI GENERATE
    // -------------------------
    const aiFiles: AIFile[] = await step.run(
      "generate-code",
      async () => {
        const input = plan ? JSON.stringify(plan, null, 2) : prompt;
        return generateCodeFromAI(input);
      }
    );

    // -------------------------
    // LOAD TEMPLATE
    // -------------------------
    const baseFiles: AIFile[] = await step.run(
      "load-template",
      async () => {
        return loadBaseTemplate();
      }
    );

    // -------------------------
    // MERGE
    // -------------------------
    const finalFiles: AIFile[] = await step.run(
      "merge-files",
      async () => {
        return mergeFiles(baseFiles, aiFiles);
      }
    );

    // -------------------------
    // SAVE FILES
    // -------------------------
    await step.run("save-files", async () => {
      if (!finalFiles.length) return;

      await db.aIProjectFile.deleteMany({
        where: { projectId },
      });

      await db.aIProjectFile.createMany({
        data: finalFiles.map((f: AIFile) => ({
          projectId,
          path: f.path,
          content: f.content,
        })),
      });
    });

    // -------------------------
    // UPDATE MESSAGE
    // -------------------------
    await step.run("update-message", async () => {
      await db.aIMessage.update({
        where: { id: assistantMessageId },
        data: {
          content: "🚀 Project ready! Preview starting...",
          status: "DONE",
          filesGenerated: aiFiles.length,
        },
      });
    });

    return {
      projectId,
      files: finalFiles.length,
    };
  }
);