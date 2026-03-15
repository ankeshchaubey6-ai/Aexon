// src/lib/ai/preview/sandbox-manager.ts
import path from "path";
import fs from "fs/promises";
import { AIFileNode } from "../types/ai-project.types";

const SANDBOX_ROOT = path.join(process.cwd(), "public", "sandbox");

export const SandboxManager = {
  async ensureProjectDir(projectId: string) {
    const projectDir = path.join(SANDBOX_ROOT, projectId);
    await fs.mkdir(projectDir, { recursive: true });
    return projectDir;
  },

  async writeFiles(projectId: string, files: AIFileNode[]) {
    const projectDir = await this.ensureProjectDir(projectId);

    await Promise.all(
      files.map(async (file) => {
        if (file.type === "folder") return;

        const filePath = path.join(projectDir, file.path);
        const dir = path.dirname(filePath);

        await fs.mkdir(dir, { recursive: true });
        await fs.writeFile(filePath, file.content, "utf-8");
      })
    );

    return `/sandbox/${projectId}/index.html`;
  },

  async clearProject(projectId: string) {
    const projectDir = path.join(SANDBOX_ROOT, projectId);
    await fs.rm(projectDir, { recursive: true, force: true });
  },
};