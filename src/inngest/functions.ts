import { inngest } from "./client";
import { planProject } from "@/lib/ai/llm/plan-project";
import { generateCodeFromAI } from "@/lib/ai/llm/generate-code";
import { db } from "@/lib/db";

type AIFile = {
  path: string;
  content: string;
};

type EventData = {
  prompt: string;
  projectId: string;
  subaccountId: string;
};

export const aiBuilderFunction = inngest.createFunction(
  { id: "ai-builder-run" },

  async ({ event, step }: any) => {
    if (event.name !== "ai/build") return;

    const { prompt, projectId } = event.data as EventData;

    // ✅ 1. Save user message
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

    // ✅ 2. Create assistant message
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

    // ✅ 3. Plan
    const plan = await step.run("plan-project", async () => {
      return planProject(prompt);
    });

    if (!plan) {
      await step.run("mark-failed", async () => {
        await db.aIMessage.update({
          where: { id: assistantMessageId },
          data: {
            content: "❌ Planning failed.",
            status: "ERROR",
          },
        });
      });
      return;
    }

    // ✅ 4. Generate files
    const generatedFiles: AIFile[] = await step.run(
      "generate-code",
      async () => {
        const results = await generateCodeFromAI(prompt);
        return results.map((f: AIFile) => ({
          path: f.path,
          content: f.content,
        }));
      }
    );

    // ✅ 5. Save files
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

    // ✅ 6. Update message
    await step.run("update-message", async () => {
      await db.aIMessage.update({
        where: { id: assistantMessageId },
        data: {
          content: `🚀 Done! Generated ${generatedFiles.length} files.`,
          status: "DONE",
        },
      });
    });

    return { projectId, files: generatedFiles.length };
  }
);