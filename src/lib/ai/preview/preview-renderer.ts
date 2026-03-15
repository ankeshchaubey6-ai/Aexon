// src/lib/ai/preview/preview-renderer.ts
import { AIFileNode } from "../types/ai-project.types";

export async function renderPreview(
  projectId: string,
  files: AIFileNode[]
): Promise<{ url: string; status: string }> {
  // Placeholder sandbox preview (production safe mock)
  // Later you can replace with WebContainer / Sandpack
  if (!files || files.length === 0) {
    return {
      url: "",
      status: "error",
    };
  }

  return {
    url: `/sandbox/${projectId}`,
    status: "ready",
  };
}