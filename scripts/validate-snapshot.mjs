#!/usr/bin/env node
/**
 * Snapshot Validator v2.0 - UNIFIED
 *
 * Validates that the snapshot (public/snapshot/base.json) meets all requirements
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, "..");
const SNAPSHOT_FILE = path.join(PROJECT_ROOT, "public", "snapshot", "base.json");

console.log("\n═══════════════════════════════════════════════════════════════");
console.log("WebContainer Snapshot Validator v2.0 - UNIFIED");
console.log("═══════════════════════════════════════════════════════════════\n");

let allPass = true;

// ━━━ CHECK 1: Snapshot file exists ━━━
console.log("✓ CHECK 1: Snapshot file exists");
if (!fs.existsSync(SNAPSHOT_FILE)) {
  console.error(`✗ FAIL: Snapshot not found at: ${SNAPSHOT_FILE}`);
  console.error("  Run: npm run build:snapshot\n");
  process.exit(1);
}

let manifest;
try {
  const content = fs.readFileSync(SNAPSHOT_FILE, "utf-8");
  manifest = JSON.parse(content);
  console.log(`  ✓ Snapshot valid (${manifest.fileCount} files)\n`);
} catch (err) {
  console.error(`✗ FAIL: Invalid snapshot JSON:`, err.message);
  process.exit(1);
}

// ━━━ CHECK 2: Schema validation ━━━
console.log("✓ CHECK 2: Schema validation");
const requiredFields = [
  "version",
  "builtAt",
  "platform",
  "packages",
  "fileCount",
  "files",
];
const missingFields = requiredFields.filter((field) => !(field in manifest));

if (missingFields.length > 0) {
  console.error(
    `✗ FAIL: Missing fields: ${missingFields.join(", ")}`
  );
  allPass = false;
} else if (manifest.version !== 2) {
  console.error(
    `✗ FAIL: Wrong version (expected 2, got ${manifest.version})`
  );
  allPass = false;
} else if (!Array.isArray(manifest.packages)) {
  console.error(`✗ FAIL: packages is not an array`);
  allPass = false;
} else if (typeof manifest.files !== "object") {
  console.error(`✗ FAIL: files is not an object`);
  allPass = false;
} else {
  console.log(`  ✓ Schema valid`);
  console.log(`  ✓ Platform: ${manifest.platform}`);
  console.log(`  ✓ Built: ${manifest.builtAt}\n`);
}

// ━━━ CHECK 3: Platform is linux-x64 ━━━
console.log("✓ CHECK 3: Platform check");
if (manifest.platform !== "linux-x64") {
  console.error(
    `✗ FAIL: Wrong platform (expected linux-x64, got ${manifest.platform})`
  );
  allPass = false;
} else {
  console.log(`  ✓ Platform is linux-x64\n`);
}

// ━━━ CHECK 4: Critical files present ━━━
console.log("✓ CHECK 4: Critical files");
const criticalFiles = [
  "node_modules/vite/dist/node/cli.js",
  "node_modules/esbuild-wasm/bin/esbuild",
  "node_modules/esbuild-wasm/esbuild.wasm",
  "node_modules/esbuild-wasm/wasm_exec_node.js",
];
for (const file of criticalFiles) {
  if (!(file in manifest.files)) {
    console.error(`✗ FAIL: Critical file missing: ${file}`);
    allPass = false;
  } else {
    console.log(`  ✓ ${file}`);
  }
}
console.log();

// ━━━ CHECK 5: File format validation ━━━
console.log("✓ CHECK 5: File format validation");

// Check 5a: No .d.ts files
const dtsFiles = Object.keys(manifest.files).filter((f) =>
  f.endsWith(".d.ts")
);
if (dtsFiles.length > 0) {
  console.error(`✗ FAIL: Found ${dtsFiles.length} .d.ts files (should be 0)`);
  allPass = false;
} else {
  console.log(`  ✓ No TypeScript declarations`);
}

// Check 5b: No non-Linux paths
const nonLinuxPaths = Object.keys(manifest.files).filter(
  (f) => f.includes("win32") || f.includes("darwin")
);
if (nonLinuxPaths.length > 0) {
  console.error(
    `✗ FAIL: Found ${nonLinuxPaths.length} non-Linux paths (${nonLinuxPaths[0]}...)`
  );
  allPass = false;
} else {
  console.log(`  ✓ No non-Linux binaries`);
}

// Check 5c: JS/JSON files are NOT binary
const jsJsonFiles = Object.entries(manifest.files).filter(
  ([path, entry]) => {
    const isBinary = entry.type === "binary";
    const isJsOrJson =
      path.endsWith(".js") ||
      path.endsWith(".mjs") ||
      path.endsWith(".cjs") ||
      path.endsWith(".json");
    return isBinary && isJsOrJson;
  }
);

if (jsJsonFiles.length > 0) {
  console.error(
    `✗ FAIL: ${jsJsonFiles.length} JS/JSON files are base64 encoded (e.g., ${jsJsonFiles[0][0]})`
  );
  allPass = false;
} else {
  console.log(`  ✓ JavaScript/JSON files are UTF-8 text`);
}

// Check 5d: esbuild-wasm IS binary
const esbuildWasmEntry =
  manifest.files["node_modules/esbuild-wasm/esbuild.wasm"];
if (esbuildWasmEntry && esbuildWasmEntry.type !== "binary") {
  console.error(`✗ FAIL: esbuild.wasm should be base64 encoded`);
  allPass = false;
} else if (esbuildWasmEntry) {
  console.log(`  ✓ esbuild.wasm is base64 encoded`);
}
console.log();

// ━━━ CHECK 6: File count ━━━
console.log("✓ CHECK 6: File count");
const actualCount = Object.keys(manifest.files).length;
if (actualCount !== manifest.fileCount) {
  console.warn(
    `⚠ File count mismatch (manifest: ${manifest.fileCount}, actual: ${actualCount})`
  );
} else {
  console.log(`  ✓ ${actualCount} files\n`);
}

// ━━━ RESULTS ━━━
console.log("═══════════════════════════════════════════════════════════════");
if (allPass) {
  console.log("✅ All validation checks passed\n");
  process.exit(0);
} else {
  console.log("❌ Validation failed\n");
  process.exit(1);
}
