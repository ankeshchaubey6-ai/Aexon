// scripts/build-snapshot.js v4.0
// Ensures both @rollup/rollup-linux-x64-musl AND @esbuild/linux-x64
// are present in the snapshot, regardless of build OS.

const fs           = require("fs");
const path         = require("path");
const { execSync } = require("child_process");

const BASE    = path.join(__dirname, "../sandbox-templates/vite-react-base");
const OUT     = path.join(__dirname, "../public/sandbox/snapshot");
const OUTFILE = path.join(OUT, "node_modules.json");
const MAX_FILE_BYTES = 5 * 1024 * 1024;

const BINARY_EXTS = new Set([".node",".wasm",".png",".jpg",".jpeg",".gif",".ico",".ttf",".woff",".woff2",".eot"]);
const SKIP_DIRS   = new Set([".cache",".git","test","tests","__tests__","__mocks__","coverage","nyc_output","docs","doc","documentation","examples","example","demo","demos","bench","benchmark","benchmarks"]);
const SKIP_FILES  = new Set(["LICENSE","LICENSE.md","license","LICENSE.txt","CHANGELOG.md","CHANGELOG","changelog.md","CONTRIBUTING.md","AUTHORS","NOTICE","README.md","readme.md","Readme.md",".npmignore",".eslintrc",".eslintrc.js",".eslintrc.json",".prettierrc",".editorconfig",".travis.yml"]);

let fileCount=0, skipCount=0, errorCount=0;

function readVer(dir) { return JSON.parse(fs.readFileSync(path.join(dir,"package.json"),"utf8")).version; }

function ensureLinuxPkg(nmDir, scope, pkgName, matchPkgDir, label) {
  if (!fs.existsSync(path.join(nmDir, matchPkgDir, "package.json"))) {
    console.warn(`[${label}] base package not found — skipping`); return null;
  }
  const ver = readVer(path.join(nmDir, matchPkgDir));
  const target = path.join(nmDir, scope, pkgName);
  const fullPkg = `${scope}/${pkgName}@${ver}`;
  console.log(`[${label}] version: ${ver}`);
  if (fs.existsSync(path.join(target,"package.json")) && readVer(target)===ver) {
    console.log(`[${label}] ✓ ${fullPkg} already present`); return ver;
  }
  console.log(`[${label}] Installing ${fullPkg}…`);
  execSync(`npm install ${fullPkg} --force --ignore-scripts --no-save --legacy-peer-deps`, {cwd:BASE, stdio:"inherit"});
  if (!fs.existsSync(path.join(target,"package.json"))) throw new Error(`[${label}] install failed — package.json missing`);
  const got = readVer(target);
  if (got!==ver) throw new Error(`[${label}] version mismatch: got ${got}, expected ${ver}`);
  console.log(`[${label}] ✓ ${fullPkg} installed`);
  return ver;
}

function readFileNode(fullPath, name) {
  let stat; try { stat=fs.statSync(fullPath); } catch { skipCount++; return null; }
  if (!stat.isFile()) { skipCount++; return null; }
  if (stat.size===0)  { fileCount++; return {file:{contents:""}}; }
  if (stat.size>MAX_FILE_BYTES) { skipCount++; return null; }
  const ext=path.extname(name).toLowerCase();
  try {
    if (BINARY_EXTS.has(ext)) {
      const buf=fs.readFileSync(fullPath); if (!buf||!buf.length) { skipCount++; return null; }
      fileCount++; return {file:{contents:buf.toString("base64"),encoding:"base64"}};
    } else {
      const c=fs.readFileSync(fullPath,"utf8"); if (typeof c!=="string") { skipCount++; return null; }
      fileCount++; return {file:{contents:c}};
    }
  } catch { errorCount++; return null; }
}

function buildTree(dir) {
  const result={}; let entries;
  try { entries=fs.readdirSync(dir,{withFileTypes:true}); } catch { return result; }
  for (const entry of entries) {
    const {name}=entry;
    if (!name||SKIP_DIRS.has(name)||SKIP_FILES.has(name)||name==="__proto__"||name==="constructor"||name==="prototype") { skipCount++; continue; }
    const fp=path.join(dir,name);
    if (entry.isSymbolicLink()) {
      try { const r=fs.realpathSync(fp); if (fs.statSync(r).isFile()) { const n=readFileNode(r,name); if(n)result[name]=n; } } catch { skipCount++; }
      continue;
    }
    if (entry.isDirectory()) {
      const sub=buildTree(fp); const clean={};
      for (const [k,v] of Object.entries(sub)) if (v&&typeof v==="object"&&!Array.isArray(v)&&("file"in v||"directory"in v)) clean[k]=v;
      if (Object.keys(clean).length>0) result[name]={directory:clean};
      continue;
    }
    if (entry.isFile()) { const n=readFileNode(fp,name); if(n)result[name]=n; }
  }
  return result;
}

function validateTree(node,p) {
  if (!node||typeof node!=="object"||Array.isArray(node)) throw new Error(`[INVALID] not an object at: ${p}`);
  if ("file"in node) { if (typeof node.file.contents!=="string") throw new Error(`[INVALID] contents not string at: ${p}`); return; }
  if ("directory"in node) { for (const [k,v] of Object.entries(node.directory)) validateTree(v,`${p}/${k}`); return; }
  throw new Error(`[INVALID] no file/directory at: ${p}`);
}

function verifyInTree(tree,scope,pkg,ver,label) {
  const s=tree[scope]; if (!s||!("directory"in s)) throw new Error(`FAIL: ${scope} missing (${label})`);
  const p=(s.directory||{})[pkg]; if (!p||!("directory"in p)) throw new Error(`FAIL: ${scope}/${pkg} missing (${label})`);
  console.log(`  ✓ ${scope}/${pkg} present`);
  const pj=(p.directory||{})["package.json"];
  if (pj&&"file"in pj&&ver) { const m=JSON.parse(pj.file.contents); if (m.version!==ver) throw new Error(`FAIL: ${scope}/${pkg} version ${m.version}!=${ver}`); console.log(`  ✓ version matches ${ver}`); }
}

// ── MAIN ─────────────────────────────────────────────────────────────────────
console.log("━━━ WebContainer Snapshot Builder v4.0 ━━━");
const nmDir=path.join(BASE,"node_modules");
if (!fs.existsSync(nmDir)) { console.error(`❌ node_modules not found\n   cd sandbox-templates/vite-react-base && npm install`); process.exit(1); }

console.log("\nStep 0a: Ensuring @rollup/rollup-linux-x64-musl...");
let rollupVer;
try { rollupVer=ensureLinuxPkg(nmDir,"@rollup","rollup-linux-x64-musl","rollup","musl"); }
catch(e) { console.error("❌",e.message); process.exit(1); }

console.log("\nStep 0b: Ensuring @esbuild/linux-x64...");
let esbuildVer;
try { esbuildVer=ensureLinuxPkg(nmDir,"@esbuild","linux-x64","esbuild","esbuild-linux"); }
catch(e) { console.error("❌",e.message); process.exit(1); }

console.log("\nStep 1: Building file tree...");
const t0=Date.now(); const tree=buildTree(nmDir);
console.log(`  Packages: ${Object.keys(tree).length}  Files: ${fileCount}  Skipped: ${skipCount}  Errors: ${errorCount}  Time: ${((Date.now()-t0)/1000).toFixed(1)}s`);
if (!Object.keys(tree).length) { console.error("❌ Empty tree"); process.exit(1); }

console.log("\nStep 2: Validating...");
let errs=0;
for (const [k,v] of Object.entries(tree)) { try { validateTree(v,`node_modules/${k}`); } catch(e) { console.error(" ✗",e.message); errs++; } }
if (errs) { console.error(`❌ ${errs} errors`); process.exit(1); }
console.log("  ✓ All valid");

console.log("\nStep 3: Integrity checks...");
try { verifyInTree(tree,"@rollup","rollup-linux-x64-musl",rollupVer,"rollup"); } catch(e) { console.error("❌",e.message); process.exit(1); }
if (esbuildVer) { try { verifyInTree(tree,"@esbuild","linux-x64",esbuildVer,"esbuild"); } catch(e) { console.error("❌",e.message); process.exit(1); } }

console.log("\nStep 4: Writing JSON...");
fs.mkdirSync(OUT,{recursive:true});
fs.writeFileSync(OUTFILE, JSON.stringify({node_modules:{directory:tree}}));
const sz=(fs.statSync(OUTFILE).size/1024/1024).toFixed(1);
console.log(`\n✅ Done — ${OUTFILE} (${sz}MB, ${Object.keys(tree).length} packages, ${fileCount} files)`);
if (parseFloat(sz)>50) console.warn(`⚠️  ${sz}MB snapshot — consider CDN hosting`);