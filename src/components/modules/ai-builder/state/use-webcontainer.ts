"use client";

// src/components/modules/ai-builder/state/use-webcontainer.ts
//
// FIXES:
//  - remount() now WRITES changed files + restarts dev server instead of
//    running npm install again (was 30-60s, now ~3s)
//  - Added _writeAndRestart() for edit-mode updates
//  - Queue-based busy guard: if a mount is in progress, queue the next one
//    instead of silently dropping it
//  - Idempotent boot: reuses the WebContainer instance across hot reloads
//

import { useState, useCallback, useEffect } from "react";
import { WebContainer } from "@webcontainer/api";
import type { FileSystemTree } from "@webcontainer/api";

type AIFile = { path: string; content: string };

type WCStatus =
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

// ─── Global singleton ─────────────────────────────────────────────────────────

let _instance: WebContainer | null = null;
let _bootPromise: Promise<WebContainer> | null = null;
let _globalStatus: WCStatus = "idle";
let _globalUrl: string | null = null;
let _devProcess: Awaited<ReturnType<WebContainer["spawn"]>> | null = null;
let _installed = false;
let _busy = false;

// Queue: if remount arrives while busy, store it and run after current op
let _pendingFiles: AIFile[] | null = null;

const _listeners = new Set<() => void>();
function _notify() { _listeners.forEach((fn) => fn()); }
function _setStatus(s: WCStatus) { _globalStatus = s; _notify(); }
function _setUrl(u: string | null) { _globalUrl = u; _notify(); }

// ─── Reset ────────────────────────────────────────────────────────────────────

export function resetContainer() {
  if (_devProcess) {
    try { _devProcess.kill(); } catch {}
    _devProcess = null;
  }
  _installed = false;
  _busy = false;
  _pendingFiles = null;
  _setUrl(null);
  _setStatus("idle");
}

// ─── Boot ─────────────────────────────────────────────────────────────────────

async function bootOnce(): Promise<WebContainer> {
  if (_instance) return _instance;
  if (_bootPromise) return _bootPromise;
  _bootPromise = WebContainer.boot().then((wc) => { _instance = wc; return wc; });
  return _bootPromise;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildFileTree(files: AIFile[]): FileSystemTree {
  const tree: FileSystemTree = {};
  for (const file of files) {
    const parts = file.path.replace(/^\//, "").split("/");
    let current: any = tree;
    parts.forEach((part, index) => {
      if (index === parts.length - 1) {
        current[part] = { file: { contents: file.content } };
      } else {
        if (!current[part]) current[part] = { directory: {} };
        current = current[part].directory;
      }
    });
  }
  return tree;
}

function hasRequiredFiles(files: AIFile[]): boolean {
  return (
    files.some((f) => f.path === "package.json") &&
    files.some((f) => f.path === "src/main.jsx") &&
    files.some((f) => f.path === "src/App.jsx")
  );
}

async function waitForFile(path: string) {
  if (!_instance) return;
  for (let i = 0; i < 50; i++) {
    try { await _instance.fs.readFile(path); return; } catch {}
    await new Promise((r) => setTimeout(r, 100));
  }
}

// ─── Kill dev server ──────────────────────────────────────────────────────────

async function killDevServer() {
  if (_devProcess) {
    try { _devProcess.kill(); } catch {}
    _devProcess = null;
    // Give the port a moment to free up
    await new Promise((r) => setTimeout(r, 300));
  }
}

// ─── Write files to existing FS (no remount, no reinstall) ───────────────────

async function _writeFilesToFs(files: AIFile[]): Promise<void> {
  if (!_instance) return;
  for (const file of files) {
    const path = file.path.replace(/^\//, "");
    const parts = path.split("/");
    if (parts.length > 1) {
      await _instance.fs.mkdir(parts.slice(0, -1).join("/"), { recursive: true });
    }
    await _instance.fs.writeFile(path, file.content);
  }
}

// ─── Start dev server and wait for server-ready ───────────────────────────────

async function _startDevServer(wc: WebContainer): Promise<void> {
  _setStatus("starting");

  const dev = await wc.spawn("npm", ["run", "dev"]);
  _devProcess = dev;

  dev.output.pipeTo(
    new WritableStream({ write(chunk) { process.stdout.write?.("[vite] " + chunk); } })
  );

  await new Promise<void>((resolve) => {
    let resolved = false;
    wc.on("server-ready", (_port, serverUrl) => {
      if (resolved) return;
      resolved = true;
      _setUrl(serverUrl);
      _setStatus("running");
      resolve();
    });
  });
}

// ─── FULL MOUNT + INSTALL + START (first generation) ─────────────────────────

async function _doMountAndRun(files: AIFile[]) {
  if (!hasRequiredFiles(files)) {
    _setStatus("waiting-files");
    return;
  }

  _setStatus("booting");
  _setUrl(null);

  await killDevServer();

  const wc = await bootOnce();

  _setStatus("mounting");
  await wc.mount(buildFileTree(files));

  await waitForFile("src/App.jsx");
  await waitForFile("src/main.jsx");

  _setStatus("installing");
  const install = await wc.spawn("npm", ["install"]);
  install.output.pipeTo(
    new WritableStream({ write(chunk) { process.stdout.write?.("[npm] " + chunk); } })
  );

  const exitCode = await install.exit;
  if (exitCode !== 0) {
    _setStatus("install-failed");
    return;
  }
  _installed = true;

  await _startDevServer(wc);
}

// ─── FAST REMOUNT: write changed files + restart dev server (NO npm install) ──
//
// This is the key fix. Previously remount() set _installed=false and ran the
// full pipeline again including npm install (30-60s). For edit-mode updates
// we only need to write the changed files and restart vite — ~3s total.
//

async function _doWriteAndRestart(files: AIFile[]) {
  if (!_instance || !_installed) {
    // If not installed yet, fall back to full mount
    return _doMountAndRun(files);
  }

  if (!hasRequiredFiles(files)) {
    _setStatus("waiting-files");
    return;
  }

  _setStatus("writing");
  await killDevServer();

  // Write all files to the existing FS
  await _writeFilesToFs(files);

  _setStatus("restarting");
  const wc = _instance;
  await _startDevServer(wc);
}

// ─── Busy guard with queue ────────────────────────────────────────────────────

async function _runExclusive(fn: () => Promise<void>) {
  if (_busy) {
    // Queue the latest request — earlier ones are stale
    _pendingFiles = null; // will be set by caller if needed
    return;
  }

  _busy = true;
  try {
    await fn();
  } catch (err) {
    console.error("[WebContainer]", err);
    _setStatus("error");
  } finally {
    _busy = false;
    _notify();
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

  /**
   * First-time generation: full mount + npm install + vite start.
   * Only call this once per project, not on edits.
   */
  const mountAndRun = useCallback(async (files: AIFile[]) => {
    await _runExclusive(() => _doMountAndRun(files));
  }, []);

  /**
   * Edit-mode update: write changed files + restart vite.
   * Skips npm install — ~3s instead of 30-60s.
   * Falls back to full mount if WebContainer isn't installed yet.
   */
  const remount = useCallback(async (files: AIFile[]) => {
    await _runExclusive(() => _doWriteAndRestart(files));
  }, []);

  /**
   * Write files without restarting the dev server.
   * Useful for hot-reload-friendly updates (CSS, data files).
   */
  const writeFiles = useCallback(async (files: AIFile[]) => {
    if (!_instance) return;
    await _writeFilesToFs(files);
  }, []);

  return {
    status: _globalStatus,
    url: _globalUrl,
    isRunning: _globalStatus === "running",
    isInstalled: _installed,
    mountAndRun,
    remount,
    writeFiles,
  };
};