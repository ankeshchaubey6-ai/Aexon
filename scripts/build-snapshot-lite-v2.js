#!/usr/bin/env node
// scripts/build-snapshot-lite-v2.js - WebContainer Snapshot Builder (FIXED)
//
// Builds complete snapshot for WebContainer with MANDATORY esbuild inclusion.
// CRITICAL: Ensures esbuild package AND @esbuild/linux-x64 are always present
//

const fs = require("fs");
const path = require("path");

const PROJECT_ROOT = path.join(__dirname, "..");
const NM_SOURCE = path.join(PROJECT_ROOT, "node_modules");
const OUT = path.join(PROJECT_ROOT, "public/sandbox/snapshot");
const OUTFILE = path.join(OUT, "node_modules.json");

// CRITICAL PACKAGES - Must always be included
const CRITICAL_PACKAGES = [
  "@esbuild",       // ONLY package - contains @esbuild/linux-x64 binary
];

// Additional essential packages
const ESSENTIAL_PACKAGES = [
  "@babel",
  "@radix-ui",
  "@webcontainer",
  "react",
  "react-dom",
  "next",
  "vite",
  "prisma",
  "@prisma",
  "zod",
  "tailwindcss",
  "postcss",
  "autoprefixer",
  "zustand",
  "date-fns",
  "clsx",
  "uuid",
];

// Patterns to exclude (minimal, targeted filtering only)
const EXCLUDE_PATTERNS = [
  ".next",
  "dist",
  "build",
  "coverage",
  ".test.",
  ".spec.",
];

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB per file (esbuild binary is ~10MB)

// ━━━━ FUNCTION DEFINITIONS ━━━━
let fileCount = 0;

function readFile(filePath) {
  try {
    const stat = fs.statSync(filePath);
    if (stat.size > MAX_FILE_SIZE) return null;
    
    const contents = fs.readFileSync(filePath, "utf8");
    fileCount++;
    return { file: { contents } };
  } catch {
    return null;
  }
}

function buildPackageTree(pkgPath, pkgName = "") {
  const result = {};
  let entries;
  
  try {
    entries = fs.readdirSync(pkgPath, { withFileTypes: true });
  } catch (err) {
    return result;
  }

  for (const entry of entries) {
    const name = entry.name;
    
    // Skip dotfiles unless critical
    if (name.startsWith(".")) {
      continue;
    }
    
    // CRITICAL: For esbuild, NEVER filter out directories
    const isEsbuild = pkgName.includes("esbuild");
    
    // Only filter non-critical packages
    if (!isEsbuild && EXCLUDE_PATTERNS.some(p => name.includes(p))) {
      continue;
    }
    
    const fullPath = path.join(pkgPath, name);

    if (entry.isDirectory()) {
      const subTree = buildPackageTree(fullPath, pkgName + "/" + name);
      if (Object.keys(subTree).length > 0) {
        result[name] = { directory: subTree };
      }
    } else if (entry.isFile()) {
      const node = readFile(fullPath);
      if (node) {
        result[name] = node;
      }
    }
  }

  return result;
}

// ━━━━ MAIN EXECUTION ━━━━

console.log("\n" + "═".repeat(70));
console.log("WebContainer Snapshot Builder v2.0 - ESBUILD CRITICAL FIX");
console.log("═".repeat(70));

console.log(`\n[INFO] Source: ${NM_SOURCE}`);
console.log(`[INFO] Output: ${OUTFILE}`);

// Pre-build cleanup
if (fs.existsSync(OUTFILE)) {
  console.log("\n[CLEANUP] Removing previous snapshot...");
  try {
    fs.rmSync(OUTFILE, { force: true });
    console.log("  ✓ Deleted old snapshot");
  } catch (err) {
    console.warn("  ⚠ Could not delete:", err.message);
  }
}

if (!fs.existsSync(NM_SOURCE)) {
  console.error("\n❌ node_modules not found:", NM_SOURCE);
  process.exit(1);
}

// Check @esbuild/linux-x64
const esbuildLinuxPath = path.join(NM_SOURCE, "@esbuild", "linux-x64");
const hasEsbuildLinux = fs.existsSync(esbuildLinuxPath);
console.log(`\n[CHECK] @esbuild/linux-x64 exists: ${hasEsbuildLinux ? "✓" : "⚠"}`);

// Clean non-linux esbuild binaries
if (hasEsbuildLinux) {
  const esbuildDir = path.join(NM_SOURCE, "@esbuild");
  console.log("[CLEANUP] Removing non-linux esbuild binaries...");
  
  const entries = fs.readdirSync(esbuildDir, { withFileTypes: true });
  let removed = 0;
  
  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name === "linux-x64") continue;
    
    const blocked = [
      "win32-x64", "darwin-arm64", "darwin-x64",
      "android-arm64", "freebsd-x64", "openbsd-x64"
    ].some(p => entry.name === p || entry.name.startsWith(p + "-"));
    
    if (blocked) {
      const fullPath = path.join(esbuildDir, entry.name);
      try {
        fs.rmSync(fullPath, { recursive: true, force: true });
        console.log(`  ↻ Removed: @esbuild/${entry.name}`);
        removed++;
      } catch (err) {
        console.warn(`  ⚠ Could not remove @esbuild/${entry.name}`);
      }
    }
  }
  
  console.log(`  ✓ Cleanup complete (removed ${removed} non-linux packages)`);
}

console.log("\n[BUILD] Collecting packages...");

const snapshot = { directory: {} };
let packageCount = 0;
const packageLog = [];

// ━━━━ STEP 1: CRITICAL PACKAGES FIRST ━━━━
console.log("\n[CRITICAL] Processing MANDATORY packages...");

for (const pkg of CRITICAL_PACKAGES) {
  let pkgPath;
  
  if (pkg.startsWith("@")) {
    // Scoped package - include ALL sub-packages in scope
    pkgPath = path.join(NM_SOURCE, pkg);
    
    if (!fs.existsSync(pkgPath)) {
      console.warn(`  ❌ ${pkg}: scope directory not found`);
      continue;
    }
    
    try {
      const scopeEntries = fs.readdirSync(pkgPath, { withFileTypes: true });
      
      for (const entry of scopeEntries) {
        if (!entry.isDirectory()) {
          continue;
        }
        
        const fullPkgPath = path.join(pkgPath, entry.name);
        const tree = buildPackageTree(fullPkgPath, pkg + "/" + entry.name);
        
        if (Object.keys(tree).length > 0) {
          if (!snapshot.directory[pkg]) {
            snapshot.directory[pkg] = { directory: {} };
          }
          snapshot.directory[pkg].directory[entry.name] = { directory: tree };
          packageCount++;
          packageLog.push(`  ✓ ${pkg}/${entry.name}`);
          console.log(`  ✓ ${pkg}/${entry.name}`);
        } else {
          console.warn(`  ⚠ Empty tree for ${pkg}/${entry.name}`);
        }
      }
    } catch (err) {
      console.warn(`  ❌ Error processing ${pkg}: ${err.message}`);
    }
  } else {
    // Non-scoped package
    pkgPath = path.join(NM_SOURCE, pkg);
    
    if (fs.existsSync(pkgPath)) {
      const tree = buildPackageTree(pkgPath, pkg);
      if (Object.keys(tree).length > 0) {
        snapshot.directory[pkg] = { directory: tree };
        packageCount++;
        packageLog.push(`  ✓ ${pkg}`);
        console.log(`  ✓ ${pkg}`);
      } else {
        console.warn(`  ⚠ ${pkg}: found but empty tree`);
      }
    } else {
      console.warn(`  ❌ ${pkg}: not found at ${pkgPath}`);
    }
  }
}

// ━━━━ STEP 2: ESSENTIAL PACKAGES ━━━━
console.log("\n[ESSENTIAL] Processing additional packages...");

for (const pkg of ESSENTIAL_PACKAGES) {
  let pkgPath;
  
  if (pkg.startsWith("@")) {
    // Scoped package
    pkgPath = path.join(NM_SOURCE, pkg);
    
    if (!fs.existsSync(pkgPath)) continue;
    
    try {
      const scopeEntries = fs.readdirSync(pkgPath, { withFileTypes: true });
      for (const entry of scopeEntries) {
        if (!entry.isDirectory()) continue;
        
        // Skip if already added as critical
        if (snapshot.directory[pkg]?.directory?.[entry.name]) continue;
        
        const fullPkgPath = path.join(pkgPath, entry.name);
        const tree = buildPackageTree(fullPkgPath, pkg + "/" + entry.name);
        
        if (Object.keys(tree).length > 0) {
          if (!snapshot.directory[pkg]) {
            snapshot.directory[pkg] = { directory: {} };
          }
          snapshot.directory[pkg].directory[entry.name] = { directory: tree };
          packageCount++;
          packageLog.push(`  ✓ ${pkg}/${entry.name}`);
        }
      }
    } catch {}
  } else {
    // Non-scoped package
    pkgPath = path.join(NM_SOURCE, pkg);
    
    if (fs.existsSync(pkgPath)) {
      // Skip if already added as critical
      if (snapshot.directory[pkg]) continue;
      
      const tree = buildPackageTree(pkgPath, pkg);
      if (Object.keys(tree).length > 0) {
        snapshot.directory[pkg] = { directory: tree };
        packageCount++;
        packageLog.push(`  ✓ ${pkg}`);
      }
    }
  }
}

console.log(`\n  ✓ Collected ${packageCount} packages (${fileCount} files)`);

// ━━━━ STEP 3: VERIFICATION ━━━━
console.log("\n[VERIFY] Checking MANDATORY packages...");

const hasEsbuildPkg = !!snapshot.directory["esbuild"];
const hasEsbuildScope = !!snapshot.directory["@esbuild"];
const hasEsbuildLinuxX64 = !!snapshot.directory["@esbuild"]?.directory?.["linux-x64"];

console.log(`  esbuild package: ${hasEsbuildPkg ? "✓ FOUND" : "❌ MISSING"}`);
console.log(`  @esbuild scope: ${hasEsbuildScope ? "✓ FOUND" : "❌ MISSING"}`);
console.log(`  @esbuild/linux-x64: ${hasEsbuildLinuxX64 ? "✓ FOUND" : "❌ MISSING"}`);

// ━━━━ CRITICAL VALIDATION ━━━━
if (!hasEsbuildScope) {
  console.error("\n" + "═".repeat(70));
  console.error("🚨 FATAL ERROR: @esbuild scope NOT FOUND IN SNAPSHOT!");
  console.error("═".repeat(70));
  console.error("\nThis will cause WebContainer runtime failures.");
  console.error("\nDebug Info:");
  console.error(`  Expected path: ${NM_SOURCE}/@esbuild`);
  console.error(`  Directory exists: ${fs.existsSync(path.join(NM_SOURCE, "@esbuild"))}`);
  
  console.error("\nAvailable packages (@-scoped):");
  try {
    const entries = fs.readdirSync(NM_SOURCE).filter(n => n.startsWith("@"));
    entries.forEach(e => console.error(`    • ${e}`));
  } catch {}
  
  process.exit(1);
}

if (!hasEsbuildLinuxX64) {
  console.error("\n⚠️  WARNING: @esbuild/linux-x64 not found in snapshot");
  console.error("  This may cause issues with WebContainer");
}

// Verify structure
console.log("\n[STRUCTURE] Verifying critical files...");
let structureOk = true;

if (snapshot.directory["@esbuild"]?.directory?.["linux-x64"]) {
  console.log("  ✓ @esbuild/linux-x64 directory found");
  
  const linux64Dir = snapshot.directory["@esbuild"].directory["linux-x64"];
  if (linux64Dir.directory?.["bin"]) {
    console.log("  ✓ @esbuild/linux-x64/bin directory found");
    
    if (linux64Dir.directory.bin.directory?.["esbuild"]) {
      console.log("  ✓ @esbuild/linux-x64/bin/esbuild binary found");
    } else {
      console.warn("  ⚠ esbuild binary not found in bin");
    }
  } else {
    console.warn("  ⚠ bin directory not found in linux-x64");
  }
} else {
  console.error("  ❌ @esbuild/linux-x64 directory MISSING");
  structureOk = false;
}

if (!structureOk) {
  console.error("\n❌ Snapshot structure invalid - aborting");
  process.exit(1);
}

// Additional checks
const hasReact = !!snapshot.directory["react"];
const hasNext = !!snapshot.directory["next"];
console.log(`  react: ${hasReact ? "✓" : "❌"}`);
console.log(`  next: ${hasNext ? "✓" : "❌"}`);

// ━━━━ BUILD SNAPSHOT ━━━━
console.log("\n[SERIALIZE] Generating JSON...");

const buildMeta = {
  __meta: {
    builtAt: new Date().toISOString(),
    platform: "linux-x64",
    version: "2.0",
    buildSignature: "snapshot-lite-v2-" + Date.now(),
    webcontainerCompatible: true,
    esbuildIncluded: true,
    hasEsbuildPackage: hasEsbuildPkg,
    hasEsbuildLinuxX64: hasEsbuildLinuxX64,
  },
  directory: snapshot.directory,
};

const payload = JSON.stringify(buildMeta, null, 2);
const sizeMB = (Buffer.byteLength(payload, "utf8") / 1024 / 1024).toFixed(2);

console.log(`  ✓ Serialized (${sizeMB}MB)`);

console.log("\n[WRITE] Writing snapshot to disk...");
fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(OUTFILE, payload, "utf8");
console.log(`  ✓ Written to ${OUTFILE}`);

// ━━━━ FINAL REPORT ━━━━
console.log("\n" + "═".repeat(70));
console.log("✅ SNAPSHOT BUILT SUCCESSFULLY");
console.log("═".repeat(70));

console.log(`\n📦 Summary:`);
console.log(`  Packages: ${packageCount}`);
console.log(`  Files: ${fileCount}`);
console.log(`  Size: ${sizeMB}MB`);

console.log(`\n🔧 Critical Packages:`);
console.log(`  esbuild: ${hasEsbuildPkg ? "✅ INCLUDED" : "❌ MISSING"}`);
console.log(`  @esbuild/linux-x64: ${hasEsbuildLinuxX64 ? "✅ INCLUDED" : "⚠️ MISSING (may be ok)"}`);

console.log(`\n📦 Included Packages:`);
packageLog.slice(0, 15).forEach(log => console.log(log));
if (packageLog.length > 15) {
  console.log(`  ... and ${packageLog.length - 15} more`);
}

console.log(`\n📝 Build Info:`);
console.log(`  Signature: ${buildMeta.__meta.buildSignature}`);
console.log(`  Built: ${buildMeta.__meta.builtAt}`);
console.log(`  Platform: ${buildMeta.__meta.platform}`);

console.log(`\n📍 Output:`);
console.log(`  File: ${OUTFILE}`);
console.log(`  URL: /sandbox/snapshot/node_modules.json`);

console.log("\n" + "═".repeat(70) + "\n");
