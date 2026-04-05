// src/lib/ai/engine/ai-orchestrator.ts

import type {
  AIFileNode,
  AIProject,
  AIProjectPlan,
} from "../types/ai-project.types";

import { AIProjectError } from "../types/ai-project.types";
import { CodeGenerator } from "./code-generator";
import { CodePatcher } from "./code-patcher";

// 🔥 GLOBAL STORE (safe for HMR)
const globalStore = globalThis as unknown as {
  _aiFileStore?: Map<string, AIFileNode[]>;
  _aiMetaStore?: Map<string, AIProject>;
};

if (!globalStore._aiFileStore) {
  globalStore._aiFileStore = new Map<string, AIFileNode[]>();
}

if (!globalStore._aiMetaStore) {
  globalStore._aiMetaStore = new Map<string, AIProject>();
}

const inMemoryProjects = globalStore._aiFileStore;
const projectMetadata = globalStore._aiMetaStore;

export class AIOrchestrator {
  // 🚀 CREATE PROJECT (fallback only)
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
      const message =
        error instanceof Error ? error.message : String(error);

      throw new AIProjectError(
        `Failed to create project: ${message}`,
        "CREATE_FAILED",
        500
      );
    }
  }

  // 🔥 MAIN ENTRY USED BY API
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

    console.log(`✅ Project ${projectId} stored (${files.length} files)`);
  }

  // ✏️ EDIT
  static async editProject(
    projectId: string,
    instructions: string,
    useAI: boolean = false,
    aiClient?: any
  ): Promise<AIFileNode[]> {
    try {
      const existing = inMemoryProjects.get(projectId);

      if (!existing) {
        throw new AIProjectError(
          `Project ${projectId} not found`,
          "PROJECT_NOT_FOUND",
          404
        );
      }

      let updated: AIFileNode[];

      if (useAI && aiClient) {
        updated = await CodePatcher.patchWithAI(
          existing,
          instructions,
          aiClient
        );
      } else {
        updated = CodePatcher.patch(existing, instructions);
      }

      inMemoryProjects.set(projectId, updated);

      const meta = projectMetadata.get(projectId);
      if (meta) {
        meta.updatedAt = new Date().toISOString();
        meta.files = updated;
        projectMetadata.set(projectId, meta);
      }

      return updated;
    } catch (error: unknown) {
      if (error instanceof AIProjectError) throw error;

      const message =
        error instanceof Error ? error.message : String(error);

      throw new AIProjectError(
        `Failed to edit project: ${message}`,
        "EDIT_FAILED",
        500
      );
    }
  }

  // 🔄 MERGE FILES
  static updateProjectFiles(
    projectId: string,
    newFiles: AIFileNode[]
  ): AIFileNode[] {
    const existing = inMemoryProjects.get(projectId);

    if (!existing) {
      throw new AIProjectError(
        `Project ${projectId} not found`,
        "PROJECT_NOT_FOUND",
        404
      );
    }

    const map = new Map<string, AIFileNode>();

    existing.forEach((f) => map.set(f.path, f));
    newFiles.forEach((f) => {
      if (f.path && typeof f.content === "string") {
        map.set(f.path, f);
      }
    });

    const updated = Array.from(map.values());

    inMemoryProjects.set(projectId, updated);

    const meta = projectMetadata.get(projectId);
    if (meta) {
      meta.updatedAt = new Date().toISOString();
      meta.files = updated;
      projectMetadata.set(projectId, meta);
    }

    return updated;
  }

  // 📂 GET FILES
  static getProjectFiles(projectId: string): AIFileNode[] {
    const files = inMemoryProjects.get(projectId);

    if (!files) {
      throw new AIProjectError(
        `Project ${projectId} not found`,
        "PROJECT_NOT_FOUND",
        404
      );
    }

    return files;
  }

  // 📊 META
  static getProjectMetadata(projectId: string): AIProject | undefined {
    return projectMetadata.get(projectId);
  }

  static getAllProjects(): AIProject[] {
    return Array.from(projectMetadata.values());
  }

  // ❌ DELETE
  static deleteProject(projectId: string): boolean {
    projectMetadata.delete(projectId);
    return inMemoryProjects.delete(projectId);
  }

  // 📈 STATS
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