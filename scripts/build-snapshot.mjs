#!/usr/bin/env node
/**
 * WebContainer Snapshot Builder v2.0
 * 
 * Builds a selective, optimized snapshot for WebContainer with:
 * - Only essential packages (react, vite, esbuild, rollup)
 * - Proper text/binary file handling
 * - Platform validation (linux-x64 only)
 * - Comprehensive validation at build time
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { readdir, stat, readFile, mkdir, writeFile } from "fs/promises";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, "..");
const NODE_MODULES = path.join(PROJECT_ROOT, "node_modules");
const OUTPUT_DIR = path.join(PROJECT_ROOT, "public", "snapshot");
const OUTPUT_FILE = path.join(OUTPUT_DIR, "base.json");

// ━━━ PLATFORM VALIDATION ━━━
const arch = process.arch;
const platform = process.platform;

console.log(`\n🔧 [BUILD-SNAPSHOT] Starting on ${platform}-${arch}\n`);

if (platform !== "linux" || arch !== "x64") {
  console.error(
    `❌ PLATFORM MISMATCH\n` +
    `   This script MUST run on linux-x64 only.\n` +
    `   Current: ${platform}-${arch}\n` +
    `   The esbuild binary is platform-specific.\n` +
    `   A snapshot built on ${platform} will have a broken binary.\n`
  );
  process.exit(1);
}

// ━━━ SELECTIVE PACKAGES ━━━
const SNAPSHOT_PACKAGES = [
  "react",
  "react-dom",
  "scheduler",
  "loose-envify",
  "vite",
  "esbuild",
  "esbuild-wasm",
  "rollup",
  "@rollup/rollup-linux-x64-gnu",
  "postcss",
         
  "react-refresh",
];

// ━━━ EXCLUSION RULES ━━━
const EXCLUDE_PATTERNS = [
  /\.map$/,                                // sourcemaps
  /\.d\.ts$/,                              // TypeScript declarations
  /\/test(s)?\/|__tests__|\.test\.|\.spec\.js$/,  // test files
  /\/docs?\/|\/examples?\/|\/example\//,   // documentation
  /^README|^CHANGELOG|^LICENSE|\.md$/,     // markdown/license
  /node_modules\/esbuild\/node_modules\/@esbuild\//, // native esbuild binaries
];

function shouldExclude(filePath) {
  for (const pattern of EXCLUDE_PATTERNS) {
    if (pattern.test(filePath)) return true;
  }
  return false;
}

// ━━━ BINARY DETECTION ━━━
function isBinaryFile(filePath) {
  if (filePath.endsWith(".wasm")) {
    return true;
  }
  // Only the esbuild executable is binary
  if (filePath.includes("@esbuild/linux-x64/bin/esbuild")) {
    return true;
  }
  // Everything else is text (JS, JSON, CSS, HTML, etc.)
  return false;
}

// ━━━ FILE COLLECTION ━━━
async function collectFiles(packageName) {
  const packagePath = path.join(NODE_MODULES, packageName);
  const files = new Map(); // Map<normalizedPath, buffer>

  async function walkDir(dir, relativePrefix) {
    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch (err) {
      console.warn(`  ⚠ Could not read directory: ${dir}`);
      return;
    }

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      const relativePath = path.posix.join(relativePrefix, entry.name);
      const normalizedPath = `node_modules/${packageName}/${relativePath}`.replace(/\\/g, "/");

      //DO NOT SKIP nested node_modules
      //They may contain required deps

      if (entry.isDirectory()) {
        await walkDir(fullPath, relativePath);
      } else {
        // Check exclusions
        if (shouldExclude(normalizedPath)) {
          continue;
        }

        try {
          const content = await readFile(fullPath);
          files.set(normalizedPath, content);
        } catch (err) {
          console.warn(`  ⚠ Could not read file: ${normalizedPath}`);
        }
      }
    }
  }

  console.log(`📦 Processing package: ${packageName}`);
  await walkDir(packagePath, "");
  console.log(`   ✓ Collected ${files.size} files`);

  return files;
}

// ━━━ BUILD SNAPSHOT ━━━
async function buildSnapshot() {
  console.log(`\n📂 Output: ${OUTPUT_FILE}\n`);

  // Ensure output directory exists
  await mkdir(OUTPUT_DIR, { recursive: true });

  // Collect files from all packages
  const allFiles = new Map();
  for (const packageName of SNAPSHOT_PACKAGES) {
    try {
      const files = await collectFiles(packageName);
      for (const [path, content] of files) {
        allFiles.set(path, content);
      }
    } catch (err) {
      console.error(`❌ Failed to collect package ${packageName}:`, err.message);
      process.exit(1);
    }
  }

  console.log(`\n📦 Total files collected: ${allFiles.size}\n`);

  // Build snapshot structure
  const filesObj = {};
  let totalBytes = 0;
  let binaryCount = 0;
  let textCount = 0;

  for (const [filePath, buffer] of allFiles) {
    const isBinary = isBinaryFile(filePath);

    if (isBinary) {
      // Convert binary to base64
      filesObj[filePath] = {
        type: "binary",
        content: buffer.toString("base64"),
      };
      binaryCount++;
      totalBytes += buffer.length;
    } else {
      // Keep text as UTF-8 string
      let text;
      try {
        text = buffer.toString("utf-8");
      } catch (err) {
        console.warn(`⚠ Failed to decode as UTF-8: ${filePath}`);
        continue;
      }

      filesObj[filePath] = {
        type: "text",
        content: text,
      };
      textCount++;
      totalBytes += buffer.length;
    }
  }

  const manifest = {
    version: 2,
    builtAt: new Date().toISOString(),
    platform: `${platform}-${arch}`,
    packages: SNAPSHOT_PACKAGES,
    fileCount: allFiles.size,
    textFileCount: textCount,
    binaryFileCount: binaryCount,
    files: filesObj,
  };

  // Write snapshot file
  const manifestJson = JSON.stringify(manifest);
  const manifestBuffer = Buffer.from(manifestJson, "utf-8");
  const manifestSizeMB = (manifestBuffer.length / 1024 / 1024).toFixed(2);

  await writeFile(OUTPUT_FILE, manifestJson, "utf-8");

  console.log(`✅ Snapshot written`);
  console.log(`   Files: ${allFiles.size} (${textCount} text, ${binaryCount} binary)`);
  console.log(`   Size: ${manifestSizeMB}MB\n`);

  if (manifestBuffer.length > 40 * 1024 * 1024) {
    console.warn(
      `⚠ Snapshot is large (${manifestSizeMB}MB, target <40MB)\n` +
      `  Consider adding more exclusion patterns.\n`
    );
  }

  // ━━━ VALIDATION ━━━
  console.log("🔍 Validation:\n");

  let validationPassed = true;

  // Check 1: Vite CLI exists
  if (!manifest.files["node_modules/vite/dist/node/cli.js"]) {
    console.error("❌ MISSING: node_modules/vite/dist/node/cli.js");
    validationPassed = false;
  } else {
    console.log("✓ Vite CLI found");
  }

  // Check 2: esbuild-wasm exists
  if (!manifest.files["node_modules/esbuild-wasm/esbuild.wasm"]) {
    console.error("❌ MISSING: node_modules/esbuild-wasm/esbuild.wasm");
    validationPassed = false;
  } else {
    const wasmEntry = manifest.files["node_modules/esbuild-wasm/esbuild.wasm"];
    if (wasmEntry.type !== "binary") {
      console.error("❌ esbuild.wasm is not binary encoded");
      validationPassed = false;
    } else {
      console.log("✓ esbuild-wasm found (base64 encoded)");
    }
  }

  // Check 3: No TypeScript declarations
  const dtsFiles = Object.keys(manifest.files).filter((f) => f.endsWith(".d.ts"));
  if (dtsFiles.length > 0) {
    console.error(`❌ Found ${dtsFiles.length} .d.ts files (should be 0)`);
    validationPassed = false;
  } else {
    console.log("✓ No TypeScript declarations");
  }

  // Check 4: No non-linux paths
  const nonLinuxPaths = Object.keys(manifest.files).filter(
    (f) => f.includes("win32") || f.includes("darwin")
  );
  if (nonLinuxPaths.length > 0) {
    console.error(`❌ Found ${nonLinuxPaths.length} non-Linux paths`);
    validationPassed = false;
  } else {
    console.log("✓ No non-Linux binaries");
  }

  // Check 5: JS files are NOT base64
  const jsFileCheck = Object.entries(manifest.files).find(
    ([path, entry]) =>
      (path.endsWith(".js") || path.endsWith(".mjs") || path.endsWith(".cjs")) &&
      entry.type === "binary"
  );
  if (jsFileCheck) {
    console.error(`❌ JS file is base64 encoded: ${jsFileCheck[0]}`);
    validationPassed = false;
  } else {
    console.log("✓ JavaScript files are UTF-8 text");
  }

  // Check 6: JSON files are NOT base64
  const jsonFileCheck = Object.entries(manifest.files).find(
    ([path, entry]) => path.endsWith(".json") && entry.type === "binary"
  );
  if (jsonFileCheck) {
    console.error(`❌ JSON file is base64 encoded: ${jsonFileCheck[0]}`);
    validationPassed = false;
  } else {
    console.log("✓ JSON files are UTF-8 text");
  }

  console.log();

  if (!validationPassed) {
    console.error("❌ Validation failed");
    process.exit(1);
  }

  console.log("✅ All validation checks passed\n");
}

// ━━━ EXECUTE ━━━
try {
  await buildSnapshot();
  console.log("🎉 Snapshot build complete\n");
} catch (err) {
  console.error("❌ Build failed:", err.message);
  process.exit(1);
}
