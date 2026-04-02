"use server";

// src/queries/ai-projects.ts
// ✅ FIXED: Uses correct `prisma` from @/lib/db (not @/lib/ai/db)

import { PrismaClient } from "@prisma/client";

// =========================
// 📦 GET ALL PROJECTS
// =========================
export const getAIProjects = async (subaccountId: string) => {
  return prisma.aIProject.findMany({
    where: { subAccountId: subaccountId },
    orderBy: { updatedAt: "desc" },
  });
};

// =========================
// ➕ CREATE PROJECT
// =========================
export const createAIProject = async (
  subaccountId: string,
  name: string,
  description?: string
) => {
  return prisma.aIProject.create({
    data: {
      name,
      description: description ?? null,
      subAccountId: subaccountId,
    },
  });
};

// =========================
// 🔍 GET PROJECT BY ID (with files)
// =========================
export const getAIProjectById = async (projectId: string) => {
  return prisma.aIProject.findUnique({
    where: { id: projectId },
    include: { files: true },
  });
};

// =========================
// ✏️ UPDATE PROJECT
// =========================
export const updateAIProject = async (
  projectId: string,
  data: { name?: string; description?: string }
) => {
  return prisma.aIProject.update({
    where: { id: projectId },
    data,
  });
};

// =========================
// 💾 UPSERT PROJECT FILES
// =========================
export const upsertAIProjectFiles = async (
  projectId: string,
  files: { path: string; content: string }[]
) => {
  await prisma.$transaction(
    files.map((file: { path: string; content: string }) =>
      prisma.aIProjectFile.upsert({
        where: { projectId_path: { projectId, path: file.path } },
        update: { content: file.content },
        create: { projectId, path: file.path, content: file.content },
      })
    )
  );

  await prisma.aIProject.update({
    where: { id: projectId },
    data: { updatedAt: new Date() },
  });
};

// =========================
// ❌ DELETE PROJECT
// =========================
export const deleteAIProject = async (
  subaccountId: string,
  projectId: string
) => {
  const project = await prisma.aIProject.findUnique({
    where: { id: projectId },
  });

  if (!project || project.subAccountId !== subaccountId) {
    return { error: "Project not found or access denied" };
  }

  await prisma.aIProject.delete({ where: { id: projectId } });
  return { success: true };
};