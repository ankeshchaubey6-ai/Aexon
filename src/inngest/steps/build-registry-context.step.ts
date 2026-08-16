/**
 * inngest/steps/build-registry-context.step.ts
 * 
 * Step 4: Build Registry Context
 * 
 * Input:
 *   - sitePlan with semantic categories needed
 * Output:
 *   - registryContext: Map of category → ComponentMeta[]
 *   - For use by resolve-components step
 * 
 * This is a preprocessing step: loads registry once and organizes by category
 * for fast lookup during scoring
 */


import { loadRegistry, getComponentsByCategory } from "@/lib/component-pool/registry";

import type { SitePlan } from "@/lib/types/site-plan";
import type { ComponentMeta } from "@/lib/component-pool/registry/types";

export interface BuildRegistryContextInput {
  projectId: string;
  sitePlan: SitePlan;
  onPing?: (msg: string) => void;
}

export interface BuildRegistryContextOutput {
  registryContext: Record<string, ComponentMeta[]>;
  componentCount: number;
  categoriesCovered: string[];
  categoriesMissing: string[];
}

/**
 * Build registry context for all sections in site plan
 * Groups components by semantic category for fast resolver lookups
 */
export async function buildRegistryContextStep(
  input: BuildRegistryContextInput
): Promise<BuildRegistryContextOutput> {
  const { projectId, sitePlan, onPing } = input;

  onPing?.("[Step 4] Building registry context...");

  try {
    // Load the registry
    const registry = loadRegistry();
    onPing?.(`[Step 4] Loaded registry with ${registry.components.length} components`);

    // Collect all unique categories needed
    const neededCategories = new Set<string>();

    for (const page of sitePlan.pages) {
      for (const section of page.sections) {
        neededCategories.add(section.intent.category);
      }
    }

    onPing?.(`[Step 4] Need categories: ${Array.from(neededCategories).join(", ")}`);

    // Build context map
    const registryContext: Record<string, ComponentMeta[]> = {};
    const categoriesCovered: string[] = [];
    const categoriesMissing: string[] = [];

    for (const category of neededCategories) {
      const components = getComponentsByCategory(category as any);

      if (components.length > 0) {
        registryContext[category] = components;
        categoriesCovered.push(`${category} (${components.length})`);
        onPing?.(`[Step 4] ${category}: ${components.length} candidates`);
      } else {
        categoriesMissing.push(category);
        onPing?.(`[Step 4] ⚠ No components for category: ${category}`);
      }
    }

    onPing?.(
      `[Step 4] ✓ Context ready: ${categoriesCovered.length} categories, ${categoriesMissing.length} missing`
    );

    return {
      registryContext,
      componentCount: registry.components.length,
      categoriesCovered,
      categoriesMissing,
    };
  } catch (err) {
    onPing?.(`[Step 4] ✗ Error: ${err instanceof Error ? err.message : "Unknown error"}`);
    throw err;
  }
}

/**
 * Inngest event definition
 */
export const buildRegistryContextEvent = inngest.createFunction(
  { id: "build-registry-context" },
  { event: "ai/build-registry-context" },
  async ({ event, logger, step }) => {
    logger.info("build-registry-context", { projectId: event.data.projectId });

    const result = await step.run("build-context", async () => {
      return buildRegistryContextStep(event.data);
    });

    return result;
  }
);
