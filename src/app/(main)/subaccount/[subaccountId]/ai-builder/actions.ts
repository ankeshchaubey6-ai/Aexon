"use server";

// src/app/(main)/subaccount/[subaccountId]/ai-builder/actions.ts

import { db } from "@/lib/db";
import { auth } from "@clerk/nextjs/server"; // ✅ no outbound fetch
import { revalidatePath } from "next/cache";

export async function createAIProject(
  subaccountId: string,
  name: string
): Promise<{ project: { id: string; name: string; description: string | null; createdAt: Date; updatedAt: Date } } | { error: string }> {
  try {
    const { userId } = auth();
    if (!userId) return { error: "Unauthorized." };
    if (!name?.trim()) return { error: "Project name is required." };

    const project = await db.aIProject.create({
      data: {
        name: name.trim(),
        description: "",
        subAccountId: subaccountId,
      },
      select: {
        id: true,
        name: true,
        description: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    revalidatePath(`/subaccount/${subaccountId}/ai-builder`);
    return { project };
  } catch (err) {
    console.error("[createAIProject action]", err);
    return { error: "Failed to create project. Check server logs." };
  }
}

export async function deleteAIProject(
  subaccountId: string,
  projectId: string
): Promise<{ success: true } | { error: string }> {
  try {
    const { userId } = auth();
    if (!userId) return { error: "Unauthorized." };

    await db.aIProject.delete({ where: { id: projectId } });
    revalidatePath(`/subaccount/${subaccountId}/ai-builder`);
    return { success: true };
  } catch (err) {
    console.error("[deleteAIProject action]", err);
    return { error: "Failed to delete project." };
  }
}