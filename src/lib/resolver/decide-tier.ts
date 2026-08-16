/**
 * decide-tier.ts — 3-Tier Resolution Decision Logic
 * 
 * Given a set of scored candidates, decide:
 * - POOL_MATCH (score >= 0.85): Use component as-is
 * - POOL_ADAPT (0.60-0.85): Use component with wrapper adapter
 * - CUSTOM_GENERATE (< 0.60): Generate new component from scratch
 * 
 * Used by: resolve-components step
 */

import type { Section } from "@/lib/types/site-plan";
import type { ComponentMeta, ResolverScore } from "@/lib/component-pool/registry/types";
import type { TierDecision, ResolutionTier } from "./types";

/**
 * Configuration for tier thresholds
 */
export interface TierThresholds {
  /** Score >= this → POOL_MATCH */
  matchThreshold: number;
  /** Score in [adaptThreshold, matchThreshold) → POOL_ADAPT */
  adaptThreshold: number;
}

export const DEFAULT_THRESHOLDS: TierThresholds = {
  matchThreshold: 0.85,
  adaptThreshold: 0.60,
};

/**
 * Decide which tier to use based on top score
 * Returns decision with rationale for logging
 */
export function decideTier(
  scores: ResolverScore[],
  section: Section,
  thresholds: TierThresholds = DEFAULT_THRESHOLDS
): TierDecision {
  if (scores.length === 0) {
    return {
      tier: "CUSTOM_GENERATE",
      chosen: null,
      score: 0,
      rationale: "No pool candidates available",
    };
  }

  const topScore = scores[0];

  if (topScore.score >= thresholds.matchThreshold) {
    return {
      tier: "POOL_MATCH",
      chosen: topScore.component,
      score: topScore.score,
      rationale: `Pool match (score ${topScore.score.toFixed(2)} >= ${thresholds.matchThreshold})`,
    };
  }

  if (topScore.score >= thresholds.adaptThreshold) {
    return {
      tier: "POOL_ADAPT",
      chosen: topScore.component,
      score: topScore.score,
      rationale: `Pool adapt (score ${topScore.score.toFixed(2)} in range [${thresholds.adaptThreshold}, ${thresholds.matchThreshold}))`,
    };
  }

  return {
    tier: "CUSTOM_GENERATE",
    chosen: null,
    score: topScore.score,
    rationale: `Custom generation (top score ${topScore.score.toFixed(2)} < ${thresholds.adaptThreshold})`,
  };
}

/**
 * Log decision for debugging
 */
export function logTierDecision(decision: TierDecision, sectionId: string): void {
  console.log(`[Resolver] Section ${sectionId}: ${decision.rationale}`);
  if (decision.chosen) {
    console.log(`  → Component: ${decision.chosen.name}`);
  }
}
