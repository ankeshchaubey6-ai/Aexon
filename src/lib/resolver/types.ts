/**
 * Resolver Types — Component matching and tier decision
 * 
 * Used by:
 * - score-section.ts (pure scoring function)
 * - decide-tier.ts (tier decision logic)
 * - resolve-components step (orchestrator)
 */

import type { SemanticIntent, Section } from "@/lib/types/site-plan";
import type { ComponentMeta, ResolverScore } from "@/lib/component-pool/registry/types";

/** The 3-tier resolution decision */
export type ResolutionTier = "POOL_MATCH" | "POOL_ADAPT" | "CUSTOM_GENERATE";

/** Output of scoring: section → candidates → ranked list */
export interface ScoredCandidate {
  component: ComponentMeta;
  score: number;
  categoryMatch: number;
  tagOverlap: number;
  descriptionSimilarity: number;
}

/** Output of tier decision: which tier was chosen, and why */
export interface TierDecision {
  tier: ResolutionTier;
  chosen: ComponentMeta | null; // null for CUSTOM_GENERATE
  score: number;
  rationale: string;
}

/** The final resolved state of a section: what code will be generated */
export interface ResolvedSection {
  /** Section ID from the plan */
  sectionId: string;

  /** The intent this section fulfills */
  intent: SemanticIntent;

  /** Which tier was chosen */
  tier: ResolutionTier;

  /** The component that was chosen (if POOL_MATCH or POOL_ADAPT) */
  component: ComponentMeta | null;

  /** For POOL_MATCH: props object to pass to the component */
  props?: Record<string, unknown>;

  /** For POOL_ADAPT: wrapper component source code */
  wrapperSource?: string;

  /** For CUSTOM_GENERATE: full component source code */
  customSource?: string;

  /** Import path for this section (pool or _generated) */
  importPath: string;

  /** File path where the component lives (if custom) */
  filePath?: string;

  /** True if this section's generation passed validation */
  isValid?: boolean;

  /** Validation errors for this section, if any */
  validationErrors?: Array<{
    severity: "ERROR" | "WARN";
    line?: number;
    message: string;
    fixHint?: string;
  }>;
}

/**
 * Session cache — stores custom components generated during this run
 * Allows later sections to reuse custom components without regenerating
 */
export interface SerializedSessionCache {
  projectId: string;
  entries: Array<{
    intentHash: string;
    resolved: ResolvedSection;
  }>;
}

/**
 * Input to resolve-components step
 */
export interface ResolveComponentsInput {
  sitePlan: any; // SitePlan
  registryContext: Map<string, ComponentMeta[]>; // section ID → candidates
  tokens: any; // CSSVariableManifest
  sessionCache: SerializedSessionCache;
  llmThresholds?: {
    matchThreshold: number; // 0.85 default
    adaptThreshold: number; // 0.60 default
  };
}

/**
 * Output from resolve-components step
 */
export interface ResolveComponentsOutput {
  resolutions: ResolvedSection[];
  updatedCache: SerializedSessionCache;
  failedSections: Array<{
    sectionId: string;
    error: string;
    retryCount: number;
  }>;
}
