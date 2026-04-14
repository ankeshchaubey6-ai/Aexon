#!/usr/bin/env node
/**
 * Snapshot Validator v2.0 - CHUNKED
 *
 * Validates that the chunked snapshot meets all requirements
 */

const fs = require("fs");
const path = require("path");

const SNAPSHOT_DIR = path.join(__dirname, "..", "public", "snapshot");

console.log("\n═══════════════════════════════════════════════════════════════");
console.log("WebContainer Snapshot Validator v2.0 - CHUNKED");
console.log("═══════════════════════════════════════════════════════════════\n");

let allPass = true;

// ━━━ CHECK 1: Manifest exists ━━━
console.log("✓ CHECK 1: Manifest exists");
const manifestPath = path.join(SNAPSHOT_DIR, "manifest.json");
if (!fs.existsSync(manifestPath)) {
  console.error("✗ FAIL: Manifest not found at:", manifestPath);
  process.exit(1);
}

let manifest;
try {
  manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
  console.log(`  ✓ Manifest valid\n`);
} catch (err) {
  console.error("✗ FAIL: Invalid manifest JSON:", err.message);
  process.exit(1);
}

// ━━━ CHECK 2: All chunks exist and are within size limits ━━━
console.log("✓ CHECK 2: All chunks exist");
for (const chunkName of manifest.chunks) {
  const chunkPath = path.join(SNAPSHOT_DIR, `${chunkName}.json`);
  
  if (!fs.existsSync(chunkPath)) {
    console.error(`✗ FAIL: Chunk not found: ${chunkName}.json`);
    allPass = false;
    continue;
  }
  
  const stat = fs.statSync(chunkPath);
  const sizeMB = (stat.size / 1024 / 1024).toFixed(2);
  
  if (stat.size < 1) {
    console.error(`✗ FAIL: Chunk is empty: ${chunkName}.json`);
    allPass = false;
  } else if (stat.size > 95 * 1024 * 1024) {
    console.error(`✗ FAIL: Chunk too large: ${chunkName}.json (${sizeMB}MB, max 95MB)`);
    allPass = false;
  } else {
    console.log(`  ✓ ${chunkName}.json: ${sizeMB}MB`);
  }
}
console.log();

// ━━━ CHECK 3: esbuild binary present & chunk-esbuild valid ━━━
console.log("✓ CHECK 3: esbuild binary verification");
const esbuildChunkPath = path.join(SNAPSHOT_DIR, "chunk-esbuild.json");

if (!fs.existsSync(esbuildChunkPath)) {
  console.error("✗ FAIL: chunk-esbuild.json not found");
  allPass = false;
} else {
  try {
    const esbuildChunk = JSON.parse(fs.readFileSync(esbuildChunkPath, "utf-8"));
    const hasEsbuild = "node_modules/@esbuild/linux-x64/bin/esbuild" in esbuildChunk;
    
    if (!hasEsbuild) {
      console.error("✗ FAIL: esbuild binary not found in chunk-esbuild.json");
      allPass = false;
    } else {
      const chunkSize = fs.statSync(esbuildChunkPath).size / 1024 / 1024;
      if (chunkSize < 10) {
        console.error(`✗ FAIL: chunk-esbuild.json too small (${chunkSize.toFixed(2)}MB, need >10MB)`);
        allPass = false;
      } else {
        console.log(`  ✓ esbuild binary found`);
        console.log(`  ✓ chunk-esbuild.json size: ${chunkSize.toFixed(2)}MB\n`);
      }
    }
  } catch (err) {
    console.error("✗ FAIL: Could not parse chunk-esbuild.json:", err.message);
    allPass = false;
  }
}

// ━━━ CHECK 4: No non-linux binaries ━━━
console.log("✓ CHECK 4: No non-Linux binaries");
const nonLinuxPatterns = ["win32", "darwin"];
let foundNonLinux = false;

for (const chunkName of manifest.chunks) {
  const chunkPath = path.join(SNAPSHOT_DIR, `${chunkName}.json`);
  
  try {
    const chunk = JSON.parse(fs.readFileSync(chunkPath, "utf-8"));
    const jsonStr = JSON.stringify(chunk);
    
    for (const pattern of nonLinuxPatterns) {
      if (jsonStr.includes(pattern)) {
        console.error(`✗ FAIL: Found '${pattern}' in ${chunkName}.json`);
        foundNonLinux = true;
        allPass = false;
      }
    }
  } catch (err) {
    console.error(`✗ FAIL: Could not parse ${chunkName}.json`, err.message);
    allPass = false;
  }
}

if (!foundNonLinux) {
  console.log(`  ✓ No win32 or darwin binaries found\n`);
}

// ━━━ SUMMARY ━━━
console.log("═══════════════════════════════════════════════════════════════");
if (allPass) {
  console.log("✅ ALL CHECKS PASSED");
  console.log("═══════════════════════════════════════════════════════════════\n");
  process.exit(0);
} else {
  console.log("❌ SOME CHECKS FAILED");
  console.log("═══════════════════════════════════════════════════════════════\n");
  process.exit(1);
}
