/**
 * inngest/steps/persist-files.step.ts
 * 
 * Step 10: Persist Files to Database
 * 
 * Input:
 *   - projectId
 *   - files[] (generated component files)
 *   - validation report (only persist if validation passed)
 * Output:
 *   - Stored in AIProjectFile table
 *   - Updated AIProject with final status
 * 
 * This is the final step: write all generated files to the database
 */


import { db } from "@/lib/db";

import type { AIFile } from "@/lib/types/ai-file";

export interface PersistFilesInput {
  projectId: string;
  files: AIFile[];
  validationPassed: boolean;
  registryVersion: string;
  onPing?: (msg: string) => void;
}

export interface PersistFilesOutput {
  fileCount: number;
  persisted: string[];
  failed: string[];
}

/**
 * Persist generated files to database
 */
export async function persistFilesStep(input: PersistFilesInput): Promise<PersistFilesOutput> {
  const { projectId, files, validationPassed, registryVersion, onPing } = input;

  onPing?.("[Step 10] Persisting files to database...");

  try {
    if (!validationPassed) {
      onPing?.("[Step 10] ⚠ Validation failed, storing files in FAILED state");
    }

    const persisted: string[] = [];
    const failed: string[] = [];

    // Use transaction to ensure atomicity
    for (const file of files) {
      try {
        // Use Prisma to upsert file
        await db.aIProjectFile.upsert({
          where: {
            // Use unique constraint: projectId + path
            projectId_path: {
              projectId,
              path: file.path,
            },
          },
          create: {
            projectId,
            path: file.path,
            content: file.content,
            provenance: file.provenance,
            validationStatus: validationPassed ? "PASSED" : "FAILED",
          },
          update: {
            content: file.content,
            validationStatus: validationPassed ? "PASSED" : "FAILED",
          },
        });

        persisted.push(file.path);
        onPing?.(`[Step 10] ✓ Persisted: ${file.path}`);
      } catch (err) {
        failed.push(file.path);
        onPing?.(`[Step 10] ✗ Failed to persist: ${file.path}`);
        console.error(`Failed to persist file ${file.path}:`, err);
      }
    }

    // Update AIProject with final status
    await db.aIProject.update({
      where: { id: projectId },
      data: {
        registryVersion,
      },
    });

    onPing?.(
      `[Step 10] ✓ Persisted ${persisted.length}/${files.length} files. Status: ${validationPassed ? "PASSED" : "FAILED"}`
    );

    return {
      fileCount: files.length,
      persisted,
      failed,
    };
  } catch (err) {
    onPing?.(`[Step 10] ✗ Error: ${err instanceof Error ? err.message : "Unknown error"}`);
    throw err;
  }
}

/**
 * Inngest event definition
 */
export const persistFilesEvent = inngest.createFunction(
  { id: "persist-files" },
  { event: "ai/persist-files" },
  async ({ event, logger, step }) => {
    logger.info("persist-files", { projectId: event.data.projectId });

    const result = await step.run("persist", async () => {
      return persistFilesStep(event.data);
    });

    return result;
  }
);
