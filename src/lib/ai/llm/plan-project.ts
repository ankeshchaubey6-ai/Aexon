// src/lib/ai/llm/plan-project.ts
// v18.0 — Thin wrapper that delegates to project-planner-v2.

import { DesignSystem } from "@/lib/ai/engine/design-system";
import { planProjectV2, ProjectPlan } from "@/lib/ai/engine/project-planner-v2";

export async function planProject(
  prompt: string,
  designSystem: DesignSystem,
  onPing?: () => void
): Promise<ProjectPlan | null> {
  return planProjectV2(prompt, designSystem, onPing);
}