// src/lib/ai/exporters/zip-exporter.ts
import { AIFileNode } from "../types/ai-project.types";
import path from "path";
import fs from "fs/promises";
import { SandboxManager } from "../preview/sandbox-manager";

export const ZipExporter = {
  async prepareProject(projectId: string, files: AIFileNode[]) {
    await SandboxManager.writeFiles(projectId, files);
    const projectPath = path.join(
      process.cwd(),
      "public",
      "sandbox",
      projectId
    );

    return {
      projectPath,
      zipName: `${projectId}.zip`,
    };
  },
};