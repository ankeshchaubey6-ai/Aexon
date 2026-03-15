// src/lib/ai/engine/code-patcher.ts
import { AIFileNode } from "../types/ai-project.types";

export class CodePatcher {
  static patch(
    files: AIFileNode[],
    instructions: string
  ): AIFileNode[] {
    if (!files.length) return files;

    const updated = files.map((file) => {
      if (file.path === "app/page.tsx") {
        return {
          ...file,
          content: file.content.replace(
            "AI Generated App Ready 🚀",
            `Updated: ${instructions}`
          ),
        };
      }
      return file;
    });

    return updated;
  }
}