// src/lib/ai/llm/generate-code.ts
// v18.0 — Thin wrapper over batch-generator.

import { generateAllFiles } from "@/lib/ai/engine/batch-generator";
import { DesignSystem } from "@/lib/ai/engine/design-system";
import { ProjectPlan } from "@/lib/ai/engine/project-planner-v2";

export type AIFile = {
  path: string;
  content: string;
};

export async function generateCodeFromAI(
  plan: ProjectPlan,
  designSystem: DesignSystem,
  onPing?: () => void
): Promise<AIFile[]> {
  const files = await generateAllFiles(plan, designSystem, onPing);
  return files.map((f) => ({
    path: f.path,
    content: f.content,
  }));
}