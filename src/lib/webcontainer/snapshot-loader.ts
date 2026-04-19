/**
 * WebContainer Snapshot Loader
 *
 * Loads the built snapshot and converts it to FileSystemTree format.
 * Handles validation, caching, and binary/text conversion.
 */

import type { FileSystemTree } from "@webcontainer/api";

export interface SnapshotManifest {
  version: number;
  builtAt: string;
  platform: string;
  packages: string[];
  fileCount: number;
  textFileCount: number;
  binaryFileCount: number;
  files: Record<
    string,
    { type: "text" | "binary"; content: string }
  >;
}

// ━━━ CACHE ━━━
let _cachedManifest: SnapshotManifest | null = null;
let _cachedTree: FileSystemTree | null = null;
let _lastBuiltAt: string | null = null;

/**
 * Load the snapshot manifest from public/snapshot/base.json
 * Validates Content-Type and schema before parsing.
 */
export async function loadSnapshotManifest(): Promise<SnapshotManifest> {
  console.log("[SNAPSHOT] Fetching manifest…");

  try {
    const response = await fetch("/snapshot/base.json");

    // ━━━ VALIDATION: Content-Type must be JSON ━━━
    const contentType = response.headers.get("content-type");
    if (!contentType?.includes("application/json")) {
      // If we get 404, the server returns text/html
      if (!response.ok) {
        throw new Error(
          "Snapshot not found — run npm run build:snapshot (got " +
          response.status +
          " " +
          response.statusText +
          ")"
        );
      }
      throw new Error(
        `Invalid Content-Type: ${contentType} (expected application/json). ` +
        "This usually means the snapshot was not found and you got an HTML error page."
      );
    }

    if (!response.ok) {
      throw new Error(
        `Failed to fetch snapshot: ${response.status} ${response.statusText}`
      );
    }

    const data = await response.json() as unknown;

    // ━━━ SCHEMA VALIDATION ━━━
    if (!isSnapshotManifest(data)) {
      throw new Error("Invalid snapshot schema");
    }

    console.log(
      `[SNAPSHOT] ✓ Manifest loaded (${data.fileCount} files, platform: ${data.platform})`
    );

    return data;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[SNAPSHOT] ❌ Failed to load manifest: ${message}`);
    throw new Error(`Snapshot load failed: ${message}`);
  }
}

/**
 * Type guard for SnapshotManifest
 */
function isSnapshotManifest(data: unknown): data is SnapshotManifest {
  if (typeof data !== "object" || data === null) {
    return false;
  }

  const obj = data as Record<string, unknown>;

  // Check required fields
  if (
    typeof obj.version !== "number" ||
    obj.version !== 2 ||
    typeof obj.builtAt !== "string" ||
    typeof obj.platform !== "string" ||
    !Array.isArray(obj.packages) ||
    typeof obj.fileCount !== "number" ||
    typeof obj.files !== "object"
  ) {
    return false;
  }

  // Validate platform
  if (obj.platform !== "linux-x64") {
    console.warn(
      `[SNAPSHOT] Platform mismatch: snapshot is for ${obj.platform}, ` +
      "but WebContainer expects linux-x64"
    );
    return false;
  }

  return true;
}

/**
 * Convert snapshot manifest to WebContainer FileSystemTree format.
 * - Text files: stored as-is
 * - Binary files: decoded from base64 to Uint8Array
 */
export async function manifestToFileSystemTree(
  manifest: SnapshotManifest
): Promise<FileSystemTree> {
  console.log("[SNAPSHOT] Converting to FileSystemTree…");

  const tree: FileSystemTree = {};
  let convertedCount = 0;

  for (const [filePath, entry] of Object.entries(manifest.files)) {
    const parts = filePath.split("/");
    let current: Record<string, unknown> = tree;

    // Navigate/create directory structure
    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      if (!current[part]) {
        current[part] = { directory: {} };
      }
      current = (current[part] as { directory: Record<string, unknown> })
        .directory;
    }

    // Add file
    const fileName = parts[parts.length - 1];

    if (entry.type === "text") {
      // Text files: store as string
      current[fileName] = {
        file: {
          contents: entry.content,
        },
      };
    } else if (entry.type === "binary") {
      // Binary files: decode base64 to Uint8Array
      try {
        const binary = Buffer.from(entry.content, "base64");
        current[fileName] = {
          file: {
            contents: new Uint8Array(binary),
          },
        };
      } catch (err) {
        console.warn(
          `[SNAPSHOT] Failed to decode binary file ${filePath}:`,
          err
        );
        continue;
      }
    }

    convertedCount++;
  }

  console.log(`[SNAPSHOT] ✓ Converted ${convertedCount} files to FileSystemTree`);

  return tree;
}

/**
 * Load snapshot with caching.
 * Cache is invalidated if the snapshot was rebuilt (checked via builtAt timestamp).
 */
export async function loadSnapshot(): Promise<FileSystemTree> {
  console.log("[SNAPSHOT] Loading snapshot…");

  try {
    // Load or use cached manifest
    if (!_cachedManifest) {
      _cachedManifest = await loadSnapshotManifest();
      _lastBuiltAt = _cachedManifest.builtAt;
    } else {
      // Check if snapshot was rebuilt
      const newManifest = await loadSnapshotManifest();
      if (newManifest.builtAt !== _lastBuiltAt) {
        console.log(
          "[SNAPSHOT] ⟳ Snapshot was rebuilt, invalidating cache"
        );
        _cachedManifest = newManifest;
        _cachedTree = null;
        _lastBuiltAt = newManifest.builtAt;
      }
    }

    // Convert to tree if not cached
    if (!_cachedTree) {
      _cachedTree = await manifestToFileSystemTree(_cachedManifest);
    }

    // Log size info
    const approximateSize = JSON.stringify(_cachedManifest).length / 1024 / 1024;
    console.log(
      `[SNAPSHOT] ✓ Ready (${_cachedManifest.fileCount} files, ~${approximateSize.toFixed(2)}MB)`
    );

    return _cachedTree;
  } catch (err) {
    console.error("[SNAPSHOT] ❌ Load failed:", err);
    throw err;
  }
}

/**
 * Clear the snapshot cache (useful for testing or forcing a reload)
 */
export function clearSnapshotCache(): void {
  _cachedManifest = null;
  _cachedTree = null;
  _lastBuiltAt = null;
  console.log("[SNAPSHOT] Cache cleared");
}
