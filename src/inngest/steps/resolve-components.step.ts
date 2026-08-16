/**
 * inngest/steps/resolve-components.step.ts
 * 
 * Step 5: Resolve Components (Scoring + Tier Decision)
 * 
 * Input:
 *   - sitePlan with sections
 *   - registryContext (components organized by category)
 *   - sessionCache (cached resolutions from earlier sections)
 * Output:
 *   - resolvedSections[] (for each section, decision: POOL_MATCH | POOL_ADAPT | CUSTOM_GENERATE)
 *   - updated session cache
 * 
 * Algorithm:
 * 1. For each section in sitePlan:
 *    a. Check sessionCache for reusable resolution
 *    b. If cache miss:
 *       i. Get candidates from registryContext[section.intent.category]
 *       ii. Score candidates with scoreSection()
 *       iii. Decide tier with decideTier()
 *    c. Update cache
 * 2. Return all resolutions + updated cache
 * 
 * LLM generation happens downstream (in generate-* files)
 */


import { inngest } from "../client";
import { scoreSection } from "@/lib/resolver/score-section";
import { decideTier } from "@/lib/resolver/decide-tier";
import { lookupCacheHit, updateCacheWithResolution } from "@/lib/resolver/session-cache";
import { getComponentsByCategory } from "@/lib/component-pool/registry";
import { normalizeImportPath, validateComponentPath } from "@/lib/utils/path-utils";

import type { SitePlan, Section } from "@/lib/types/site-plan";
import type { ComponentMeta } from "@/lib/component-pool/registry/types";
import type { ResolvedSection, SerializedSessionCache } from "@/lib/resolver/types";

export interface ResolveComponentsData {
  projectId: string;
  sitePlan: SitePlan;
  sessionCache: SerializedSessionCache;
  llmThresholds?: {
    matchThreshold: number;
    adaptThreshold: number;
  };
  onPing?: (msg: string) => void;
}

export interface ResolveComponentsOutput {
  resolutions: ResolvedSection[];
  updatedCache: SerializedSessionCache;
  statistics: {
    totalSections: number;
    poolMatchCount: number;
    poolAdaptCount: number;
    customGenerateCount: number;
  };
}

/**
 * Resolve components for all sections in a site plan
 */
export async function resolveComponentsStep(data: ResolveComponentsData) {
  const { projectId, sitePlan, sessionCache, llmThresholds, onPing } = data;

  onPing?.("[Step 5] Resolving components...");

  try {
    const resolutions: ResolvedSection[] = [];
    let updatedCache = JSON.parse(JSON.stringify(sessionCache)) as SerializedSessionCache;

    let poolMatchCount = 0;
    let poolAdaptCount = 0;
    let customGenerateCount = 0;

    // Process each page and section
    for (const page of sitePlan.pages) {
      for (const section of page.sections) {
        // 1. Check cache first
        const cacheHit = lookupCacheHit(updatedCache, section);
        if (cacheHit) {
          onPing?.(`[Step 5] Cache hit: ${section.id} → ${cacheHit.component?.name || "custom"}`);
          resolutions.push(cacheHit);

          if (cacheHit.tier === "POOL_MATCH") poolMatchCount++;
          else if (cacheHit.tier === "POOL_ADAPT") poolAdaptCount++;
          else customGenerateCount++;

          continue;
        }

        // 2. Get candidates from registry
        const candidates = getComponentsByCategory(section.intent.category);
        if (candidates.length === 0) {
          onPing?.(`[Step 5] No pool candidates for ${section.id}, will custom generate`);
        } else {
          onPing?.(`[Step 5] Found ${candidates.length} candidates for ${section.intent.category}`);
        }

        // 3. Score candidates
        const scores = scoreSection(section, candidates);

        // 4. Decide tier
        const decision = decideTier(scores, section, llmThresholds);

        // 5. Create resolved section
        const poolComponentPath = decision.chosen
          ? `@/lib/component-pool/${decision.chosen.importPath}`
          : `@/_generated/${section.id}`;

        // Normalize and validate import path
        const normalizedPath = normalizeImportPath(poolComponentPath);
        const pathValidation = validateComponentPath(normalizedPath);

        if (!pathValidation.valid) {
          onPing?.(
            `[Step 5] ⚠ Path validation warning for ${section.id}: ${pathValidation.errors.join("; ")}`
          );
        }

        const resolved: ResolvedSection = {
          sectionId: section.id,
          intent: section.intent,
          tier: decision.tier,
          component: decision.chosen,
          importPath: normalizedPath,
          isValid: false, // Will be set by validate-quality step
          validationErrors: [],
        };

        resolutions.push(resolved);
        updatedCache = updateCacheWithResolution(updatedCache, section, resolved);

        // Track counts
        if (decision.tier === "POOL_MATCH") poolMatchCount++;
        else if (decision.tier === "POOL_ADAPT") poolAdaptCount++;
        else customGenerateCount++;

        onPing?.(decision.rationale);
      }
    }

    onPing?.(
      `[Step 5] ✓ Resolution complete: ${poolMatchCount} POOL_MATCH, ${poolAdaptCount} POOL_ADAPT, ${customGenerateCount} CUSTOM_GENERATE`
    );

    return {
      resolutions,
      updatedCache,
      statistics: {
        totalSections: resolutions.length,
        poolMatchCount,
        poolAdaptCount,
        customGenerateCount,
      },
    } as ResolveComponentsOutput;
  } catch (err) {
    onPing?.(`[Step 5] ✗ Error: ${err instanceof Error ? err.message : "Unknown error"}`);
    throw err;
  }
}

/**
 * Inngest event definition
 */
export const resolveComponentsEvent = inngest.createFunction(
  { id: "resolve-components", triggers: [{ event: "ai/resolve-components" }] },
  async ({ event, logger, step }) => {
    logger.info("resolve-components", { projectId: event.data.projectId });

    const result = await step.run("resolve", async () => {
      return resolveComponentsStep(event.data as ResolveComponentsData);
    });

    return result;
  }
);
