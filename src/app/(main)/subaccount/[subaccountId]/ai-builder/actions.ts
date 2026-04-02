"use server";

// src/app/(main)/subaccount/[subaccountId]/ai-builder/actions.ts
// ✅ FIXED: Exports createAIProject and deleteAIProject used by AIBuilderClient.tsx

import { currentUser } from "@clerk/nextjs/server";
import {
  createAIProject as dbCreate,
  deleteAIProject as dbDelete,
  getAIProjects,
} from "@/queries/ai-projects";

export { getAIProjects };

export async function createAIProject(subaccountId: string, name: string) {
  try {
    const user = await currentUser();
    if (!user) return { error: "Unauthorized" };

    const project = await dbCreate(subaccountId, name);
    return { project };
  } catch (err) {
    console.error("[createAIProject]", err);
    return { error: "Failed to create project" };
  }
}

export async function deleteAIProject(subaccountId: string, projectId: string) {
  try {
    const user = await currentUser();
    if (!user) return { error: "Unauthorized" };

    const result = await dbDelete(subaccountId, projectId);
    if ("error" in result) return { error: result.error };
    return { success: true };
  } catch (err) {
    console.error("[deleteAIProject]", err);
    return { error: "Failed to delete project" };
  }
}