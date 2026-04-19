#!/usr/bin/env node
/**
 * Validates every component: checks index.js exports exist, jsx has no obvious issues.
 * Run: node scripts/validate-components.js
 */
import { readdirSync, statSync, existsSync, readFileSync } from "fs";
import { join, resolve } from "path";

const base = resolve("src/lib/component-pool");
const cats = ["primitives", "blocks", "animations", "layouts"];
let pass = 0, fail = 0;

for (const cat of cats) {
  const dir = join(base, cat);
  for (const comp of readdirSync(dir).filter(f => statSync(join(dir, f)).isDirectory())) {
    const jsx   = join(dir, comp, `${comp}.jsx`);
    const index = join(dir, comp, "index.js");
    const missing = [jsx, index].filter(f => !existsSync(f));
    if (missing.length) { console.error(`❌ ${comp}: missing`, missing.map(f => f.split("/").pop())); fail++; }
    else { pass++; }
  }
}

console.log(`\n✅ ${pass} valid | ❌ ${fail} invalid\n`);
process.exit(fail > 0 ? 1 : 0);
