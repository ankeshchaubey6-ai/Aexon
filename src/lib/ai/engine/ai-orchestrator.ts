// src/lib/ai/engine/ai-orchestrator.ts
import { AIFileNode } from "../types/ai-project.types";
import { CodeGenerator } from "./code-generator";
import { CodePatcher } from "./code-patcher";

const inMemoryProjects = new Map<string, AIFileNode[]>();

export class AIOrchestrator {
  static createProject(
    projectId: string,
    prompt: string
  ): AIFileNode[] {
    const files = CodeGenerator.generate(projectId, prompt);
    inMemoryProjects.set(projectId, files);
    return files;
  }

  static editProject(
    projectId: string,
    instructions: string
  ): AIFileNode[] {
    const existing = inMemoryProjects.get(projectId) || [];
    const updated = CodePatcher.patch(
      existing,
      instructions
    );
    inMemoryProjects.set(projectId, updated);
    return updated;
  }

  static getProjectFiles(projectId: string): AIFileNode[] {
    return inMemoryProjects.get(projectId) || [];
  }
}