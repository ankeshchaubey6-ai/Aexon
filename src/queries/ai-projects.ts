"use server";

// src/queries/ai-projects.ts

import { AIProject } from "@/lib/ai/types/ai-project.types";

// =========================
// 🔥 GLOBAL STORE (survives Next.js HMR reloads)
// =========================
const g = global as typeof global & {
  _aiProjectsBySubaccount?: Map<string, AIProject[]>;
};

if (!g._aiProjectsBySubaccount) {
  g._aiProjectsBySubaccount = new Map<string, AIProject[]>();
}

const inMemoryProjects = g._aiProjectsBySubaccount;

// =========================
// 📦 GET ALL PROJECTS
// =========================
export const getAIProjects = async (subaccountId: string) => {
  return inMemoryProjects.get(subaccountId) || [];
};

// =========================
// ➕ CREATE PROJECT
// =========================
export const createAIProject = async (project: AIProject) => {
  const existing = inMemoryProjects.get(project.subaccountId) || [];

  // Avoid duplicates — overwrite if same id already stored
  const withoutDuplicate = existing.filter((p) => p.id !== project.id);

  inMemoryProjects.set(project.subaccountId, [...withoutDuplicate, project]);

  console.log(
    `✅ Project ${project.id} stored under subaccount ${project.subaccountId}`
  );

  return project;
};

// =========================
// 🔍 GET PROJECT BY ID
// =========================
export const getAIProjectById = async (projectId: string) => {
  for (const [, projects] of inMemoryProjects.entries()) {
    const found = projects.find((p) => p.id === projectId);
    if (found) return found;
  }

  return null;
};

// =========================
// ✏️ UPDATE PROJECT
// =========================
export const updateAIProject = async (
  projectId: string,
  data: Partial<AIProject>
) => {
  for (const [subaccountId, projects] of inMemoryProjects.entries()) {
    const index = projects.findIndex((p) => p.id === projectId);

    if (index !== -1) {
      const updatedProject: AIProject = {
        ...projects[index],
        ...data,
      };

      const updatedProjects = [...projects];
      updatedProjects[index] = updatedProject;

      inMemoryProjects.set(subaccountId, updatedProjects);

      return updatedProject;
    }
  }

  return null;
};

// =========================
// ❌ DELETE PROJECT
// =========================
export const deleteAIProject = async (projectId: string) => {
  for (const [subaccountId, projects] of inMemoryProjects.entries()) {
    const index = projects.findIndex((p) => p.id === projectId);

    if (index !== -1) {
      const updated = projects.filter((p) => p.id !== projectId);
      inMemoryProjects.set(subaccountId, updated);
      console.log(`🗑️ Deleted project ${projectId}`);
      return true;
    }
  }

  return false;
};