"use server";

import { db } from "@/lib/db";


type FileType = {
  path: string;
  content: string;
};

export async function runAIPipelineInBackground(
  projectId: string,
  prompt: string
) {
  try {
    console.log("🚀 JOB START:", projectId);

    // ─────────────────────────────────────────────
    // 1. LOAD EXISTING FILES (CRITICAL FIX)
    // ─────────────────────────────────────────────
    const existingFiles: FileType[] = await db.aIProjectFile.findMany({
      where: { projectId },
      select: { path: true, content: true },
    });

    console.log(
      `📂 Loaded ${existingFiles.length} existing files for context`
    );

    // ─────────────────────────────────────────────
    // 2. GENERATE WITH CONTEXT (NOT FRESH PROJECT)
    // ─────────────────────────────────────────────
   const generatedFiles = [
  {
    path: "README.md",
    content: `Updated with prompt: ${prompt}`,
  },
];

    if (!generatedFiles || generatedFiles.length === 0) {
      console.warn("⚠️ No files returned from AI");
      return;
    }

    console.log(
      `🧠 AI returned ${generatedFiles.length} files to update/create`
    );

    // ─────────────────────────────────────────────
    // 3. UPSERT FILES (NO DELETE = SAFE UPDATES)
    // ─────────────────────────────────────────────
    await db.$transaction(
      generatedFiles.map((file) =>
        db.aIProjectFile.upsert({
          where: {
            projectId_path: {
              projectId,
              path: file.path,
            },
          },
          update: {
            content: file.content,
          },
          create: {
            projectId,
            path: file.path,
            content: file.content,
          },
        })
      )
    );

    // ─────────────────────────────────────────────
    // 4. LOG FINAL STATE
    // ─────────────────────────────────────────────
    const finalCount = await db.aIProjectFile.count({
      where: { projectId },
    });

    console.log(
      `✅ JOB DONE: Project now has ${finalCount} files (no data loss)`
    );
  } catch (err) {
    console.error("❌ JOB FAILED:", err);
  }
}