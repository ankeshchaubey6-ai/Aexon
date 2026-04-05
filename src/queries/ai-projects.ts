"use server";

// src/queries/ai-projects.ts
//
// FIX: Was using `prisma` as a bare global (never imported).
// Now imports `db` from @/lib/db — which is the same PrismaClient instance
// exported as both `prisma` and `db` from src/lib/db.ts.

import { db } from "@/lib/db";

// ── GET ALL PROJECTS ──────────────────────────────────────────────────────────

export const getAIProjects = async (subaccountId: string) => {
  return db.aIProject.findMany({
    where: { subAccountId: subaccountId },
    orderBy: { updatedAt: "desc" },
  });
};

// ── CREATE PROJECT ────────────────────────────────────────────────────────────

export const createAIProject = async (
  subaccountId: string,
  name: string,
  description?: string
) => {
  return db.aIProject.create({
    data: {
      name,
      description: description ?? null,
      subAccountId: subaccountId,
    },
  });
};

// ── GET PROJECT BY ID (with files) ───────────────────────────────────────────

export const getAIProjectById = async (projectId: string) => {
  return db.aIProject.findUnique({
    where: { id: projectId },
    include: {
      files: {
        select: { path: true, content: true },
        orderBy: { path: "asc" },
      },
    },
  });
};

// ── UPDATE PROJECT ────────────────────────────────────────────────────────────

export const updateAIProject = async (
  projectId: string,
  data: { name?: string; description?: string }
) => {
  return db.aIProject.update({
    where: { id: projectId },
    data,
  });
};

// ── UPSERT PROJECT FILES ──────────────────────────────────────────────────────

export const upsertAIProjectFiles = async (
  projectId: string,
  files: { path: string; content: string }[]
) => {
  await db.$transaction(
    files.map((file) =>
      db.aIProjectFile.upsert({
        where: { projectId_path: { projectId, path: file.path } },
        update: { content: file.content },
        create: { projectId, path: file.path, content: file.content },
      })
    )
  );

  await db.aIProject.update({
    where: { id: projectId },
    data: { updatedAt: new Date() },
  });
};

// ── DELETE PROJECT ────────────────────────────────────────────────────────────

export const deleteAIProject = async (
  subaccountId: string,
  projectId: string
) => {
  const project = await db.aIProject.findUnique({
    where: { id: projectId },
    select: { id: true, subAccountId: true },
  });

  if (!project || project.subAccountId !== subaccountId) {
    return { error: "Project not found or access denied" };
  }

  await db.aIProject.delete({ where: { id: projectId } });
  return { success: true };
};