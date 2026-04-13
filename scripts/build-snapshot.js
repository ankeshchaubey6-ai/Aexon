#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

const PROJECT_ROOT = path.join(__dirname, "..");
const NM_SOURCE = path.join(PROJECT_ROOT, "node_modules");
const SNAPSHOT_DIR = path.join(PROJECT_ROOT, "public", "snapshot");

console.log("\n═══════════════════════════════════════════════════════════════");
console.log("WebContainer Snapshot Builder v10.0 - STREAMING CHUNKED OUTPUT");
console.log("═══════════════════════════════════════════════════════════════\n");

if (process.platform !== "linux" || process.arch !== "x64") {
  throw new Error(`FATAL: Must build on linux-x64. Got ${process.platform}-${process.arch}`);
}
console.log(`[PLATFORM] ✓ linux-x64\n`);

if (!fs.existsSync(NM_SOURCE)) throw new Error(`FATAL: node_modules not found`);
if (!fs.existsSync(SNAPSHOT_DIR)) fs.mkdirSync(SNAPSHOT_DIR, { recursive: true });

// Clean old chunks
for (const f of fs.readdirSync(SNAPSHOT_DIR)) {
  if (f === "manifest.json" || f.startsWith("chunk-")) {
    fs.rmSync(path.join(SNAPSHOT_DIR, f));
  }
}

// STEP 1: Walk node_modules
console.log("[STEP 1] Walking node_modules...");
const allFiles = {};
let fileCount = 0;

function walkDir(dir, rel = "") {
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    const relPath = rel ? `${rel}/${entry.name}` : entry.name;
    try {
      if (entry.isDirectory()) {
        walkDir(fullPath, relPath);
      } else if (entry.isFile() || entry.isSymbolicLink()) {
        const realPath = entry.isSymbolicLink() ? fs.realpathSync(fullPath) : fullPath;
        const stat = fs.statSync(realPath);
        if (stat.isFile() && stat.size < 50 * 1024 * 1024) {
          const buf = fs.readFileSync(realPath);
          allFiles[`node_modules/${relPath}`] = buf.toString("base64");
          fileCount++;
          if (fileCount % 5000 === 0) console.log(`  ... ${fileCount} files`);
        }
      }
    } catch { }
  }
}

walkDir(NM_SOURCE);
console.log(`  ✓ ${fileCount} files collected\n`);

// STEP 2: Validate esbuild
console.log("[STEP 2] Validating esbuild binary...");
const esbuildKey = "node_modules/@esbuild/linux-x64/bin/esbuild";
if (!allFiles[esbuildKey]) {
  throw new Error("FATAL: @esbuild/linux-x64/bin/esbuild missing. Run: npm install @esbuild/linux-x64 --save-optional");
}
console.log("  ✓ esbuild binary present\n");

// STEP 3: Check for actual non-linux binaries (.node files in platform dirs)
console.log("[STEP 3] Checking for non-Linux binaries...");
const BLOCKED_DIRS = ["win32-x64", "win32-ia32", "win32-arm64", "darwin-x64", "darwin-arm64"];
for (const filePath of Object.keys(allFiles)) {
  const ext = path.extname(filePath).toLowerCase();
  if ([".node", ".exe", ".dll"].includes(ext)) {
    if (BLOCKED_DIRS.some(d => filePath.includes(`/${d}/`))) {
      throw new Error(`FATAL: Non-linux binary: ${filePath}`);
    }
  }
}
console.log("  ✓ No non-Linux binaries\n");

// STEP 4: Split into chunks
console.log("[STEP 4] Splitting into chunks...");
const esbuildChunk = {};
const coreChunk = {};
const deps1Chunk = {};
const deps2Chunk = {};

const CORE_PREFIXES = [
  "node_modules/vite/",
  "node_modules/react/",
  "node_modules/react-dom/",
  "node_modules/@vitejs/",
  "node_modules/rollup/",
  "node_modules/@rollup/",
];

const allKeys = Object.keys(allFiles);
let depsKeys = [];

for (const k of allKeys) {
  if (k.includes("@esbuild/linux-x64")) {
    esbuildChunk[k] = allFiles[k];
  } else if (CORE_PREFIXES.some(p => k.startsWith(p))) {
    coreChunk[k] = allFiles[k];
  } else {
    depsKeys.push(k);
  }
}

// Split deps in half
const mid = Math.floor(depsKeys.length / 2);
for (let i = 0; i < mid; i++) deps1Chunk[depsKeys[i]] = allFiles[depsKeys[i]];
for (let i = mid; i < depsKeys.length; i++) deps2Chunk[depsKeys[i]] = allFiles[depsKeys[i]];

console.log(`  chunk-esbuild: ${Object.keys(esbuildChunk).length} files`);
console.log(`  chunk-core: ${Object.keys(coreChunk).length} files`);
console.log(`  chunk-deps: ${Object.keys(deps1Chunk).length} files`);
console.log(`  chunk-deps-2: ${Object.keys(deps2Chunk).length} files\n`);

// STEP 5: Stream write chunks
console.log("[STEP 5] Writing chunks...");

function writeChunkStreaming(name, obj) {
  const filePath = path.join(SNAPSHOT_DIR, `${name}.json`);
  const stream = fs.createWriteStream(filePath);
  const keys = Object.keys(obj);
  stream.write("{");
  for (let i = 0; i < keys.length; i++) {
    stream.write(JSON.stringify(keys[i]) + ":" + JSON.stringify(obj[keys[i]]));
    if (i < keys.length - 1) stream.write(",");
  }
  stream.write("}");
  stream.end();
  return new Promise((resolve, reject) => {
    stream.on("finish", () => {
      const mb = (fs.statSync(filePath).size / 1024 / 1024).toFixed(2);
      console.log(`  ✓ ${name}.json: ${mb}MB`);
      resolve(mb);
    });
    stream.on("error", reject);
  });
}

async function main() {
  await writeChunkStreaming("chunk-esbuild", esbuildChunk);
  await writeChunkStreaming("chunk-core", coreChunk);
  await writeChunkStreaming("chunk-deps", deps1Chunk);
  await writeChunkStreaming("chunk-deps-2", deps2Chunk);

  // Validate esbuild chunk
  const esbuildChunkPath = path.join(SNAPSHOT_DIR, "chunk-esbuild.json");
  const esbuildSizeMB = fs.statSync(esbuildChunkPath).size / 1024 / 1024;
  if (esbuildSizeMB < 10) {
    throw new Error(`FATAL: chunk-esbuild.json too small: ${esbuildSizeMB.toFixed(2)}MB`);
  }
  console.log(`\n  ✓ esbuild chunk size OK: ${esbuildSizeMB.toFixed(2)}MB`);

  // Write manifest
  const manifest = {
    version: 1,
    builtAt: new Date().toISOString(),
    chunks: ["chunk-esbuild", "chunk-core", "chunk-deps", "chunk-deps-2"],
    criticalChunks: ["chunk-esbuild", "chunk-core"],
    validation: {
      esbuildBinaryPresent: true,
      totalFiles: fileCount,
      totalChunks: 4
    }
  };
  fs.writeFileSync(path.join(SNAPSHOT_DIR, "manifest.json"), JSON.stringify(manifest, null, 2));

  console.log("\n═══════════════════════════════════════════════════════════════");
  console.log("✅ SNAPSHOT BUILT SUCCESSFULLY");
  console.log("═══════════════════════════════════════════════════════════════");
  console.log(`Total files: ${fileCount}`);
  console.log(`Output: ${SNAPSHOT_DIR}\n`);
}

main().catch(e => { console.error("FATAL:", e.message); process.exit(1); });
