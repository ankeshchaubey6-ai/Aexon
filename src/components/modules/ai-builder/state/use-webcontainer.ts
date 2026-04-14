// src/components/modules/ai-builder/state/use-webcontainer.ts

import { useState, useCallback, useEffect } from "react";
import { WebContainer } from "@webcontainer/api";
import type { FileSystemTree } from "@webcontainer/api";

type AIFile = { path: string; content: string };

export type WCStatus =
  | "idle"
  | "waiting-files"
  | "booting"
  | "mounting"
  | "loading-snapshot"
  | "installing"
  | "starting"
  | "writing"
  | "restarting"
  | "running"
  | "error";

const SNAPSHOT_MANIFEST_URL = "/snapshot/manifest.json";

const VITE_TIMEOUT_MS = 60_000;

let _instance: WebContainer | null = null;
let _bootPromise: Promise<WebContainer> | null = null;
let _globalStatus: WCStatus = "idle";
let _globalUrl: string | null = null;
let _devProcess: Awaited<ReturnType<WebContainer["spawn"]>> | null = null;
let _activeProjectId: string | null = null;

let _snapshotLoaded    = false;
let _snapshotCache: Record<string, unknown> | null = null;
let _babelPatched      = false;
let _esbuildPatched    = false;

let _busy      = false;
let _pendingFn: (() => Promise<void>) | null = null;
let _bootAttempted = false;
let _bootstrapped  = false;

const _listeners = new Set<() => void>();
function _notify()                 { _listeners.forEach((fn) => fn()); }
function _setStatus(s: WCStatus)   { _globalStatus = s; _notify(); }
function _setUrl(u: string | null) { _globalUrl = u; _notify(); }

export function resetContainer(projectId?: string) {
  if (_devProcess) {
    try { _devProcess.kill(); } catch { }
    _devProcess = null;
  }
  _busy         = false;
  _pendingFn    = null;
  _bootstrapped = false;
  _globalUrl    = null;
  _setUrl(null);
  _setStatus("idle");
  // Reset patch flags so patches run again for new projects
  _babelPatched  = false;
  _esbuildPatched = false;
  if (projectId) console.log(`[WC][RESET] Container reset for project: ${projectId}`);
}

async function bootOnce(): Promise<WebContainer> {
  if (_instance) return _instance;
  if (_bootPromise) return _bootPromise;
  if (_bootAttempted) throw new Error("WebContainer boot already failed. Reload the page.");
  console.log("[WC] Booting WebContainer...");
  _bootAttempted = true;
  _bootPromise = WebContainer.boot()
    .then((wc) => { _instance = wc; _bootPromise = null; console.log("[WC] Boot complete"); return wc; })
    .catch((err) => { _bootPromise = null; throw err; });
  return _bootPromise;
}

function sanitizeContent(content: string): string {
  return content
    .replace(/\r\n/g, "\n").replace(/\r/g, "\n")
    .replace(/[\u0000-\u0008\u000C\u000E-\u001F\u007F]/g, "")
    .replace(/[\u200B-\u200D\u2028\u2029\uFEFF]/g, "")
    .slice(0, 80_000);
}

function validateTree(node: unknown, path: string): boolean {
  if (node === null || node === undefined) { console.error(`[WC][VALIDATE] NULL at: ${path}`); return false; }
  if (typeof node !== "object" || Array.isArray(node)) { console.error(`[WC][VALIDATE] Not object at: ${path}`); return false; }
  const obj = node as Record<string, unknown>;
  if ("file" in obj) {
    const f = obj.file as Record<string, unknown>;
    if (!f || typeof f.contents !== "string") { console.error(`[WC][VALIDATE] bad file at: ${path}`); return false; }
    return true;
  }
  if ("directory" in obj) {
    const dir = obj.directory as Record<string, unknown>;
    if (!dir || typeof dir !== "object" || Array.isArray(dir)) { console.error(`[WC][VALIDATE] bad dir at: ${path}`); return false; }
    let ok = true;
    for (const [k, v] of Object.entries(dir)) { if (!validateTree(v, `${path}/${k}`)) ok = false; }
    return ok;
  }
  console.error(`[WC][VALIDATE] No file/directory at: ${path}`); return false;
}

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

function sanitizeEntries(raw: Record<string, unknown>): Record<string, FileSystemTree> | null {
  const result: Record<string, FileSystemTree> = {};
  for (const [key, val] of Object.entries(raw)) {
    if (!key || key === "__proto__" || key === "constructor" || key === "prototype") continue;
    const sanitized = deepSanitize(val);
    if (sanitized !== null) result[key] = sanitized;
  }
  return Object.keys(result).length === 0 ? null : result;
}

function buildFileTree(files: AIFile[]): FileSystemTree {
  const tree: FileSystemTree = {};
  for (const file of files) {
    const parts = file.path.replace(/^\//, "").split("/");
    let current: Record<string, unknown> = tree;
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      if (i === parts.length - 1) {
        (current as FileSystemTree)[part] = { file: { contents: sanitizeContent(file.content) } };
      } else {
        if (!current[part]) current[part] = { directory: {} };
        current = (current[part] as { directory: Record<string, unknown> }).directory;
      }
    }
  }
  return tree;
}

function hasRequiredFiles(files: AIFile[]): boolean {
  return (
    files.some((f) => f.path === "package.json") &&
    files.some((f) => f.path === "src/main.jsx" || f.path === "src/main.tsx") &&
    files.some((f) => f.path === "src/App.jsx"  || f.path === "src/App.tsx")
  );
}

const SANDBOX_PACKAGE_JSON = JSON.stringify({
  name: "ai-project", private: true, version: "0.0.0", type: "module",
  scripts: { dev: "vite --host", build: "vite build", preview: "vite preview" },
  dependencies: { react: "^18.2.0", "react-dom": "^18.2.0" },
  devDependencies: { vite: "4.5.3", "@vitejs/plugin-react": "4.2.1" },
}, null, 2);

// ─── VITE CONFIG ─────────────────────────────────────────────────────────────
// Vite 4 + Rollup 3 (no WASM parsing needed)
// ─────────────────────────────────────────────────────────────────────────────
const SANDBOX_VITE_CONFIG = `import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  appType: 'spa',
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
    midddlePort: false,
    fs: { allow: ['.'] },
  },
});
`;

function applyOverrides(files: AIFile[]): AIFile[] {
  let result = files.map((f) => {
    if (f.path === "package.json") return { ...f, content: SANDBOX_PACKAGE_JSON };
    if (
      f.path === "vite.config.js" ||
      f.path === "vite.config.ts" ||
      f.path === "vite.config.mjs"
    ) {
      return { path: "vite.config.js", content: SANDBOX_VITE_CONFIG };
    }
    return f;
  });

  result = result.filter((f) => f.path !== "vite.config.ts" && f.path !== "vite.config.mjs");

  if (!result.some((f) => f.path === "vite.config.js")) {
    result.push({ path: "vite.config.js", content: SANDBOX_VITE_CONFIG });
  }

  if (!result.some((f) => f.path === "src/index.css")) {
    result.push({ path: "src/index.css", content: "/* injected */\n" });
  }

  result = result.map((f) => {
    if (f.path === "src/main.jsx" || f.path === "src/main.tsx") {
      const hasCss = result.some((r) => r.path === "src/index.css");
      if (!hasCss) {
        return {
          ...f,
          content: f.content
            .replace(/^import\s+["']\.\/index\.css["'];?\s*$/gm, "")
            .replace(/^import\s+["']\.\/index\.scss["'];?\s*$/gm, "")
            .replace(/^import\s+["']\.\/App\.css["'];?\s*$/gm, ""),
        };
      }
    }
    return f;
  });

  return result;
}

async function _writeFilesToFs(files: AIFile[]) {
  if (!_instance) return;
  console.log("[WC][FILES] Writing", files.length, "files");
  for (const file of files) {
    const filePath = file.path.replace(/^\//, "");
    const parts    = filePath.split("/");
    if (parts.length > 1) await _instance.fs.mkdir(parts.slice(0, -1).join("/"), { recursive: true });
    const tmp = `${filePath}.__tmp__`;
    await _instance.fs.writeFile(tmp, sanitizeContent(file.content));
    await _instance.fs.rename(tmp, filePath);
    console.log("[WC][FILES] ✓", filePath);
  }
}

async function killDevServer() {
  if (_devProcess) {
    try { _devProcess.kill(); } catch { }
    _devProcess = null;
    await new Promise<void>((r) => setTimeout(r, 600));
  }
  if (_instance) {
    try { await _instance.spawn("pkill", ["-f", "vite"]); } catch { }
    await new Promise<void>((r) => setTimeout(r, 200));
  }
}

function flatToTree(flatObj: Record<string, string>): Record<string, any> {
  const tree: Record<string, any> = {};
  
  for (const [flatPath, base64Content] of Object.entries(flatObj)) {
    const parts = flatPath.split("/");
    let current = tree;
    
    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      if (!current[part]) {
        current[part] = { directory: {} };
      }
      current = current[part].directory;
    }
    
    const fileName = parts[parts.length - 1];
    current[fileName] = {
      file: {
        contents: base64Content,
        encoding: "base64"
      }
    };
  }
  
  return tree;
}

async function loadSnapshot(wc: WebContainer): Promise<boolean> {
  if (_snapshotLoaded) { console.log("[WC][SNAPSHOT] Already loaded"); return true; }
  _setStatus("loading-snapshot");
  console.log("[WC][SNAPSHOT] Loading minimal esbuild-only snapshot...");
  try {
    // Step 1: Fetch manifest.json with cache bypass
    const manifestRes = await fetch(SNAPSHOT_MANIFEST_URL, { 
      cache: "no-store",
      headers: {
        "Cache-Control": "no-cache, no-store, must-revalidate",
        "Pragma": "no-cache",
        "Expires": "0"
      }
    });
    if (!manifestRes.ok) { console.warn(`[WC][SNAPSHOT] Manifest fetch failed: ${manifestRes.status}`); return false; }
    const manifest = await manifestRes.json() as any;
    
    if (!manifest || typeof manifest !== "object") {
      throw new Error("Invalid manifest structure");
    }

    // Step 2: Load ONLY chunk-esbuild (the minimal, essential binary)
    console.log("[WC][SNAPSHOT] Loading chunk-esbuild (~14MB, 3 files)...");
    const res = await fetch(`/snapshot/chunk-esbuild.json`, {
      cache: "no-store",
      headers: {
        "Cache-Control": "no-cache, no-store, must-revalidate",
        "Pragma": "no-cache",
        "Expires": "0"
      }
    });
    if (!res.ok) throw new Error(`FATAL: Could not load chunk-esbuild (${res.status})`);

    const chunk = await res.json();
    const tree = flatToTree(chunk);
    const entries = Object.keys(chunk).length;

    // Mount the small esbuild tree
    console.log(`[WC][SNAPSHOT] Mounting esbuild tree (${entries} entries)...`);
    await wc.mount(tree as unknown as FileSystemTree);
    
    _snapshotLoaded = true;
    console.log("[WC][SNAPSHOT] ✅ Minimal snapshot mounted successfully");
    return true;
  } catch (err) {
    console.warn("[WC][SNAPSHOT] ❌ Error:", err);
    return false;
  }
}

// ─── ESBUILD PATCH ───────────────────────────────────────────────────────────
//
// Problem: esbuild is CommonJS but Vite expects ESM named exports, causing:
// "Named export 'transform' not found"
//
// Fix: Append a small shim AFTER the original module code that spreads all
// existing exports and explicitly re-attaches named exports (transform, build,
// formatMessages) plus a default export. Idempotent via __HF_ESBUILD_ESM_FIX__
// marker. Does NOT replace the file or use backup files.
// ─────────────────────────────────────────────────────────────────────────────

async function patchEsbuild(wc: WebContainer): Promise<void> {
  if (_esbuildPatched) return;

  const filePath = "node_modules/esbuild/lib/main.js";

  let code: string;
  try {
    code = await wc.fs.readFile(filePath, "utf8");
  } catch {
    return;
  }

  if (code.includes("__HF_ESBUILD_ESM_FIX__")) {
    _esbuildPatched = true;
    return;
  }

  const patch = `
// __HF_ESBUILD_ESM_FIX__
const __hf_original_exports__ = module.exports;
// attach ESM-compatible exports
module.exports = {
  ...__hf_original_exports__,
  default: __hf_original_exports__,
  transform: __hf_original_exports__.transform,
  build: __hf_original_exports__.build,
  formatMessages: __hf_original_exports__.formatMessages,
};
`;

  await wc.fs.writeFile(filePath, code + patch);
  _esbuildPatched = true;
  console.log("[WC][PATCH][esbuild] 🚀 ESM FIX APPLIED");
}

async function patchBabel(wc: WebContainer): Promise<void> {
  if (_babelPatched) return;
  const missingFile = "node_modules/@babel/core/lib/tools/build-external-helpers.js";
  try { await wc.fs.readFile(missingFile, "utf8"); _babelPatched = true; return; } catch { }
  await wc.fs.mkdir("node_modules/@babel/core/lib/tools", { recursive: true });
  await wc.fs.writeFile(missingFile, `'use strict';\nmodule.exports = function buildExternalHelpers() { return ''; };\n`);
  _babelPatched = true;
  console.log("[WC][PATCH][babel] ✅");
}


async function startDevServer(wc: WebContainer, isRetry = false): Promise<void> {
  if (_devProcess) { console.log("[WC][SERVER] Already running"); return; }
  console.log(`[WC][SERVER] Starting Vite${isRetry ? " (retry)" : ""}…`);
  _setStatus("starting");

  const dev = await wc.spawn("node", ["node_modules/vite/bin/vite.js", "--host"]);
  _devProcess = dev;

  const outputLines: string[] = [];
  dev.output.pipeTo(new WritableStream({
    write(c) {
      const line = String(c).trim();
      console.log("[vite]", line);
      outputLines.push(line);
    },
  })).catch(() => { });

  await new Promise<void>((resolve, reject) => {
    let settled = false;

    const unsub = wc.on("server-ready", (_port, rawUrl) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      unsub();
      console.log("[WC][SERVER] server-ready → port:", _port, "url:", rawUrl);
      _setUrl(rawUrl);
      _bootstrapped = true;
      _setStatus("running");
      console.log("[WC][SERVER] ✅ Ready at", rawUrl);
      resolve();
    });

    const timer = setTimeout(async () => {
      if (settled) return;
      settled = true;
      unsub();
      console.error("[WC][SERVER] Timeout — last Vite output:", outputLines.slice(-5).join(" | "));
      if (!isRetry) {
        try {
          await killDevServer();
          await startDevServer(wc, true);
          resolve();
        } catch (retryErr) { reject(retryErr); }
      } else {
        reject(new Error(`Vite timeout after ${VITE_TIMEOUT_MS / 1000}s`));
      }
    }, VITE_TIMEOUT_MS);
  });
}

async function _doMountAndRun(files: AIFile[], projectId: string | null = null) {
  try {
    if (projectId && _activeProjectId && projectId !== _activeProjectId) {
      console.log(`[WC][PROJECT_SWITCH] "${_activeProjectId}" → "${projectId}"`);
      await killDevServer();
      resetContainer(projectId);
    }

    if (projectId) _activeProjectId = projectId;
    _bootstrapped = false;

    if (_globalStatus === "running" && projectId === _activeProjectId) {
      console.log("[WC][MOUNT] Same project running — skip");
      return;
    }

    if (!hasRequiredFiles(files)) {
      _setStatus("waiting-files");
      return;
    }

    files = applyOverrides(files);

    _setStatus("booting");

    if (_devProcess) await killDevServer();

    const wc = await bootOnce();

    const snapshotOk = await loadSnapshot(wc);
    if (!snapshotOk) throw new Error("FATAL: Snapshot failed to load. Rebuild snapshot with: npm run build:snapshot");
    
    // ✅ VERIFY ESBUILD BINARY IS PRESENT IN SNAPSHOT
    try {
      await wc.fs.readFile("node_modules/@esbuild/linux-x64/bin/esbuild", "utf8");
      console.log("[WC][ESBUILD] ✅ esbuild binary verified in snapshot");
    } catch {
      throw new Error(
        "FATAL: esbuild binary missing from snapshot. Rebuild snapshot on linux-x64 using: npm run build:snapshot"
      );
    }

    // Note: react-dom and other packages will be installed by npm install below

    _setStatus("mounting");

    await wc.mount(buildFileTree(files));
    console.log("[WC][MOUNT] Files mounted");

    // 🔥 CLEAN OLD CONFIGS
    try { await wc.fs.rm("vite.config.ts"); } catch {}
    try { await wc.fs.rm("vite.config.mjs"); } catch {}

    // 🔥 RUN NPM INSTALL TO INSTALL VITE, REACT, AND ALL DEPENDENCIES
    _setStatus("installing");
    console.log("[WC][NPM] Running npm install...");
    
    const installProcess = await wc.spawn("npm", ["install"]);
    
    // Stream npm output to console
    installProcess.output.pipeTo(new WritableStream({
      write(data) {
        console.log("[npm]", String(data));
      }
    })).catch(() => { });
    
    const installExit = await installProcess.exit;
    if (installExit !== 0) {
      throw new Error(`npm install failed with exit code ${installExit}`);
    }
    console.log("[WC][NPM] ✅ npm install complete");
    console.log("[WC][NPM] npm install exit check COMPLETE — now proceeding to patches");

    // ════════════════════════════════════════════════════════════════════════════════
    // 🔥 CRITICAL SECTION: Patches MUST run AFTER npm install is verified complete
    // ════════════════════════════════════════════════════════════════════════════════
    console.log("[WC][PATCH] Starting patch applications (AFTER npm install)...");
    
    if (!_babelPatched) {
      console.log("[WC][PATCH] Applying babel patches...");
      await patchBabel(wc);
      _babelPatched = true;
    }
    
    if (!_esbuildPatched) {
      console.log("[WC][PATCH] Applying esbuild patches...");
      await patchEsbuild(wc);
    }
    
    console.log("[WC][PATCH] ✅ All patches applied successfully");
    // ════════════════════════════════════════════════════════════════════════════════

    // 🔥 START SERVER
    if (!_devProcess) {
      await startDevServer(wc);
    }

    _setStatus("running");
    console.log("[WC][PIPELINE] ✅ COMPLETE");

  } catch (err) {
    console.error("[WC][PIPELINE] ❌", err);
    _setStatus("error");
  }
}

async function _doRemountForce(files: AIFile[], projectId: string | null = null) {
  const blockingStatuses = ["booting", "mounting", "installing", "starting"];
  if (blockingStatuses.includes(_globalStatus)) {
    console.warn(`[WC][REMOUNT] Blocked during ${_globalStatus}`); return;
  }
  if (!_instance) { await _doMountAndRun(files, projectId); return; }
  if (!hasRequiredFiles(files)) { _setStatus("waiting-files"); return; }
  files = applyOverrides(files);
  try {
    if (projectId && projectId !== _activeProjectId) _activeProjectId = projectId;
    _bootstrapped = false;
    _setStatus("restarting");
    await killDevServer();
    await _writeFilesToFs(files);
    
    // Verify vite still exists
    let viteFound2 = false;
    const vitePaths2 = [
      "node_modules/vite/bin/vite.js",
      "node_modules/.bin/vite",
      "node_modules/vite/dist/node/cli.js",
    ];
    for (const vitePath of vitePaths2) {
      try {
        await _instance.fs.readFile(vitePath, "utf8");
        viteFound2 = true;
        break;
      } catch { }
    }
    if (!viteFound2) { await _doMountAndRun(files, projectId); return; }
    
    await startDevServer(_instance);
  } catch (err) {
    console.error("[WC][REMOUNT]", err);
    _bootstrapped = false;
    _setStatus("error");
  }
}

async function _doWriteFiles(files: AIFile[]) {
  const blockingStatuses = ["booting", "mounting", "installing", "starting"];
  if (blockingStatuses.includes(_globalStatus)) {
    console.warn(`[WC][WRITE] Blocked during ${_globalStatus}`); return;
  }
  if (_bootstrapped) { console.warn("[WC] Ignoring write after bootstrap"); _setStatus("running"); return; }
  if (!_instance || !_snapshotLoaded) { await _doMountAndRun(files); return; }
  try {
    files = files.map((f) => ({ ...f, content: sanitizeContent(f.content) }));
    _setStatus("writing");
    await _writeFilesToFs(files);
    _setStatus("running");
  } catch (err) {
    console.error("[WC][WRITE]", err);
    _setStatus("error");
  }
}

async function _runExclusive(fn: () => Promise<void>) {
  if (_busy) { _pendingFn = fn; return; }
  _busy = true;
  try { await fn(); }
  catch (err) { console.error("[WC]", err); _setStatus("error"); }
  finally {
    _busy = false; _notify();
    if (_pendingFn) { const next = _pendingFn; _pendingFn = null; _runExclusive(next); }
  }
}

export const useWebContainer = () => {
  const [, rerender] = useState(0);

  useEffect(() => {
    const listener = () => rerender((n) => n + 1);
    _listeners.add(listener);
    return () => { _listeners.delete(listener); };
  }, []);

  const mountAndRun = useCallback(async (files: AIFile[], projectId: string | null = null) => {
    if (_globalStatus === "running" && projectId === _activeProjectId) return;
    console.log(`[WC] mountAndRun for project: ${projectId}`);
    await _runExclusive(() => _doMountAndRun(files, projectId));
  }, []);

  const remount = useCallback(async (files: AIFile[], projectId: string | null = null) => {
    console.log(`[WC] remount for project: ${projectId}`);
    await _runExclusive(() => _doRemountForce(files, projectId));
  }, []);

  const writeFiles = useCallback(async (files: AIFile[]) => {
    await _runExclusive(() => _doWriteFiles(files));
  }, []);

  return {
    status:      _globalStatus,
    url:         _globalUrl,
    isRunning:   _globalStatus === "running",
    isInstalled: _snapshotLoaded,
    mountAndRun,
    remount,
    writeFiles,
  };
};