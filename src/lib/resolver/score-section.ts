/**
 * score-section.ts — Component Matching Score Function
 * 
 * Pure function: given a section intent and candidate components, score each candidate
 * and return ranked list.
 * 
 * Algorithm:
 * 1. Category match: 1.0 if semanticCategory === intent.category, 0.5 if tag-only
 * 2. Tag overlap: Jaccard similarity between intent.tags and component.tags
 * 3. Description similarity: Simple substring matching (not full BM25)
 * 4. Weighted score: 0.5 * category + 0.3 * tagOverlap + 0.2 * descSimilarity
 * 
 * Used by: resolve-components step (tier decision logic)
 */

import type { Section } from "@/lib/types/site-plan";
import type { ComponentMeta, ResolverScore } from "@/lib/component-pool/registry/types";

/**
 * Score a section against a list of candidate components
 * Returns top 5 sorted by score descending
 */
export function scoreSection(
  section: Section,
  candidates: ComponentMeta[]
): ResolverScore[] {
  const { intent } = section;
  const scores: ResolverScore[] = [];

  for (const component of candidates) {
    const categoryMatch = computeCategoryMatch(intent.category, component);
    const tagOverlap = computeTagOverlap(intent.tags, component.tags);
    const descSimilarity = computeDescriptionSimilarity(intent.description, component);

    const score = 0.5 * categoryMatch + 0.3 * tagOverlap + 0.2 * descSimilarity;

    scores.push({
      component,
      score,
      categoryMatch,
      tagOverlap,
      descriptionSimilarity: descSimilarity,
    });
  }

  // Sort by score descending, return top 5
  return scores.sort((a, b) => b.score - a.score).slice(0, 5);
}

/**
 * Category match score (0-1)
 * 1.0 = exact semantic category match
 * 0.5 = tag-only match
 * 0.0 = no match
 */
function computeCategoryMatch(sectionCategory: string, component: ComponentMeta): number {
  if (component.semanticCategory === sectionCategory) {
    return 1.0;
  }
  // Fall back to tag matching
  return 0.5;
}

/**
 * Tag overlap score (0-1)
 * Jaccard similarity: |intersection| / |union|
 */
function computeTagOverlap(sectionTags: string[], componentTags: string[]): number {
  if (sectionTags.length === 0 && componentTags.length === 0) {
    return 1.0;
  }

  const sectionSet = new Set(sectionTags);
  const componentSet = new Set(componentTags);

  const intersection = new Set([...sectionSet].filter((x) => componentSet.has(x)));
  const union = new Set([...sectionSet, ...componentSet]);

  if (union.size === 0) return 0;
  return intersection.size / union.size;
}

/**
 * Description similarity (0-1)
 * Simple approach: score based on keyword overlap
 * TODO: Could be improved with embedding-based similarity
 */
function computeDescriptionSimilarity(sectionDesc: string, component: ComponentMeta): number {
  const sectionWords = sectionDesc.toLowerCase().split(/\s+/).filter((w) => w.length > 3);
  const componentWords = component.description.toLowerCase().split(/\s+/).filter((w) => w.length > 3);

  if (sectionWords.length === 0 || componentWords.length === 0) {
    return 0;
  }

  const sectionSet = new Set(sectionWords);
  const componentSet = new Set(componentWords);

  const intersection = sectionWords.filter((w) => componentSet.has(w)).length;
  return Math.min(1, intersection / Math.max(sectionWords.length, componentWords.length));
}
