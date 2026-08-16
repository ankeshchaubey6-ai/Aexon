/**
 * inngest/steps/resolve-design-tokens.step.ts
 * 
 * Step 3: Resolve Design Tokens
 * 
 * Input:
 *   - brand information from SitePlan (industry, mood, brandName)
 * Output:
 *   - Fully-resolved CSSVariableManifest with concrete token values
 *   - CSS string for injection into HTML
 * 
 * This step is deterministic (no LLM calls) and caches based on industry+mood combo
 */


import { resolveTokens } from "@/lib/design-system/resolve-tokens";
import { manifestToCss } from "@/lib/design-system/manifest-to-css";

import type { SitePlan } from "@/lib/types/site-plan";
import type { CSSVariableManifest } from "@/lib/design-system/types";

export interface ResolveDesignTokensInput {
  projectId: string;
  sitePlan: SitePlan;
  onPing?: (msg: string) => void;
}

export interface ResolveDesignTokensOutput {
  manifest: CSSVariableManifest;
  css: string;
  tokenCount: number;
  theme: string;
}

/**
 * Map industry to design system theme
 */
function getThemeForIndustry(industry: string, mood?: string): string {
  const industryMap: Record<string, string> = {
    saas: "saas",
    ecommerce: "ecommerce",
    portfolio: "portfolio",
    landing: "landing",
    agency: "saas",
    startup: "saas",
  };

  return industryMap[industry.toLowerCase()] || "landing";
}

/**
 * Resolve design tokens based on SitePlan
 */
export async function resolveDesignTokensStep(input: ResolveDesignTokensInput) {
  const { projectId, sitePlan, onPing } = input;

  onPing?.("[Step 3] Resolving design tokens...");

  try {
    // Select theme based on industry
    const theme = getThemeForIndustry(sitePlan.industry, sitePlan.mood);

    onPing?.(`[Step 3] Using theme: ${theme}`);

    // Resolve tokens with theme preset
    const manifest = resolveTokens({
      theme,
      overrides: {},
    });

    // Generate CSS string
    const css = manifestToCss(manifest);

    onPing?.(`[Step 3] ✓ Resolved ${Object.keys(manifest).length} token categories`);

    return {
      manifest,
      css,
      tokenCount: Object.values(manifest).reduce((sum, cat) => sum + Object.keys(cat).length, 0),
      theme,
    } as ResolveDesignTokensOutput;
  } catch (err) {
    onPing?.(`[Step 3] ✗ Error: ${err instanceof Error ? err.message : "Unknown error"}`);
    throw err;
  }
}

/**
 * Inngest event definition
 */
export const resolveDesignTokensEvent = inngest.createFunction(
  { id: "resolve-design-tokens" },
  { event: "ai/resolve-design-tokens" },
  async ({ event, logger, step }) => {
    logger.info("resolve-design-tokens", { projectId: event.data.projectId });

    const result = await step.run("resolve-tokens", async () => {
      return resolveDesignTokensStep(event.data);
    });

    return result;
  }
);
