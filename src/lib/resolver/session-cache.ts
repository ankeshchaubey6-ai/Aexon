/**
 * resolver/session-cache.ts — Session-Level Component Cache
 * 
 * During a single project generation run, custom components may be generated for
 * sections that don't match pool components. Later sections with similar intents
 * should reuse those custom components rather than regenerate.
 * 
 * This cache:
 * - Serializes to JSON for storage in Inngest payload
 * - Survives Inngest retries without data loss
 * - Computes intent hash to detect reusable patterns
 * 
 * Used by: resolve-components step (lookup phase), LLM generators (update phase)
 */

import { createHash } from "crypto";

import type { Section } from "@/lib/types/site-plan";
import type { ResolvedSection, SerializedSessionCache } from "./types";

/**
 * Create a cache entry from a resolved section
 * Returns a hash of the intent for matching
 */
export function hashIntent(section: Section): string {
  const { category, description, tags } = section.intent;
  const key = `${category}|${description}|${tags.sort().join(",")}`;
  return createHash("sha256").update(key).digest("hex");
}

/**
 * Look up a section in the cache by intent
 * Returns cached resolved section if found and reusable
 */
export function lookupCacheHit(
  cache: SerializedSessionCache,
  section: Section
): ResolvedSection | null {
  const intentHash = hashIntent(section);

  for (const entry of cache.entries) {
    if (entry.intentHash === intentHash) {
      // Cache hit!
      // But only if the cached component is reusable across tiers
      // (POOL_MATCH and POOL_ADAPT are safe; CUSTOM_GENERATE must be adapted to current tokens)
      if (
        entry.resolved.tier === "POOL_MATCH" ||
        entry.resolved.tier === "POOL_ADAPT"
      ) {
        return entry.resolved;
      }
    }
  }

  return null;
}

/**
 * Add a resolved section to the cache
 * Updates in-place to avoid mutation issues
 */
export function updateCacheWithResolution(
  cache: SerializedSessionCache,
  section: Section,
  resolved: ResolvedSection
): SerializedSessionCache {
  const intentHash = hashIntent(section);

  // Check if entry already exists
  const existing = cache.entries.findIndex((e) => e.intentHash === intentHash);
  if (existing >= 0) {
    // Update existing
    cache.entries[existing].resolved = resolved;
  } else {
    // Add new
    cache.entries.push({ intentHash, resolved });
  }

  return cache;
}

/**
 * Create a new empty cache for a project
 */
export function createNewCache(projectId: string): SerializedSessionCache {
  return {
    projectId,
    entries: [],
  };
}

/**
 * Serialize cache to JSON string (for Inngest payload)
 */
export function serializeCache(cache: SerializedSessionCache): string {
  return JSON.stringify(cache);
}

/**
 * Deserialize cache from JSON string
 */
export function deserializeCache(json: string): SerializedSessionCache {
  try {
    return JSON.parse(json);
  } catch (err) {
    console.error("[SessionCache] Deserialization failed:", err);
    throw new Error("Failed to deserialize session cache");
  }
}

/**
 * Get cache statistics for logging
 */
export function getCacheStats(cache: SerializedSessionCache): {
  totalEntries: number;
  poolMatchCount: number;
  poolAdaptCount: number;
  customGenCount: number;
} {
  let poolMatchCount = 0;
  let poolAdaptCount = 0;
  let customGenCount = 0;

  for (const entry of cache.entries) {
    if (entry.resolved.tier === "POOL_MATCH") poolMatchCount++;
    else if (entry.resolved.tier === "POOL_ADAPT") poolAdaptCount++;
    else if (entry.resolved.tier === "CUSTOM_GENERATE") customGenCount++;
  }

  return {
    totalEntries: cache.entries.length,
    poolMatchCount,
    poolAdaptCount,
    customGenCount,
  };
}

/**
 * Log cache hits for debugging
 */
export function logCacheHit(
  section: Section,
  cachedResolution: ResolvedSection
): void {
  console.log(
    `[SessionCache] Hit: section=${section.id} tier=${cachedResolution.tier} component=${cachedResolution.component?.name || "generated"}`
  );
}
