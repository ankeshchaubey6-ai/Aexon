"use server";

// src/queries/ai-projects.ts

import { db } from "@/lib/db";

// ── TYPES ─────────────────────────────────────────────────────────────────────

type ProjectUpdateInput = {
  name?: string;
  description?: string;
};

type ProjectFileInput = {
  path: string;
  content: string;
};

type DeleteResult =
  | { success: true }
  | { error: string };

// ── GET ALL PROJECTS ──────────────────────────────────────────────────────────

export const getAIProjects = async (subaccountId: string) => {
  if (!subaccountId) throw new Error("subaccountId is required");

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
  if (!subaccountId) throw new Error("subaccountId is required");
  if (!name) throw new Error("Project name is required");

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
  if (!projectId) throw new Error("projectId is required");

  const project = await db.aIProject.findUnique({
    where: { id: projectId },
    include: {
      files: {
        select: { path: true, content: true },
        orderBy: { path: "asc" },
      },
    },
  });

  if (!project) return null;

  return project;
};

// ── UPDATE PROJECT ────────────────────────────────────────────────────────────

export const updateAIProject = async (
  projectId: string,
  data: ProjectUpdateInput
) => {
  if (!projectId) throw new Error("projectId is required");

  return db.aIProject.update({
    where: { id: projectId },
    data,
  });
};

// ── UPSERT PROJECT FILES ──────────────────────────────────────────────────────

export const upsertAIProjectFiles = async (
  projectId: string,
  files: ProjectFileInput[]
) => {
  if (!projectId) throw new Error("projectId is required");
  if (!files || files.length === 0) return;

  await db.$transaction(
    files.map((file) =>
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

  await db.aIProject.update({
    where: { id: projectId },
    data: { updatedAt: new Date() },
  });
};

// ── DELETE PROJECT ────────────────────────────────────────────────────────────

export const deleteAIProject = async (
  subaccountId: string,
  projectId: string
): Promise<DeleteResult> => {
  if (!subaccountId || !projectId) {
    return { error: "Invalid request" };
  }

  const project = await db.aIProject.findUnique({
    where: { id: projectId },
    select: { id: true, subAccountId: true },
  });

  if (!project || project.subAccountId !== subaccountId) {
    return { error: "Project not found or access denied" };
  }

  await db.aIProject.delete({
    where: { id: projectId },
  });

  return { success: true };
};