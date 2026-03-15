// src/lib/ai/persistence/file-tree.service.ts
import { AIFileNode } from "../types/ai-project.types";

const fileStorage = new Map<string, AIFileNode[]>();

export class FileTreeService {
  static save(projectId: string, files: AIFileNode[]) {
    fileStorage.set(projectId, files);
  }

  static load(projectId: string): AIFileNode[] {
    return fileStorage.get(projectId) || [];
  }

  static update(
    projectId: string,
    files: AIFileNode[]
  ) {
    fileStorage.set(projectId, files);
  }

  static exists(projectId: string): boolean {
    return fileStorage.has(projectId);
  }
}