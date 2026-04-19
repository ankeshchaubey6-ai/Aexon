#!/usr/bin/env node
/**
 * Reads every .jsx file in component-pool and writes snippets JSON
 * Run: node scripts/generate-snippets.js
 */
import { readdirSync, statSync, readFileSync, writeFileSync, mkdirSync } from "fs";
import { join, resolve, basename } from "path";

const base    = resolve("src/lib/component-pool");
const outFile = join(base, "snippets/generated/all-snippets.json");
const cats    = ["primitives", "blocks", "animations", "layouts"];
const snippets = {};

for (const cat of cats) {
  const dir = join(base, cat);
  for (const comp of readdirSync(dir).filter(f => statSync(join(dir, f)).isDirectory())) {
    const file = join(dir, comp, `${comp}.jsx`);
    try {
      const code = readFileSync(file, "utf8");
      // Keep first 120 lines as the snippet context
      snippets[comp] = code.split("\n").slice(0, 120).join("\n");
    } catch {}
  }
}

mkdirSync(join(base, "snippets/generated"), { recursive: true });
writeFileSync(outFile, JSON.stringify(snippets, null, 2));
console.log("✅ Snippets generated:", Object.keys(snippets).length, "components");
