#!/usr/bin/env node
/**
 * Scans component-pool and writes registry/components.json
 * Run: node scripts/build-registry.js
 */
import { readdirSync, statSync, writeFileSync, readFileSync } from "fs";
import { join, resolve } from "path";

const base = resolve("src/lib/component-pool");
const cats = ["primitives", "blocks", "animations", "layouts"];

const registry = { version: "2.0.0", generated: new Date().toISOString(), categories: {} };

for (const cat of cats) {
  const dir = join(base, cat);
  try {
    registry.categories[cat] = readdirSync(dir)
      .filter(f => statSync(join(dir, f)).isDirectory())
      .sort();
  } catch { registry.categories[cat] = []; }
}

const existing = JSON.parse(readFileSync(join(base, "registry/components.json"), "utf8"));
const merged = { ...existing, ...registry, siteTypes: existing.siteTypes };
writeFileSync(join(base, "registry/components.json"), JSON.stringify(merged, null, 2));
console.log("✅ Registry built:", Object.values(registry.categories).flat().length, "components");
