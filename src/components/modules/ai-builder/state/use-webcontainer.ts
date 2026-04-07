"use client";

// src/components/modules/ai-builder/state/use-webcontainer.ts
//
// FIX A — esm.sh CDN aliases DON'T work inside WebContainer. Use real npm installs.
// FIX B — Cross-Origin-Isolation headers required (COOP + COEP in next.config.js)
// FIX C — `server-ready` race with killed process — cleanup ref prevents dangling listeners
// FIX D — npm install timeout raised to 180 s
// FIX E — "Unable to create more instances" — _bootPromise NEVER cleared after first set
// FIX F — resetContainer() never touches _instance or _bootPromise
//
// FIX G1 — node_modules deleted BEFORE mount, not after
//   Previous code: mount() → rm node_modules (race: esbuild already scanned the FS)
//   Fixed:         rm node_modules → rm package-lock → mount()
//
// FIX G2 — server-ready listener leaks across restarts (BLANK IFRAME ROOT CAUSE)
//   WebContainer.on() is cumulative — listeners are never automatically removed.
//   On restart #2, both the old and new listeners fire. The old one sets _globalUrl
//   to a dead URL. The iframe gets key={deadUrl}, mounts, gets nothing → blank white.
//   Fix: capture the unsubscribe function returned by wc.on() and call it on
//        resolve / reject / timeout so only ONE listener is ever active at a time.
//
// FIX G3 — killDevServer delay raised from 400 ms → 800 ms
//   Vite + esbuild WASM needs ~800 ms to fully exit and release the port.
//   At 400 ms the new Vite process collides with the dying one; server-ready fires
//   on a half-dead port → iframe loads a connection-refused blank page.
//
// FIX G4 — Atomic file writes (write to *.tmp → rename)
//   _writeFilesToFs used to write each file in place. esbuild's HMR watcher can
//   read a file mid-write, getting truncated/invalid content → WASM panic.
//   Fix: write to `<path>.__tmp__`, then rename to `<path>` (atomic at FS level).
//
// FIX G5 — Don't clear _globalUrl until the new server is actually ready
//   Previous code called _setUrl(null) at the very start of _doMountAndRun.
//   This destroyed the existing iframe immediately (key={url} → key={null}).
//   The new iframe then had nothing to load until server-ready fired much later.
//   Combined with a stale server-ready from a previous run (FIX G2), this was
//   the primary cause of the persistent blank white screen.
//   Fix: only call _setUrl(newUrl) inside the server-ready handler. Never set null
//   eagerly; let the placeholder show while status != "running".

import { useState, useCallback, useEffect } from "react";
import { WebContainer } from "@webcontainer/api";
import type { FileSystemTree } from "@webcontainer/api";

type AIFile = { path: string; content: string };

export type WCStatus =
  | "idle"
  | "waiting-files"
  | "booting"
  | "mounting"
  | "installing"
  | "install-failed"
  | "starting"
  | "writing"
  | "restarting"
  | "running"
  | "error";

// ─── Global singleton ──────────────────────────────────────────────────────────
let _instance: WebContainer | null = null;
let _bootPromise: Promise<WebContainer> | null = null;
let _globalStatus: WCStatus = "idle";
let _globalUrl: string | null = null;
let _devProcess: Awaited<ReturnType<WebContainer["spawn"]>> | null = null;
let _installed = false;
let _busy = false;
let _pendingFn: (() => Promise<void>) | null = null;

const _listeners = new Set<() => void>();
function _notify() { _listeners.forEach((fn) => fn()); }
function _setStatus(s: WCStatus) { _globalStatus = s; _notify(); }
function _setUrl(u: string | null) { _globalUrl = u; _notify(); }

// ─── Reset (project switch / new generation) ───────────────────────────────────
// NEVER touches _instance or _bootPromise — those are page-lifetime singletons.
export function resetContainer() {
  if (_devProcess) {
    try { _devProcess.kill(); } catch {}
    _devProcess = null;
  }
  _installed = false;
  _busy      = false;
  _pendingFn = null;
  // FIX G5: do NOT call _setUrl(null) here. The iframe stays showing the last
  // good URL during the transition. It gets replaced when server-ready fires.
  _setStatus("idle");
}

// ─── Boot singleton ────────────────────────────────────────────────────────────
async function bootOnce(): Promise<WebContainer> {
  if (_instance)    return _instance;
  if (_bootPromise) return _bootPromise;

  _bootPromise = WebContainer.boot().then(
    (wc) => { _instance = wc; return wc; },
    (err) => {
      // Never clear _bootPromise — browser holds the WC instance regardless.
      const msg = String(err?.message ?? err);
      if (
        msg.includes("SharedArrayBuffer") ||
        msg.includes("cross-origin")      ||
        msg.includes("isolation")         ||
        msg.includes("crossOriginIsolated")
      ) {
        throw new Error(
          "WebContainer requires Cross-Origin-Isolation headers.\n" +
          "Add to next.config.js headers():\n" +
          "  Cross-Origin-Opener-Policy: same-origin\n" +
          "  Cross-Origin-Embedder-Policy: require-corp"
        );
      }
      throw err;
    }
  );
  return _bootPromise;
}

// ─── Sanitize ──────────────────────────────────────────────────────────────────
function sanitizeContent(content: string): string {
  return content
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/[\u0000-\u0008\u000C\u000E-\u001F\u007F]/g, "")
    .replace(/[\u200B-\u200D\u2028\u2029\uFEFF]/g, "")
    .slice(0, 60_000);
}

// ─── File tree builder ─────────────────────────────────────────────────────────
function buildFileTree(files: AIFile[]): FileSystemTree {
  const tree: FileSystemTree = {};
  for (const file of files) {
    const parts = file.path.replace(/^\//, "").split("/");
    let current: Record<string, unknown> = tree;
    parts.forEach((part, index) => {
      if (index === parts.length - 1) {
        (current as FileSystemTree)[part] = { file: { contents: file.content } };
      } else {
        if (!current[part]) current[part] = { directory: {} };
        current = (current[part] as { directory: Record<string, unknown> }).directory;
      }
    });
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

// ─── Minimal package.json ──────────────────────────────────────────────────────
const MINIMAL_PACKAGE_JSON = JSON.stringify(
  {
    name: "ai-project",
    private: true,
    version: "0.0.0",
    type: "module",
    scripts: {
      dev:     "vite --host",
      build:   "vite build",
      preview: "vite preview",
    },
    dependencies: {
      react:           "^18.2.0",
      "react-dom":     "^18.2.0",
      "framer-motion": "^11.0.8",
      "lucide-react":  "^0.363.0",
      clsx:            "^2.1.0",
    },
    devDependencies: {
      vite:                   "^5.2.6",
      "@vitejs/plugin-react": "^4.2.1",
    },
  },
  null,
  2
);

// ─── Plain vite config (no Tailwind/PostCSS — that's what caused the WASM panic) ──
const PLAIN_VITE_CONFIG = `import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    open: false,
    port: 5173,
    strictPort: false,
  },
  optimizeDeps: {
    include: ['react', 'react-dom', 'react-dom/client'],
  },
});
`;

// ─── Kill dev server ───────────────────────────────────────────────────────────
// FIX G3: 800 ms wait — Vite + esbuild WASM needs ~800 ms to fully exit.
async function killDevServer() {
  if (_devProcess) {
    try { _devProcess.kill(); } catch {}
    _devProcess = null;
    await new Promise((r) => setTimeout(r, 800));
  }
}

// ─── Write files to FS (atomic: tmp → rename) ─────────────────────────────────
// FIX G4: write to *.tmp first, then rename — esbuild's HMR watcher can never
// read a half-written file, which was causing the WASM panic on mid-write reads.
async function _writeFilesToFs(files: AIFile[]) {
  if (!_instance) return;
  for (const file of files) {
    const path  = file.path.replace(/^\//, "");
    const parts = path.split("/");
    if (parts.length > 1) {
      await _instance.fs.mkdir(parts.slice(0, -1).join("/"), { recursive: true });
    }
    const tmpPath = `${path}.__tmp__`;
    await _instance.fs.writeFile(tmpPath, sanitizeContent(file.content));
    await _instance.fs.rename(tmpPath, path);
  }
}

// ─── Start Vite dev server ────────────────────────────────────────────────────
// FIX G2: wc.on("server-ready") is cumulative. Capture the returned unsubscribe
// function and call it on all exit paths (resolve / reject / timeout) so stale
// listeners from previous runs can never fire and overwrite _globalUrl.
async function _startDevServer(wc: WebContainer): Promise<void> {
  _setStatus("starting");
  const dev = await wc.spawn("npm", ["run", "dev"]);
  _devProcess = dev;

  dev.output.pipeTo(
    new WritableStream({
      write(chunk) { console.log("[vite]", String(chunk)); },
    })
  );

  await new Promise<void>((resolve, reject) => {
    let settled = false;

    // FIX G2: capture the unsubscribe so we can remove this exact listener.
    const unsub = wc.on("server-ready", (_port, serverUrl) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      unsub(); // ← remove this listener immediately so it never fires again
      _setUrl(serverUrl);   // FIX G5: URL only set here, never cleared eagerly
      _setStatus("running");
      resolve();
    });

    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      unsub(); // ← remove listener on timeout too
      reject(new Error("Vite server-ready timeout after 60 s"));
    }, 60_000);
  });
}

// ─── Apply overrides ──────────────────────────────────────────────────────────
function applyOverrides(files: AIFile[]): AIFile[] {
  let result = files.map((f) => {
    if (f.path === "package.json") {
      return { ...f, content: MINIMAL_PACKAGE_JSON };
    }
    if (f.path === "vite.config.js" || f.path === "vite.config.ts") {
      return { path: "vite.config.js", content: PLAIN_VITE_CONFIG };
    }
    return f;
  });

  // Remove postcss.config.* and tailwind.config.* — they require packages
  // that aren't in MINIMAL_PACKAGE_JSON and cause the PostCSS esbuild panic.
  result = result.filter((f) =>
    !f.path.startsWith("postcss.config") &&
    !f.path.startsWith("tailwind.config")
  );

  const hasJs = result.some((f) => f.path === "vite.config.js");
  result = result.filter((f) => !(f.path === "vite.config.ts" && hasJs));

  if (!result.some((f) => f.path === "vite.config.js")) {
    result.push({ path: "vite.config.js", content: PLAIN_VITE_CONFIG });
  }

  return result;
}

// ─── FULL PIPELINE (fresh install) ────────────────────────────────────────────
// FIX G1: rm node_modules + package-lock BEFORE mount() so esbuild never sees
//         a torn node_modules tree.
// FIX G5: don't call _setUrl(null) at the top — the old URL stays visible in the
//         iframe while the new environment boots. It's replaced only in server-ready.
async function _doMountAndRun(files: AIFile[]) {
  if (!hasRequiredFiles(files)) {
    _setStatus("waiting-files");
    return;
  }

  files = files.map((f) => ({ ...f, content: sanitizeContent(f.content) }));
  files = applyOverrides(files);

  const totalChars = files.reduce((s, f) => s + f.content.length, 0);
  console.log(`📦 [WC] ${files.length} files, ${totalChars.toLocaleString()} chars`);

  _setStatus("booting");
  // FIX G5: removed _setUrl(null) from here. URL is cleared only when a new URL
  // is ready to replace it (inside _startDevServer → server-ready handler).

  await killDevServer();

  let wc: WebContainer;
  try {
    wc = await bootOnce();
  } catch (err) {
    console.error("[WC] boot failed:", err);
    _setStatus("error");
    return;
  }

  // FIX G1: delete stale artefacts BEFORE mounting the new file tree.
  _setStatus("mounting");
  try { await wc.fs.rm("node_modules",      { recursive: true }); } catch {}
  try { await wc.fs.rm("package-lock.json"                     ); } catch {}

  await wc.mount(buildFileTree(files));

  _setStatus("installing");
  const install = await wc.spawn("npm", [
    "install",
    "--no-audit",
    "--no-fund",
    "--no-optional",
    "--prefer-offline",
  ]);

  install.output.pipeTo(
    new WritableStream({
      write(chunk) { console.log("[npm]", String(chunk)); },
    })
  );

  const exitCode = await Promise.race([
    install.exit,
    new Promise<number>((_, reject) =>
      setTimeout(
        () => reject(new Error("npm install timeout after 180 s")),
        180_000
      )
    ),
  ]);

  if (exitCode !== 0) {
    console.error(`❌ [WC] npm install failed (exit ${exitCode})`);
    _setStatus("install-failed");
    return;
  }

  _installed = true;

  try {
    await _startDevServer(wc);
  } catch (err) {
    console.error("[WC] Vite start failed:", err);
    _setStatus("error");
  }
}

// ─── FAST UPDATE (write + restart Vite, no reinstall) ─────────────────────────
async function _doWriteAndRestart(files: AIFile[]) {
  if (!_instance || !_installed) return _doMountAndRun(files);
  if (!hasRequiredFiles(files)) { _setStatus("waiting-files"); return; }

  files = files.map((f) => ({ ...f, content: sanitizeContent(f.content) }));
  files = applyOverrides(files);

  _setStatus("writing");
  await killDevServer();            // FIX G3: 800 ms wait baked into killDevServer
  await _writeFilesToFs(files);     // FIX G4: atomic writes

  _setStatus("restarting");
  try {
    await _startDevServer(_instance); // FIX G2: no listener leak
  } catch (err) {
    console.error("[WC] Vite restart failed:", err);
    _setStatus("error");
  }
}

// ─── HOT PATCH (write changed files only, Vite HMR handles the rest) ─────────
async function _doWriteFiles(files: AIFile[]) {
  if (!_instance || !_installed) return _doMountAndRun(files);

  files = files.map((f) => ({ ...f, content: sanitizeContent(f.content) }));

  _setStatus("writing");
  await _writeFilesToFs(files);  // FIX G4: atomic writes
  _setStatus("running");
}

// ─── Queue (last-write-wins) ──────────────────────────────────────────────────
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

// ─── Hook ─────────────────────────────────────────────────────────────────────
export const useWebContainer = () => {
  const [, rerender] = useState(0);

  useEffect(() => {
    const listener = () => rerender((n) => n + 1);
    _listeners.add(listener);
    return () => { _listeners.delete(listener); };
  }, []);

  const mountAndRun = useCallback(async (files: AIFile[]) => {
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
    isInstalled: _installed,
    mountAndRun,
    remount,
    writeFiles,
  };
};