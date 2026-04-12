// src/components/modules/ai-builder/state/use-webcontainer.ts
// v37.0 — Fix: child.unref is not a function — fakeChild() now implements
//           every method esbuild's ensureServiceIsRunning() calls post-spawn:
//           unref(), stdin.write(), stdin.on('close'), stdout.on('data'),
//           stderr.on('data'), on('exit'), on('error').
// v37.1 — Fix: Vite config written as .mjs, avoiding esbuild bundling entirely.
// v37.2 — Fix: Patch Vite's bundleConfigFile directly to skip esbuild.
// v37.3 — Fix: Improved Vite chunk finder using ls and candidate list.
// v37.4 — Fix: Add Babel build-external-helpers stub to resolve missing module.

import { useState, useCallback, useEffect } from "react";
import { WebContainer } from "@webcontainer/api";
import type { FileSystemTree } from "@webcontainer/api";

// ─── Types ────────────────────────────────────────────────────────────────────

type AIFile = { path: string; content: string };

export type WCStatus =
  | "idle"
  | "waiting-files"
  | "booting"
  | "mounting"
  | "loading-snapshot"
  | "installing"
  | "install-failed"
  | "starting"
  | "writing"
  | "restarting"
  | "running"
  | "error";

// ─── Config ───────────────────────────────────────────────────────────────────

const SNAPSHOT_URL = "/sandbox/snapshot/node_modules.json";

const FALLBACK_PACKAGES = [
  "react@18.2.0",
  "react-dom@18.2.0",
  "vite@5.2.6",
  "@vitejs/plugin-react@4.2.1",
];

const VITE_TIMEOUT_MS = 60_000;

// ─── Global singleton state ───────────────────────────────────────────────────

let _instance: WebContainer | null = null;
let _bootPromise: Promise<WebContainer> | null = null;
let _globalStatus: WCStatus = "idle";
let _globalUrl: string | null = null;
let _devProcess: Awaited<ReturnType<WebContainer["spawn"]>> | null = null;

let _snapshotLoaded    = false;
let _snapshotCache: Record<string, unknown> | null = null;
let _fallbackInstalled = false;
let _rollupPatched     = false;
let _esbuildPatched    = false;
let _babelPatched      = false;
let _viteConfigPatched = false;

let _busy      = false;
let _pendingFn: (() => Promise<void>) | null = null;
let _bootAttempted = false;

const _listeners = new Set<() => void>();
function _notify()                 { _listeners.forEach((fn) => fn()); }
function _setStatus(s: WCStatus)   { _globalStatus = s; _notify(); }
function _setUrl(u: string | null) { _globalUrl = u; _notify(); }

// ─── Public reset ─────────────────────────────────────────────────────────────

export function resetContainer() {
  if (_devProcess) {
    try { _devProcess.kill(); } catch { /* ignore */ }
    _devProcess = null;
  }
  _busy      = false;
  _pendingFn = null;
  _setStatus("idle");
}

// ─── Boot singleton ───────────────────────────────────────────────────────────

async function bootOnce(): Promise<WebContainer> {
  if (_instance) return _instance;
  if (_bootPromise) return _bootPromise;
  if (_bootAttempted) {
    throw new Error("WebContainer boot already failed. Reload the page to try again.");
  }

  console.log("[WC] Booting WebContainer...");
  _bootAttempted = true;

  _bootPromise = WebContainer.boot()
    .then((wc) => {
      _instance = wc;
      _bootPromise = null;
      console.log("[WC] Boot complete");
      return wc;
    })
    .catch((err) => {
      _bootPromise = null;
      const msg = err instanceof Error ? err.message : String(err);
      if (
        msg.includes("SharedArrayBuffer") ||
        msg.includes("cross-origin") ||
        msg.includes("crossOriginIsolated")
      ) {
        throw new Error(
          "WebContainer requires Cross-Origin-Isolation headers.\n" +
          "Fix next.config.js headers"
        );
      }
      throw err;
    });

  return _bootPromise;
}

// ─── Sanitize file content ────────────────────────────────────────────────────

function sanitizeContent(content: string): string {
  return content
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/[\u0000-\u0008\u000C\u000E-\u001F\u007F]/g, "")
    .replace(/[\u200B-\u200D\u2028\u2029\uFEFF]/g, "")
    .slice(0, 80_000);
}

// ─── Deep snapshot validator ──────────────────────────────────────────────────

function validateTree(node: unknown, path: string): boolean {
  if (node === null || node === undefined) {
    console.error(`[WC][VALIDATE] NULL/UNDEFINED at: ${path}`);
    return false;
  }
  if (typeof node !== "object" || Array.isArray(node)) {
    console.error(`[WC][VALIDATE] Not an object (${typeof node}) at: ${path}`);
    return false;
  }
  const obj = node as Record<string, unknown>;
  if ("file" in obj) {
    const f = obj.file as Record<string, unknown>;
    if (!f || typeof f.contents !== "string") {
      console.error(`[WC][VALIDATE] file.contents not string at: ${path}`);
      return false;
    }
    return true;
  }
  if ("directory" in obj) {
    const dir = obj.directory as Record<string, unknown>;
    if (!dir || typeof dir !== "object" || Array.isArray(dir)) {
      console.error(`[WC][VALIDATE] directory not object at: ${path}`);
      return false;
    }
    let ok = true;
    for (const [k, v] of Object.entries(dir)) {
      if (!validateTree(v, `${path}/${k}`)) ok = false;
    }
    return ok;
  }
  console.error(`[WC][VALIDATE] No 'file'/'directory' at: ${path}`);
  return false;
}

// ─── Deep snapshot sanitizer ─────────────────────────────────────────────────

function deepSanitize(raw: unknown): FileSystemTree | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw !== "object" || Array.isArray(raw)) return null;
  const obj = raw as Record<string, unknown>;
  if ("file" in obj) {
    const f = obj.file as Record<string, unknown>;
    if (!f || typeof f.contents !== "string") return null;
    const clean: Record<string, string> = { contents: f.contents };
    if (f.encoding === "base64") clean.encoding = "base64";
    return { file: clean } as unknown as FileSystemTree;
  }
  if ("directory" in obj) {
    const dir = obj.directory as Record<string, unknown>;
    if (!dir || typeof dir !== "object" || Array.isArray(dir)) return null;
    const entries = sanitizeEntries(dir);
    if (!entries) return null;
    return { directory: entries } as unknown as FileSystemTree;
  }
  const entries = sanitizeEntries(obj);
  if (!entries) return null;
  return { directory: entries } as unknown as FileSystemTree;
}

function sanitizeEntries(
  raw: Record<string, unknown>
): Record<string, FileSystemTree> | null {
  const result: Record<string, FileSystemTree> = {};
  for (const [key, val] of Object.entries(raw)) {
    if (!key || key === "__proto__" || key === "constructor" || key === "prototype") continue;
    const sanitized = deepSanitize(val);
    if (sanitized !== null) result[key] = sanitized;
  }
  return Object.keys(result).length === 0 ? null : result;
}

// ─── Build FileSystemTree from AI files ──────────────────────────────────────

function buildFileTree(files: AIFile[]): FileSystemTree {
  const tree: FileSystemTree = {};
  for (const file of files) {
    const parts = file.path.replace(/^\//, "").split("/");
    let current: Record<string, unknown> = tree;
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      if (i === parts.length - 1) {
        (current as FileSystemTree)[part] = {
          file: { contents: sanitizeContent(file.content) },
        };
      } else {
        if (!current[part]) current[part] = { directory: {} };
        current = (current[part] as { directory: Record<string, unknown> }).directory;
      }
    }
  }
  return tree;
}

// ─── Required files check ─────────────────────────────────────────────────────

function hasRequiredFiles(files: AIFile[]): boolean {
  return (
    files.some((f) => f.path === "package.json") &&
    files.some((f) => f.path === "src/main.jsx" || f.path === "src/main.tsx") &&
    files.some((f) => f.path === "src/App.jsx"  || f.path === "src/App.tsx")
  );
}

// ─── Canonical sandbox files ──────────────────────────────────────────────────

const SANDBOX_PACKAGE_JSON = JSON.stringify(
  {
    name: "ai-project",
    private: true,
    version: "0.0.0",
    type: "module",
    scripts: { dev: "vite --host", build: "vite build", preview: "vite preview" },
    dependencies: { react: "^18.2.0", "react-dom": "^18.2.0" },
    devDependencies: { vite: "^5.2.6", "@vitejs/plugin-react": "^4.2.1" },
  },
  null, 2
);

const SANDBOX_VITE_CONFIG = `import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: { host: true, open: false, port: 5173, strictPort: false },
  optimizeDeps: { include: ['react', 'react-dom', 'react-dom/client'] },
});
`;

// ─── Override user files to enforce sandbox constraints ───────────────────────

function applyOverrides(files: AIFile[]): AIFile[] {
  let result = files.map((f) => {
    if (f.path === "package.json") return { ...f, content: SANDBOX_PACKAGE_JSON };
    if (f.path === "vite.config.js" || f.path === "vite.config.ts" || f.path === "vite.config.mjs")
      return { path: "vite.config.mjs", content: SANDBOX_VITE_CONFIG };
    return f;
  });
  result = result.filter((f) => f.path !== "vite.config.js" && f.path !== "vite.config.ts");
  if (!result.some((f) => f.path === "vite.config.mjs"))
    result.push({ path: "vite.config.mjs", content: SANDBOX_VITE_CONFIG });
  return result;
}

// ─── Atomic file write ────────────────────────────────────────────────────────

async function _writeFilesToFs(files: AIFile[]) {
  if (!_instance) return;
  for (const file of files) {
    const filePath = file.path.replace(/^\//, "");
    const parts    = filePath.split("/");
    if (parts.length > 1) {
      await _instance.fs.mkdir(parts.slice(0, -1).join("/"), { recursive: true });
    }
    const tmp = `${filePath}.__tmp__`;
    await _instance.fs.writeFile(tmp, sanitizeContent(file.content));
    await _instance.fs.rename(tmp, filePath);
  }
}

// ─── Kill dev server ──────────────────────────────────────────────────────────

async function killDevServer() {
  if (_devProcess) {
    try { _devProcess.kill(); } catch { /* ignore */ }
    _devProcess = null;
    await new Promise<void>((r) => setTimeout(r, 600));
  }
  if (_instance) {
    try { await _instance.spawn("pkill", ["-f", "vite"]); } catch { /* ignore */ }
    await new Promise<void>((r) => setTimeout(r, 200));
  }
}

// ─── SNAPSHOT LOADER ──────────────────────────────────────────────────────────

async function loadSnapshot(wc: WebContainer): Promise<boolean> {
  if (_snapshotLoaded) {
    console.log("[WC][SNAPSHOT] Already loaded — skipping");
    return true;
  }

  _setStatus("loading-snapshot");
  console.log("[WC][SNAPSHOT] Fetching node_modules snapshot...");

  try {
    let raw: unknown;
    if (_snapshotCache) {
      raw = _snapshotCache;
      console.log("[WC][SNAPSHOT] Using memory cache");
    } else {
      const res = await fetch(SNAPSHOT_URL, { cache: "force-cache" });
      if (!res.ok) {
        console.warn(`[WC][SNAPSHOT] Fetch failed: ${res.status} — falling back`);
        return false;
      }
      raw = await res.json();
      _snapshotCache = raw as Record<string, unknown>;
      console.log("[WC][SNAPSHOT] Fetched from network");
    }

    if (!raw || typeof raw !== "object" || Array.isArray(raw))
      throw new Error("Snapshot root is not a JSON object");

    const rawObj = raw as Record<string, unknown>;
    const rawModules: Record<string, unknown> =
      rawObj.directory &&
      typeof rawObj.directory === "object" &&
      !Array.isArray(rawObj.directory)
        ? (rawObj.directory as Record<string, unknown>)
        : rawObj;

    console.log("[WC][SNAPSHOT] Root keys (first 5):", Object.keys(rawModules).slice(0, 5));
    console.log("[WC][SNAPSHOT] Sanitizing tree...");

    const cleanEntries = sanitizeEntries(rawModules);
    if (!cleanEntries) throw new Error("Snapshot sanitization produced empty tree");

    const keyCount = Object.keys(cleanEntries).length;
    console.log(`[WC][SNAPSHOT] Sanitized: ${keyCount} top-level packages retained`);
    if (keyCount === 0) throw new Error("Zero valid packages after sanitization");

    console.log("[WC][SNAPSHOT] Validating...");
    let allValid = true;
    for (const [pkg, val] of Object.entries(cleanEntries)) {
      if (!validateTree(val, `node_modules/${pkg}`)) allValid = false;
    }
    if (!allValid) throw new Error("Post-sanitization validation failed");

    console.log("[WC][SNAPSHOT] Mounting node_modules...");
    await wc.mount({ node_modules: { directory: cleanEntries } } as unknown as FileSystemTree);

    _snapshotLoaded = true;
    console.log("[WC][SNAPSHOT] ✓ node_modules mounted — zero npm install needed");
    return true;
  } catch (err) {
    console.warn("[WC][SNAPSHOT] Error:", err, "— falling back to npm install");
    return false;
  }
}

// ─── ROLLUP PATCH ─────────────────────────────────────────────────────────────

async function patchRollup(wc: WebContainer): Promise<void> {
  if (_rollupPatched) {
    console.log("[WC][PATCH][rollup] Already patched — skipping");
    return;
  }
  await _patchRollupNativeJs(wc);
  await _patchRollupParseAstJs(wc);
  _rollupPatched = true;
  console.log("[WC][PATCH][rollup] ✅ All rollup patches applied");
}

async function _patchRollupNativeJs(wc: WebContainer): Promise<void> {
  const filePath = "node_modules/rollup/dist/native.js";
  let original: string;
  try { original = await wc.fs.readFile(filePath, "utf8"); }
  catch { console.warn("[WC][PATCH][native.js] Not found — skipping"); return; }

  if (original.includes("/* webcontainer-patched-v26 */")) {
    console.log("[WC][PATCH][native.js] Already patched"); return;
  }

  const ALL_NAMES = ["parseAst","parseAstAsync","xxhashBase16","xxhashBase36","xxhashBase64Url"];
  const present = ALL_NAMES.filter((n) => original.includes(n));
  if (present.length === 0) {
    console.warn("[WC][PATCH][native.js] No known exports found — skipping"); return;
  }

  const patched =
    `/* webcontainer-patched-v26 */\n'use strict';\n` +
    `let _js;\ntry { _js = require('./rollup.js'); } catch(e) { _js = {}; }\n` +
    present.map((n) =>
      `exports.${n} = _js.${n} || function(){ throw new Error('[wc] ${n} unavailable'); };`
    ).join("\n") + "\n";

  try {
    await wc.fs.writeFile(filePath, patched);
    console.log(`[WC][PATCH][native.js] ✅ Patched exports: [${present.join(", ")}]`);
  } catch(err) { console.error("[WC][PATCH][native.js] Write failed:", err); }
}

async function _patchRollupParseAstJs(wc: WebContainer): Promise<void> {
  const filePath = "node_modules/rollup/dist/es/shared/parseAst.js";
  let original: string;
  try { original = await wc.fs.readFile(filePath, "utf8"); }
  catch { console.warn("[WC][PATCH][parseAst.js] Not found — skipping"); return; }

  if (original.includes("/* webcontainer-patched-v26 */")) {
    console.log("[WC][PATCH][parseAst.js] Already patched"); return;
  }

  const importRegex = /^import\s*\{([^}]+)\}\s*from\s*['"]\.\.\/\.\.\/native\.js['"]\s*;?/gm;
  const allNames: string[] = [];
  let matched = false;
  let patched = original.replace(importRegex, (_m, names: string) => {
    matched = true;
    names.split(",").map((n) => n.trim()).filter(Boolean).forEach((n) => allNames.push(n));
    return "";
  });

  if (!matched) {
    console.log("[WC][PATCH][parseAst.js] No named imports found — skipping"); return;
  }

  const unique = [...new Set(allNames)];
  patched =
    `/* webcontainer-patched-v26 */\n` +
    `import _rollupNative from '../../native.js';\n` +
    `const { ${unique.join(", ")} } = _rollupNative;\n` +
    patched;

  try {
    await wc.fs.writeFile(filePath, patched);
    console.log(`[WC][PATCH][parseAst.js] ✅ Rewrote named imports: [${unique.join(", ")}]`);
  } catch(err) { console.error("[WC][PATCH][parseAst.js] Write failed:", err); }
}

// ─── ESBUILD PATCH (v37) ──────────────────────────────────────────────────────

async function patchEsbuild(wc: WebContainer): Promise<void> {
  if (_esbuildPatched) {
    console.log("[WC][PATCH][esbuild] Already patched — skipping");
    return;
  }

  // Stage 1: @esbuild/linux-x64 package.json stub
  try {
    await wc.fs.readFile("node_modules/@esbuild/linux-x64/package.json", "utf8");
    console.log("[WC][PATCH][esbuild] @esbuild/linux-x64 pkg already present");
  } catch {
    let esbuildVersion = "0.21.5";
    try {
      const raw = await wc.fs.readFile("node_modules/esbuild/package.json", "utf8");
      const pkg = JSON.parse(raw) as { version?: string };
      if (pkg.version) esbuildVersion = pkg.version;
    } catch { /* use fallback */ }

    await wc.fs.mkdir("node_modules/@esbuild/linux-x64/bin", { recursive: true });
    await wc.fs.writeFile(
      "node_modules/@esbuild/linux-x64/package.json",
      JSON.stringify({
        name: "@esbuild/linux-x64",
        version: esbuildVersion,
        description: "WebContainer stub",
        bin: { esbuild: "bin/esbuild" },
        os: ["linux"],
        cpu: ["x64"],
      }, null, 2)
    );
    await wc.fs.writeFile(
      "node_modules/@esbuild/linux-x64/bin/esbuild",
      "#!/usr/bin/env node\n'use strict';\nprocess.exit(0);\n"
    );
    console.log(`[WC][PATCH][esbuild] ✅ @esbuild/linux-x64 stub written (v${esbuildVersion})`);
  }

  // Stage 2: Spawn-intercept IIFE
  const SENTINEL = "/* webcontainer-esbuild-v37 */";

  const iife = [
    SENTINEL,
    "(function _wcEsbuildV37() {",
    "  if (globalThis.__wcEsbuildV37) return;",
    "  globalThis.__wcEsbuildV37 = true;",
    "  try {",
    "    var cp = require('child_process');",
    "    var origSpawn     = cp.spawn.bind(cp);",
    "    var origSpawnSync = cp.spawnSync ? cp.spawnSync.bind(cp) : null;",
    "",
    "    function isPlatformBin(cmd) {",
    "      if (typeof cmd !== 'string') return false;",
    "      var n = cmd.replace(/\\\\/g, '/');",
    "      return n.indexOf('@esbuild') !== -1 || n.indexOf('esbuild/bin') !== -1;",
    "    }",
    "",
    "    function makePacket(obj) {",
    "      var json = JSON.stringify(obj);",
    "      var body = Buffer.from(json, 'utf8');",
    "      var hdr  = Buffer.allocUnsafe(4);",
    "      hdr.writeUInt32LE(body.length, 0);",
    "      return Buffer.concat([hdr, body]);",
    "    }",
    "",
    "    function parsePacket(buf) {",
    "      if (!buf || buf.length < 4) return null;",
    "      var len = buf.readUInt32LE(0);",
    "      if (buf.length < 4 + len) return null;",
    "      try {",
    "        var obj = JSON.parse(buf.slice(4, 4 + len).toString('utf8'));",
    "        return obj;",
    "      } catch (e) { return null; }",
    "    }",
    "",
    "    function fakeChild() {",
    "      var EE = require('events').EventEmitter;",
    "      var stdoutEE = new EE();",
    "      stdoutEE.pipe = stdoutEE.resume = stdoutEE.pause = stdoutEE.destroy = function() {};",
    "      stdoutEE.readable = true;",
    "      var stderrEE = new EE();",
    "      stderrEE.pipe = stderrEE.resume = stderrEE.destroy = function() {};",
    "      stderrEE.readable = true;",
    "      var stdinBuf = Buffer.alloc(0);",
    "      var stdinEE  = new EE();",
    "      stdinEE.writable = true;",
    "      stdinEE.write = function(chunk) {",
    "        if (typeof chunk === 'string') chunk = Buffer.from(chunk, 'utf8');",
    "        stdinBuf = Buffer.concat([stdinBuf, chunk]);",
    "        var pkt = parsePacket(stdinBuf);",
    "        if (pkt && typeof pkt.id === 'number') {",
    "          var resp = makePacket({ id: pkt.id, result: {} });",
    "          setTimeout(function() { stdoutEE.emit('data', resp); }, 0);",
    "          stdinBuf = Buffer.alloc(0);",
    "        }",
    "        return true;",
    "      };",
    "      stdinEE.end = stdinEE.destroy = function() {};",
    "      var child = new EE();",
    "      child.pid = -1; child.killed = false;",
    "      child.stdin = stdinEE; child.stdout = stdoutEE; child.stderr = stderrEE;",
    "      child.unref = child.ref = child.kill = function() {};",
    "      return child;",
    "    }",
    "",
    "    cp.spawn = function wcSpawn(cmd, args, opts) {",
    "      if (isPlatformBin(cmd)) {",
    "        console.log('[wc] esbuild spawn intercepted (v37):', cmd);",
    "        return fakeChild();",
    "      }",
    "      return origSpawn(cmd, args, opts);",
    "    };",
    "",
    "    if (origSpawnSync) {",
    "      cp.spawnSync = function wcSpawnSync(cmd, args, opts) {",
    "        if (isPlatformBin(cmd)) {",
    "          console.log('[wc] esbuild spawnSync intercepted (v37)');",
    "          return { pid: -1, status: 0, signal: null,",
    "                   stdout: Buffer.alloc(0), stderr: Buffer.alloc(0), output: [] };",
    "        }",
    "        return origSpawnSync(cmd, args, opts);",
    "      };",
    "    }",
    "",
    "    try {",
    "      var stub = require.resolve('@esbuild/linux-x64/bin/esbuild');",
    "      process.env.ESBUILD_BINARY_PATH = stub;",
    "      console.log('[wc] ESBUILD_BINARY_PATH ->', stub);",
    "    } catch (re) {",
    "      console.warn('[wc] ESBUILD_BINARY_PATH not set:', re.message);",
    "    }",
    "",
    "    console.log('[wc] esbuild v37 patch OK');",
    "  } catch (e) {",
    "    console.warn('[wc] esbuild v37 patch error:', e.message);",
    "  }",
    "})();",
  ].join("\n");

  const mainJsPath = "node_modules/esbuild/lib/main.js";
  try {
    const mainJs = await wc.fs.readFile(mainJsPath, "utf8");
    if (mainJs.includes(SENTINEL)) {
      console.log("[WC][PATCH][esbuild] main.js already patched");
    } else {
      await wc.fs.writeFile(mainJsPath, iife + "\n" + mainJs);
      console.log("[WC][PATCH][esbuild] ✅ main.js patched");
    }
  } catch {
    console.warn("[WC][PATCH][esbuild] main.js not found — skipping");
  }

  const binPath = "node_modules/esbuild/bin/esbuild";
  try {
    const binJs = await wc.fs.readFile(binPath, "utf8");
    if (binJs.includes(SENTINEL)) {
      console.log("[WC][PATCH][esbuild] bin/esbuild already patched");
    } else {
      const lines   = binJs.split("\n");
      const shebang = lines[0].startsWith("#!") ? lines[0] + "\n" : "";
      const rest    = lines[0].startsWith("#!") ? lines.slice(1).join("\n") : binJs;
      await wc.fs.writeFile(binPath, shebang + iife + "\n" + rest);
      console.log("[WC][PATCH][esbuild] ✅ bin/esbuild patched");
    }
  } catch {
    console.warn("[WC][PATCH][esbuild] bin/esbuild not found — skipping");
  }

  _esbuildPatched = true;
  console.log("[WC][PATCH][esbuild] ✅ All esbuild patches applied");
}

// ─── BABEL PATCH (v37.4) ──────────────────────────────────────────────────────
// Provides stub for @babel/core/lib/tools/build-external-helpers.js

async function patchBabel(wc: WebContainer): Promise<void> {
  if (_babelPatched) {
    console.log("[WC][PATCH][babel] Already patched — skipping");
    return;
  }

  const missingFile = "node_modules/@babel/core/lib/tools/build-external-helpers.js";
  try {
    await wc.fs.readFile(missingFile, "utf8");
    console.log("[WC][PATCH][babel] build-external-helpers.js already present");
    _babelPatched = true;
    return;
  } catch { /* missing — create stub */ }

  await wc.fs.mkdir("node_modules/@babel/core/lib/tools", { recursive: true });
  await wc.fs.writeFile(missingFile,
    `'use strict';\nmodule.exports = function buildExternalHelpers() { return ''; };\n`
  );
  _babelPatched = true;
  console.log("[WC][PATCH][babel] ✅ build-external-helpers.js stub created");
}

// ─── VITE CONFIG LOADER PATCH (v37.3) ─────────────────────────────────────────
// Replaces bundleConfigFile with direct file read to bypass esbuild.

async function findViteChunk(wc: WebContainer): Promise<string | null> {
  const chunksDir = "node_modules/vite/dist/node/chunks";
  try {
    // Method 1: parse cli.js to find the chunk name
    const cli = await wc.fs.readFile("node_modules/vite/dist/node/cli.js", "utf8");
    const match = cli.match(/['"]\.\/(chunks\/dep-[^'"]+\.js)['"]/);
    if (match) {
      console.log("[WC][PATCH][vite-config] Found chunk via cli.js:", match[1]);
      return `${chunksDir}/${match[1].replace("chunks/", "")}`;
    }
  } catch { /* fall through */ }

  try {
    // Method 2: list the chunks directory and pick the largest file
    const proc = await wc.spawn("ls", ["-S", chunksDir]);
    const out: string[] = [];
    proc.output.pipeTo(new WritableStream({ write(c) { out.push(String(c)); } })).catch(() => {});
    await proc.exit;
    const files = out.join("").trim().split(/\s+/).filter(f => f.endsWith(".js"));
    if (files[0]) {
      console.log("[WC][PATCH][vite-config] Found chunk via ls:", files[0]);
      return `${chunksDir}/${files[0]}`;
    }
  } catch { /* fall through */ }

  try {
    // Method 3: try known filenames from common vite versions
    const candidates = [
      "dep-BK3b2jBa.js", "dep-BvsVFJbJ.js", "dep-C7CNJPWT.js",
      "dep-DyBnyoVI.js", "dep-CBPRnGRI.js", "dep-B1B0IOIU.js",
    ];
    for (const name of candidates) {
      try {
        await wc.fs.readFile(`${chunksDir}/${name}`, "utf8");
        console.log("[WC][PATCH][vite-config] Found chunk via candidate list:", name);
        return `${chunksDir}/${name}`;
      } catch { /* try next */ }
    }
  } catch { /* fall through */ }

  return null;
}

async function patchViteConfigLoader(wc: WebContainer): Promise<void> {
  if (_viteConfigPatched) {
    console.log("[WC][PATCH][vite-config] Already patched — skipping");
    return;
  }

  const SENTINEL = "/* webcontainer-vite-config-patch-v1 */";

  // DEBUG: list what's in the chunks dir
  try {
    const proc = await wc.spawn("ls", ["node_modules/vite/dist/node/chunks"]);
    const out: string[] = [];
    proc.output.pipeTo(new WritableStream({ write(c) { out.push(String(c)); } })).catch(() => {});
    await proc.exit;
    console.log("[WC][PATCH][vite-config] chunks dir contents:", out.join("").trim());
  } catch (e) {
    console.warn("[WC][PATCH][vite-config] ls failed:", e);
  }

  const chunkPath = await findViteChunk(wc);
  if (!chunkPath) {
    console.warn("[WC][PATCH][vite-config] Could not locate Vite chunk — skipping");
    return;
  }
  console.log("[WC][PATCH][vite-config] Patching chunk:", chunkPath);

  let src: string;
  try {
    src = await wc.fs.readFile(chunkPath, "utf8");
  } catch {
    console.warn("[WC][PATCH][vite-config] Failed to read chunk — skipping");
    return;
  }

  if (src.includes(SENTINEL)) {
    console.log("[WC][PATCH][vite-config] Already patched");
    _viteConfigPatched = true;
    return;
  }

  // Find the bundleConfigFile function
  const fnStart = src.indexOf("async function bundleConfigFile(");
  if (fnStart === -1) {
    console.warn("[WC][PATCH][vite-config] bundleConfigFile not found in chunk");
    return;
  }

  // Find matching closing brace
  let depth = 0;
  let i = fnStart;
  let fnEnd = -1;
  while (i < src.length) {
    if (src[i] === "{") depth++;
    else if (src[i] === "}") {
      depth--;
      if (depth === 0) { fnEnd = i + 1; break; }
    }
    i++;
  }
  if (fnEnd === -1) {
    console.warn("[WC][PATCH][vite-config] Could not find end of bundleConfigFile");
    return;
  }

  const replacement = `
${SENTINEL}
async function bundleConfigFile(fileName, isESM) {
  const fs = await import('fs');
  const url = await import('url');
  const code = fs.readFileSync(fileName, 'utf-8');
  return { code, dependencies: [] };
}
`;

  const patched = src.slice(0, fnStart) + replacement + src.slice(fnEnd);
  await wc.fs.writeFile(chunkPath, patched);
  _viteConfigPatched = true;
  console.log("[WC][PATCH][vite-config] ✅ bundleConfigFile patched — esbuild bypassed for config loading");
}

// ─── FALLBACK INSTALL ─────────────────────────────────────────────────────────

async function runFallbackInstall(wc: WebContainer): Promise<void> {
  if (_fallbackInstalled) {
    console.log("[WC][INSTALL] Fallback already installed — skipping");
    return;
  }
  console.log("[WC][INSTALL] Running fallback npm install (snapshot unavailable)");
  _setStatus("installing");

  const proc = await wc.spawn("npm", [
    "install", ...FALLBACK_PACKAGES,
    "--no-audit", "--no-fund", "--prefer-offline", "--legacy-peer-deps",
  ]);
  proc.output.pipeTo(
    new WritableStream({ write(c) { console.log("[npm]", String(c).trim()); } })
  ).catch(() => { /* ignore */ });

  const exit = await proc.exit;
  if (exit !== 0) {
    _setStatus("install-failed");
    throw new Error(`npm install failed with exit code ${exit}`);
  }
  _fallbackInstalled = true;
  console.log("[WC][INSTALL] Fallback install complete");
}

// ─── Verify vite binary ───────────────────────────────────────────────────────

async function verifyVite(wc: WebContainer): Promise<boolean> {
  try { await wc.fs.readFile("node_modules/.bin/vite"); return true; }
  catch { return false; }
}

// ─── Start Vite dev server (with one auto-retry) ──────────────────────────────

async function startDevServer(wc: WebContainer, isRetry = false): Promise<void> {
if (_devProcess) {
  console.log("[WC][SERVER] already running — skip");
  return;
}

  console.log(`[WC][SERVER] Starting Vite${isRetry ? " (retry)" : ""}…`);
  _setStatus("starting");

  const dev = await wc.spawn("node", ["node_modules/vite/bin/vite.js", "--host"]);
  _devProcess = dev;

  dev.output.pipeTo(
    new WritableStream({ write(c) { console.log("[vite]", String(c).trim()); } })
  ).catch(() => { /* ignore */ });

  await new Promise<void>((resolve, reject) => {
    let settled = false;

    const unsub = wc.on("server-ready", (_port, url) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      unsub();
      console.log("[WC][SERVER] Ready at", url);
      _setUrl(url);
      _setStatus("running");
      resolve();
    });

    const timer = setTimeout(async () => {
      if (settled) return;
      settled = true;
      unsub();
      if (!isRetry) {
        console.warn("[WC][SERVER] Timeout — retrying once…");
        try {
          await killDevServer();
          await startDevServer(wc, true);
          resolve();
        } catch (retryErr) { reject(retryErr); }
      } else {
        reject(new Error(
          `Vite server-ready timeout after ${VITE_TIMEOUT_MS / 1000}s (retry also failed)`
        ));
      }
    }, VITE_TIMEOUT_MS);
  });
}

async function _doMountAndRun(files: AIFile[]) {
  try {
    // 🔥 Prevent duplicate runs
    if (_globalStatus === "running") {
      console.log("[WC] Already running — skip mount");
      return;
    }

    if (!hasRequiredFiles(files)) {
      _setStatus("waiting-files");
      return;
    }

    files = applyOverrides(files);
    _setStatus("booting");

    // 🔥 Kill ONLY if already running
    if (_devProcess) {
      await killDevServer();
    }

    const wc = await bootOnce();

    // ─── 1. Snapshot / install ─────────────────────────────
    const snapshotOk = await loadSnapshot(wc);
    if (!snapshotOk) {
      await runFallbackInstall(wc);
    }

    // ─── 2. Mount files ────────────────────────────────────
    _setStatus("mounting");
    await wc.mount(buildFileTree(files));

    // ─── 3. Clean conflicting vite configs ─────────────────
    try { await wc.fs.rm("vite.config.js"); } catch {}
    try { await wc.fs.rm("vite.config.ts"); } catch {}

    // ─── 4. Patch rollup (once) ────────────────────────────
    if (!_rollupPatched) {
      await patchRollup(wc);
      _rollupPatched = true;
    }

    // ─── 5. Patch esbuild (once) ───────────────────────────
    if (!_esbuildPatched) {
      await patchEsbuild(wc);
      _esbuildPatched = true;
    }

    // ─── 6. Patch babel (once) ─────────────────────────────
    if (!_babelPatched) {
      await patchBabel(wc);
      _babelPatched = true;
    }

    // ─── 7. Patch vite loader (once) ───────────────────────
   if (!_viteConfigPatched) {
  await patchViteConfigLoader(wc);
  _viteConfigPatched = true;
}

    // ─── 8. Verify vite ────────────────────────────────────
    const viteOk = await verifyVite(wc);
    if (!viteOk) {
      throw new Error("Vite binary not found after snapshot/install");
    }

    console.log("[WC][PIPELINE] ✓ node_modules ready");

    // 🔥 CRITICAL FIX: only start if not already running
    if (!_devProcess) {
      console.log("[WC][SERVER] Starting dev server...");
      await startDevServer(wc);
    } else {
      console.log("[WC][SERVER] already running — skip start");
    }

    _setStatus("running");

  } catch (err) {
    console.error("[WC][PIPELINE] Error:", err);
    _setStatus("error");
  }
}

// ─── Fast update: write files + restart Vite ─────────────────────────────────

async function _doWriteAndRestart(files: AIFile[]) {
  // 🔥 FIX: prevent restart loop
  if (_globalStatus !== "running") {
    console.log("[WC] Not running → full mount");
    await _doMountAndRun(files);
    return;
  }

  // 🔥 FIX: safe fallback
  if (!_instance) {
    console.warn("[WC] Instance missing → fallback mount");
    await _doMountAndRun(files);
    return;
  }

  if (!hasRequiredFiles(files)) {
    _setStatus("waiting-files");
    return;
  }

  files = applyOverrides(files);

  try {
    _setStatus("writing");

    // ❌ REMOVED: killDevServer()

    await _writeFilesToFs(files);

    if (!(await verifyVite(_instance))) {
      console.warn("[WC] Vite missing — full remount");
      await _doMountAndRun(files);
      return;
    }

    _setStatus("restarting");

    await startDevServer(_instance);
  } catch (err) {
    console.error("[WC][RESTART] Error:", err);
    _setStatus("error");
  }
}

// ─── HMR patch: write changed files only ─────────────────────────────────────

async function _doWriteFiles(files: AIFile[]) {
  if (!_instance || (!_snapshotLoaded && !_fallbackInstalled)) {
    await _doMountAndRun(files);
    return;
  }
  try {
    files = files.map((f) => ({ ...f, content: sanitizeContent(f.content) }));
    _setStatus("writing");
    await _writeFilesToFs(files);
    _setStatus("running");
  } catch (err) {
    console.error("[WC][WRITE] Error:", err);
    _setStatus("error");
  }
}

// ─── Queue ────────────────────────────────────────────────────────────────────

async function _runExclusive(fn: () => Promise<void>) {
  if (_busy) { _pendingFn = fn; return; }
  _busy = true;
  try {
    await fn();
  } catch (err) {
    console.error("[WC]", err);
    _setStatus("error");
  } finally {
    _busy = false;
    _notify();
    if (_pendingFn) {
      const next = _pendingFn;
      _pendingFn = null;
      _runExclusive(next);
    }
  }
}

// ─── React Hook ───────────────────────────────────────────────────────────────

export const useWebContainer = () => {
  const [, rerender] = useState(0);

  useEffect(() => {
    const listener = () => rerender((n) => n + 1);
    _listeners.add(listener);
    return () => { _listeners.delete(listener); };
  }, []);

  const mountAndRun = useCallback(async (files: AIFile[]) => {
  if (_globalStatus === "running") {
    console.log("[WC] mountAndRun skipped — already running");
    return;
  }
  await _runExclusive(() => _doMountAndRun(files));
}, []);

  const remount = useCallback(async (files: AIFile[]) => {
    await _runExclusive(() => _doWriteAndRestart(files));
  }, []);

  const writeFiles = useCallback(async (files: AIFile[]) => {
    await _runExclusive(() => _doWriteFiles(files));
  }, []);

  return {
    status:      _globalStatus,
    url:         _globalUrl,
    isRunning:   _globalStatus === "running",
    isInstalled: _snapshotLoaded || _fallbackInstalled,
    mountAndRun,
    remount,
    writeFiles,
  };
};