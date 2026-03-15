// src/queries/ai-projects.ts
"use server";

import { AIProject } from "@/lib/ai/types/ai-project.types";

const inMemoryProjects = new Map<string, AIProject[]>();

export const getAIProjects = async (subaccountId: string) => {
  return inMemoryProjects.get(subaccountId) || [];
};

export const createAIProject = async (
  project: AIProject
) => {
  const existing =
    inMemoryProjects.get(project.subaccountId) || [];

  inMemoryProjects.set(project.subaccountId, [
    ...existing,
    project,
  ]);

  return project;
};

export const getAIProjectById = async (
  subaccountId: string,
  projectId: string
) => {
  const projects =
    inMemoryProjects.get(subaccountId) || [];

  return projects.find((p) => p.id === projectId) || null;
};