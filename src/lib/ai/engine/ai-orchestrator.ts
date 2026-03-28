// src/lib/ai/engine/ai-orchestrator.ts

import {
  AIFileNode,
  AIProject,
  AIProjectPlan,
  AIProjectError,
} from "../types/ai-project.types";

import { CodeGenerator } from "./code-generator";
import { CodePatcher } from "./code-patcher";

// =========================
// 🔥 GLOBAL STORE (survives Next.js HMR reloads)
// =========================
const g = global as typeof global & {
  _aiFileStore?: Map<string, AIFileNode[]>;
  _aiMetaStore?: Map<string, AIProject>;
};

if (!g._aiFileStore) g._aiFileStore = new Map<string, AIFileNode[]>();
if (!g._aiMetaStore) g._aiMetaStore = new Map<string, AIProject>();

const inMemoryProjects = g._aiFileStore;
const projectMetadata = g._aiMetaStore;

export class AIOrchestrator {
  // =========================
  // 🚀 CREATE PROJECT (OPTIONAL USE)
  // =========================
  static createProject(
    projectId: string,
    prompt: string,
    plan?: AIProjectPlan
  ): AIFileNode[] {
    try {
      let files: AIFileNode[];

      if (plan) {
        files = CodeGenerator.generateFromPlan(projectId, plan);
      } else {
        files = CodeGenerator.generate(projectId, prompt);
      }

      inMemoryProjects.set(projectId, files);

      projectMetadata.set(projectId, {
        id: projectId,
        name: plan?.projectName || prompt.slice(0, 50),
        subaccountId: "",
        files,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      return files;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      throw new AIProjectError(
        `Failed to create project: ${message}`,
        "CREATE_FAILED",
        500
      );
    }
  }

  // =========================
  // 🔥 DIRECT SET (used by generate route)
  // =========================
  static setProjectFiles(projectId: string, files: AIFileNode[]) {
    if (!Array.isArray(files) || files.length === 0) {
      throw new AIProjectError(
        "Invalid files provided",
        "INVALID_FILES",
        400
      );
    }

    inMemoryProjects.set(projectId, files);

    projectMetadata.set(projectId, {
      id: projectId,
      name: "AI Project",
      subaccountId: "",
      files,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    console.log(`✅ Project ${projectId} stored with ${files.length} files`);
    console.log(`📦 Total projects in store: ${inMemoryProjects.size}`);
  }

  // =========================
  // ✏️ EDIT PROJECT
  // =========================
  static async editProject(
    projectId: string,
    instructions: string,
    useAI: boolean = false,
    aiClient?: any
  ): Promise<AIFileNode[]> {
    try {
      const existing = inMemoryProjects.get(projectId);

      if (!existing) {
        console.error(
          `❌ Project ${projectId} not found. Store has ${inMemoryProjects.size} projects:`,
          Array.from(inMemoryProjects.keys())
        );
        throw new AIProjectError(
          `Project ${projectId} not found`,
          "PROJECT_NOT_FOUND",
          404
        );
      }

      let updated: AIFileNode[];

      if (useAI && aiClient) {
        updated = await CodePatcher.patchWithAI(existing, instructions, aiClient);
      } else {
        updated = CodePatcher.patch(existing, instructions);
      }

      inMemoryProjects.set(projectId, updated);

      const metadata = projectMetadata.get(projectId);
      if (metadata) {
        metadata.updatedAt = new Date().toISOString();
        metadata.files = updated;
        projectMetadata.set(projectId, metadata);
      }

      return updated;
    } catch (error: unknown) {
      if (error instanceof AIProjectError) throw error;
      const message = error instanceof Error ? error.message : String(error);
      throw new AIProjectError(
        `Failed to edit project: ${message}`,
        "EDIT_FAILED",
        500
      );
    }
  }

  // =========================
  // 🔄 UPDATE FILES (SAFE MERGE)
  // =========================
  static updateProjectFiles(
    projectId: string,
    newFiles: AIFileNode[]
  ): AIFileNode[] {
    try {
      const existing = inMemoryProjects.get(projectId);

      if (!existing) {
        throw new AIProjectError(
          `Project ${projectId} not found`,
          "PROJECT_NOT_FOUND",
          404
        );
      }

      const fileMap = new Map<string, AIFileNode>();

      existing.forEach((f) => fileMap.set(f.path, f));
      newFiles.forEach((f) => {
        if (f.path && typeof f.content === "string") {
          fileMap.set(f.path, f);
        }
      });

      const updated = Array.from(fileMap.values());

      inMemoryProjects.set(projectId, updated);

      const metadata = projectMetadata.get(projectId);
      if (metadata) {
        metadata.updatedAt = new Date().toISOString();
        metadata.files = updated;
        projectMetadata.set(projectId, metadata);
      }

      console.log(`✅ Updated project ${projectId} with ${newFiles.length} new files`);
      return updated;
    } catch (error: unknown) {
      if (error instanceof AIProjectError) throw error;
      const message = error instanceof Error ? error.message : String(error);
      throw new AIProjectError(
        `Failed to update files: ${message}`,
        "UPDATE_FAILED",
        500
      );
    }
  }

  // =========================
  // 📂 GET FILES
  // =========================
  static getProjectFiles(projectId: string): AIFileNode[] {
    const files = inMemoryProjects.get(projectId);

    if (!files) {
      console.error(
        `❌ Project ${projectId} not found. Store has ${inMemoryProjects.size} projects:`,
        Array.from(inMemoryProjects.keys())
      );
      throw new AIProjectError(
        `Project ${projectId} not found`,
        "PROJECT_NOT_FOUND",
        404
      );
    }

    return files;
  }

  // =========================
  // 📊 METADATA
  // =========================
  static getProjectMetadata(projectId: string): AIProject | undefined {
    return projectMetadata.get(projectId);
  }

  static getAllProjects(): AIProject[] {
    return Array.from(projectMetadata.values());
  }

  // =========================
  // ❌ DELETE
  // =========================
  static deleteProject(projectId: string): boolean {
    const deleted = inMemoryProjects.delete(projectId);
    projectMetadata.delete(projectId);
    return deleted;
  }

  // =========================
  // ✅ VALIDATE
  // =========================
  static validateProject(files: AIFileNode[]): boolean {
    const validation = CodePatcher.validateFiles(files);

    if (!validation.isValid) {
      console.error("❌ Validation failed:", validation.errors);
      return false;
    }

    if (validation.warnings.length > 0) {
      console.warn("⚠️ Warnings:", validation.warnings);
    }

    return true;
  }

  // =========================
  // 📈 STATS
  // =========================
  static getProjectStats(projectId: string) {
    const files = this.getProjectFiles(projectId);

    const fileTypes: Record<string, number> = {};
    let totalSize = 0;

    files.forEach((file) => {
      const ext = file.path.split(".").pop() || "unknown";
      fileTypes[ext] = (fileTypes[ext] || 0) + 1;
      totalSize += new Blob([file.content]).size;
    });

    return {
      fileCount: files.length,
      totalSize,
      fileTypes,
    };
  }
}