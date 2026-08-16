#!/usr/bin/env node

/**
 * scripts/build-registry.ts
 * 
 * Build component registry from meta.ts files
 * 
 * Usage: npx tsx scripts/build-registry.ts
 * Output: src/lib/component-pool/registry/components.metadata.json
 * 
 * Algorithm:
 * 1. Find all meta.ts files in src/lib/component-pool
 * 2. Load each meta.ts file using dynamic import
 * 3. Extract ComponentMeta from module exports
 * 4. Build ComponentRegistry with all metadata
 * 5. Generate SHA-256 hash of registry
 * 6. Write components.metadata.json with hash as version
 */

import { promises as fs } from "fs";
import { join, dirname } from "path";
import { createHash } from "crypto";
import { glob } from "glob";

// Type definitions
interface PropDef {
  name: string;
  type: string;
  required: boolean;
  description: string;
  example?: string;
  defaultValue?: string | number | boolean;
  enumValues?: string[];
}

interface ComponentMeta {
  name: string;
  category: string;
  semanticCategory: string;
  importPath: string;
  description: string;
  tags: string[];
  props: PropDef[];
  slots: Array<{ name: string; description: string; required: boolean; acceptsType?: string }>;
  variants: Array<{ name: string; description: string; propOverrides?: Record<string, any> }>;
  examples: string[];
  designTokens: string[];
  version: string;
}

interface ComponentRegistry {
  version: string; // SHA-256 hash
  generatedAt: string;
  components: ComponentMeta[];
}

const PROJECT_ROOT = process.cwd();
const REGISTRY_OUTPUT = join(PROJECT_ROOT, "src/lib/component-pool/registry/components.metadata.json");

/**
 * Find all meta.ts files in the component pool
 */
async function findMetaFiles(): Promise<string[]> {
  console.log(`📍 Searching for meta.ts files...`);

  const files = await glob("src/lib/component-pool/**/meta.ts", {
    cwd: PROJECT_ROOT,
    absolute: false,
  });

  console.log(`✓ Found ${files.length} meta.ts files`);
  return files;
}

/**
 * Load metadata from a meta.ts file using dynamic import
 */
async function loadMetadata(filePath: string): Promise<ComponentMeta | null> {
  try {
    const absolutePath = join(PROJECT_ROOT, filePath);
    
    // Use dynamic import to load the TypeScript file
    // tsx will handle the TypeScript compilation
    const module = (await import(require("url").pathToFileURL(absolutePath).href)) as Record<string, ComponentMeta>;
    
    // Find the exported ComponentMeta object (usually named like ButtonMeta, HeroMeta, etc.)
    let metadata: ComponentMeta | null = null;
    
    for (const [, value] of Object.entries(module)) {
      if (value && typeof value === "object" && "name" in value && "category" in value) {
        metadata = value as ComponentMeta;
        break;
      }
    }

    if (!metadata) {
      console.warn(`⚠  No ComponentMeta export found in ${filePath}`);
      return null;
    }

    console.log(`✓ Loaded: ${metadata.name}`);
    return metadata;
  } catch (err) {
    console.error(`✗ Error loading ${filePath}:`, err instanceof Error ? err.message : err);
    return null;
  }
}

/**
 * Generate registry from all meta files
 */
async function buildRegistry(): Promise<ComponentRegistry> {
  console.log("\n🔨 Building component registry...\n");

  const metaFiles = await findMetaFiles();
  const components: ComponentMeta[] = [];
  let loadedCount = 0;

  for (const filePath of metaFiles) {
    const metadata = await loadMetadata(filePath);
    if (metadata) {
      components.push(metadata);
      loadedCount++;
    }
  }

  console.log(`\n✓ Successfully loaded ${loadedCount}/${metaFiles.length} components\n`);

  if (components.length === 0) {
    throw new Error("❌ No components loaded. Check your meta.ts files.");
  }

  // Generate SHA-256 hash of the entire registry
  const registryJson = JSON.stringify(components, null, 2);
  const hash = createHash("sha256").update(registryJson).digest("hex");

  const registry: ComponentRegistry = {
    version: hash,
    generatedAt: new Date().toISOString(),
    components,
  };

  return registry;
}

/**
 * Write registry to JSON file
 */
async function writeRegistry(registry: ComponentRegistry): Promise<void> {
  const dir = dirname(REGISTRY_OUTPUT);

  // Ensure directory exists
  await fs.mkdir(dir, { recursive: true });

  const json = JSON.stringify(registry, null, 2);
  await fs.writeFile(REGISTRY_OUTPUT, json, "utf-8");

  console.log(`✅ Registry written successfully!`);
  console.log(`📦 Output: ${REGISTRY_OUTPUT}`);
  console.log(`📊 Components: ${registry.components.length}`);
  console.log(`🔐 Version: ${registry.version.substring(0, 8)}...`);
  console.log(`⏰ Generated: ${registry.generatedAt}\n`);
}

/**
 * Main entry point
 */
async function main(): Promise<void> {
  try {
    const registry = await buildRegistry();
    await writeRegistry(registry);
    process.exit(0);
  } catch (err) {
    console.error("\n❌ Registry build failed:");
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  }
}

main();

