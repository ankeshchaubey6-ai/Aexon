#!/usr/bin/env node
// scripts/build-snapshot-full.js v3.0 - WebContainer Snapshot with Full Dependency Graph
//
// Builds complete snapshot including ALL transitive dependencies required by essential packages.
// Uses dependency graph traversal instead of fixed whitelist
//

const fs = require("fs");
const path = require("path");

const PROJECT_ROOT = path.join(__dirname, "..");
const NM_SOURCE = path.join(PROJECT_ROOT, "node_modules");
const OUT = path.join(PROJECT_ROOT, "public/sandbox/snapshot");
const OUTFILE = path.join(OUT, "node_modules.json");

// SEED PACKAGES - Entry points for dependency traversal
const SEED_PACKAGES = [
  "vite",           // ⭐ CRITICAL - Was missing
  "react",
  "react-dom",
  "next",
  "@esbuild",
  "@babel",
  "esbuild",
  "prisma",
];

// Excluded patterns (minimal - only truly unnecessary)
const EXCLUDE_PATTERNS = [
  ".next",
  ".cache",
  "dist",
  "build",
  "coverage",
  ".test.",
  ".spec.",
  "example",
  "examples",
  "demo",
  "test",
  "tests",
  "__tests__",
];

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB per file

// ━━━━ FUNCTION DEFINITIONS ━━━━

let fileCount = 0;
let dependencyCount = 0;
const processedPackages = new Set();
const snapshotPackages = new Set();

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
  } catch {
    return result;
  }

  for (const entry of entries) {
    const name = entry.name;
    
    // Skip dotfiles
    if (name.startsWith(".")) continue;
    
    // Only filter non-critical packages
    if (!EXCLUDE_PATTERNS.some(p => name.includes(p))) {
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
  }

  return result;
}

// Read package.json and extract dependencies
function getDependencies(pkgPath) {
  try {
    const pkgJsonPath = path.join(pkgPath, "package.json");
    if (!fs.existsSync(pkgJsonPath)) return [];
    
    const pkgJson = JSON.parse(fs.readFileSync(pkgJsonPath, "utf8"));
    const deps = [];
    
    // Get all dependency types
    if (pkgJson.dependencies) {
      deps.push(...Object.keys(pkgJson.dependencies));
    }
    if (pkgJson.optionalDependencies) {
      deps.push(...Object.keys(pkgJson.optionalDependencies));
    }
    // Skip peerDependencies - they're expected to be installed by parent
    
    return deps;
  } catch {
    return [];
  }
}

// Recursively collect all dependencies
function collectDependencies(pkgName, nmDir, depth = 0) {
  if (processedPackages.has(pkgName) || depth > 10) return; // Prevent infinite loops
  
  processedPackages.add(pkgName);
  
  let pkgPath;
  
  if (pkgName.startsWith("@")) {
    // Scoped package - shouldn't happen here, but handle it
    return;
  }
  
  pkgPath = path.join(nmDir, pkgName);
  
  if (!fs.existsSync(pkgPath)) {
    return;
  }
  
  // Get dependencies of this package
  const deps = getDependencies(pkgPath);
  
  for (const dep of deps) {
    // Check if it's scoped
    if (dep.startsWith("@")) {
      const [scope, name] = dep.split("/");
      const scopePath = path.join(nmDir, scope);
      
      if (fs.existsSync(scopePath)) {
        const namePath = path.join(scopePath, name);
        if (fs.existsSync(namePath) && !processedPackages.has(dep)) {
          snapshotPackages.add(dep);
          collectDependencies(dep, nmDir, depth + 1);
        }
      }
    } else {
      const depPath = path.join(nmDir, dep);
      if (fs.existsSync(depPath) && !processedPackages.has(dep)) {
        snapshotPackages.add(dep);
        collectDependencies(dep, nmDir, depth + 1);
      }
    }
  }
}

// ━━━━ MAIN EXECUTION ━━━━

console.log("\n" + "═".repeat(70));
console.log("WebContainer Snapshot Builder v3.0 - FULL DEPENDENCY GRAPH");
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

// Clean non-linux esbuild if present
const esbuildDir = path.join(NM_SOURCE, "@esbuild");
if (fs.existsSync(esbuildDir)) {
  console.log("\n[CLEANUP] Removing non-linux esbuild binaries...");
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

// ━━━━ BUILD DEPENDENCY GRAPH ━━━━
console.log("\n[DEPEND] Building complete dependency graph...");

// Add seed packages
for (const pkg of SEED_PACKAGES) {
  snapshotPackages.add(pkg);
}

console.log(`\n[TRAVERSE] Traversing dependency tree (seed: ${SEED_PACKAGES.length} packages)...`);

// Recursively collect dependencies for seed packages
for (const pkg of SEED_PACKAGES) {
  collectDependencies(pkg, NM_SOURCE, 0);
}

console.log(`\n[DEPEND] Collected ${snapshotPackages.size} total packages`);

// ━━━━ BUILD SNAPSHOT ━━━━
console.log("\n[BUILD] Building snapshot...");

const snapshot = { directory: {} };
let packageCount = 0;
const packageLog = [];

for (const pkg of snapshotPackages) {
  let pkgPath;
  
  if (pkg.startsWith("@")) {
    // Scoped package
    const parts = pkg.split("/");
    if (parts.length < 2) {
      console.warn(`  ⚠ Invalid scoped package name: ${pkg}`);
      continue;
    }
    
    const scope = parts[0];
    const name = parts.slice(1).join("/");
    pkgPath = path.join(NM_SOURCE, scope, name);
    
    if (fs.existsSync(pkgPath)) {
      const tree = buildPackageTree(pkgPath, pkg);
      
      if (Object.keys(tree).length > 0) {
        if (!snapshot.directory[scope]) {
          snapshot.directory[scope] = { directory: {} };
        }
        snapshot.directory[scope].directory[name] = { directory: tree };
        packageCount++;
        packageLog.push(`  ✓ ${pkg}`);
        console.log(`  ✓ ${pkg}`);
      }
    } else {
      console.warn(`  ⚠ ${pkg}: not found at ${pkgPath}`);
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
      }
    } else {
      console.warn(`  ⚠ ${pkg}: not found at ${pkgPath}`);
    }
  }
}

// ━━━━ INCLUDE .bin FOLDER ━━━━
console.log("\n[BIN] Including .bin executables...");
const binPath = path.join(NM_SOURCE, ".bin");
if (fs.existsSync(binPath)) {
  const binTree = buildPackageTree(binPath, ".bin");
  if (Object.keys(binTree).length > 0) {
    snapshot.directory[".bin"] = { directory: binTree };
    console.log(`  ✓ .bin folder included (${Object.keys(binTree).length} executables)`);
  }
}

// ━━━━ DOWNLOAD AND INCLUDE LINUX-X64 ESBUILD ━━━━
console.log("\n[ESBUILD] Handling @esbuild/linux-x64 for WebContainer...");

// Get esbuild version from vite or package.json
const vitePackageJson = path.join(NM_SOURCE, "vite", "package.json");
let esbuildVersion = "0.28.0"; // fallback

if (fs.existsSync(vitePackageJson)) {
  try {
    const vitePkg = JSON.parse(fs.readFileSync(vitePackageJson, "utf-8"));
    if (vitePkg.dependencies?.esbuild) {
      esbuildVersion = vitePkg.dependencies.esbuild.replace("^", "");
    }
  } catch (e) {
    // Use fallback
  }
}

console.log(`  ℹ esbuild version for snapshot: ${esbuildVersion}`);
console.log("  ℹ @esbuild/linux-x64 must be embedded with vite in WebContainer");
console.log("    (npm will fetch it automatically on first WebContainer run)");

// Try to include from local node_modules if it exists (backup)
const esbuildPath = path.join(NM_SOURCE, "@esbuild");
if (fs.existsSync(esbuildPath)) {
  const directories = fs.readdirSync(esbuildPath);
  if (directories.includes("linux-x64")) {
    const linuxPath = path.join(esbuildPath, "linux-x64");
    const tree = buildPackageTree(linuxPath, "@esbuild/linux-x64");
    if (Object.keys(tree).length > 0) {
      if (!snapshot.directory["@esbuild"]) {
        snapshot.directory["@esbuild"] = { directory: {} };
      }
      snapshot.directory["@esbuild"].directory["linux-x64"] = { directory: tree };
      console.log("  ✓ @esbuild/linux-x64 from local node_modules");
    }
  }
}

// Include @babel packages found
const babelPath = path.join(NM_SOURCE, "@babel");
if (fs.existsSync(babelPath)) {
  const entries = fs.readdirSync(babelPath, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    
    const pkgPath = path.join(babelPath, entry.name);
    const tree = buildPackageTree(pkgPath, `@babel/${entry.name}`);
    
    if (Object.keys(tree).length > 0) {
      if (!snapshot.directory["@babel"]) {
        snapshot.directory["@babel"] = { directory: {} };
      }
      snapshot.directory["@babel"].directory[entry.name] = { directory: tree };
      console.log(`  ✓ @babel/${entry.name}`);
    }
  }
}

// ━━━━ VERIFICATION ━━━━
console.log("\n[VERIFY] Checking CRITICAL packages...");

const hasVite = !!snapshot.directory["vite"];
const hasViteBin = !!snapshot.directory[".bin"]?.directory?.["vite"];
const hasEsbuild = !!snapshot.directory["@esbuild"]?.directory?.["linux-x64"];
const hasReact = !!snapshot.directory["react"];
const hasNext = !!snapshot.directory["next"];

console.log(`  vite package: ${hasVite ? "✅ FOUND" : "❌ MISSING"}`);
console.log(`  .bin/vite: ${hasViteBin ? "✅ FOUND" : "❌ MISSING"}`);
console.log(`  @esbuild/linux-x64: ${hasEsbuild ? "✅ FOUND" : "⚠ OPTIONAL"}`);
console.log(`  react: ${hasReact ? "✅ FOUND" : "❌ MISSING"}`);
console.log(`  next: ${hasNext ? "✅ FOUND" : "⚠ OPTIONAL"}`);

// CRITICAL VALIDATIONS
if (!hasVite) {
  console.error("\n" + "═".repeat(70));
  console.error("🚨 FATAL ERROR: vite package NOT FOUND IN SNAPSHOT!");
  console.error("═".repeat(70));
  console.error("\nThis will cause Vite dev server failures.");
  console.error(`\nExpected: ${NM_SOURCE}/vite`);
  console.error(`Exists: ${fs.existsSync(path.join(NM_SOURCE, "vite"))}`);
  process.exit(1);
}

if (!hasViteBin) {
  console.error("\n" + "═".repeat(70));
  console.error("🚨 FATAL ERROR: .bin/vite executable NOT FOUND IN SNAPSHOT!");
  console.error("═".repeat(70));
  console.error("\nVite cannot run without the executable.");
  process.exit(1);
}

// ━━━━ SERIALIZE ━━━━
console.log("\n[SERIALIZE] Generating JSON...");

const buildMeta = {
  __meta: {
    builtAt: new Date().toISOString(),
    platform: "linux-x64",
    version: "3.0",
    buildSignature: "snapshot-full-v3-" + Date.now(),
    webcontainerCompatible: true,
    hasVite: hasVite,
    hasEsbuild: hasEsbuild,
    totalPackages: packageCount,
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
console.log(`  Total Packages: ${packageCount}`);
console.log(`  Total Files: ${fileCount}`);
console.log(`  Size: ${sizeMB}MB`);
console.log(`  Dependencies Resolved: ${snapshotPackages.size}`);

console.log(`\n🔧 Critical Packages:`);
console.log(`  vite: ${hasVite ? "✅ INCLUDED" : "❌ MISSING"}`);
console.log(`  .bin/vite: ${hasViteBin ? "✅ INCLUDED" : "❌ MISSING"}`);
console.log(`  @esbuild/linux-x64: ${hasEsbuild ? "✅ INCLUDED" : "⚠️ NOT FOUND"}`);

console.log(`\n📝 Build Info:`);
console.log(`  Signature: ${buildMeta.__meta.buildSignature}`);
console.log(`  Built: ${buildMeta.__meta.builtAt}`);
console.log(`  Platform: ${buildMeta.__meta.platform}`);

console.log(`\n🎯 Seed Packages (${SEED_PACKAGES.length}):`);
SEED_PACKAGES.forEach(p => console.log(`  • ${p}`));

console.log(`\n📍 Output:`);
console.log(`  File: ${OUTFILE}`);
console.log(`  URL: /sandbox/snapshot/node_modules.json`);

console.log("\n" + "═".repeat(70) + "\n");
