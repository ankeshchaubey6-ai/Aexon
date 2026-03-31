import { db } from "@/lib/db";
import { generateProjectWithPipeline } from "@/lib/ai/llm/pipeline";

export async function runAIPipelineInBackground(
  projectId: string,
  prompt: string
) {
  try {
    console.log("🚀 JOB START:", projectId);

    const files = await generateProjectWithPipeline(prompt);

    // delete old files
    await db.aIProjectFile.deleteMany({
      where: { projectId },
    });

    // insert new files
    await db.aIProjectFile.createMany({
      data: files.map((f) => ({
        projectId,
        path: f.path,
        content: f.content,
      })),
    });

    console.log("✅ JOB DONE:", projectId);
  } catch (err) {
    console.error("❌ JOB FAILED:", err);
  }
}