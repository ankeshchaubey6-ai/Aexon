// src/components/modules/ai-builder/state/use-webcontainer.ts

"use client";

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

// ─── Global singleton ─────────────────────────

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

// ─── Reset ─────────────────────────

export function resetContainer() {
  if (_devProcess) {
    try { _devProcess.kill(); } catch {}
    _devProcess = null;
  }
  _installed = false;
  _busy = false;
  _pendingFn = null;
  _setUrl(null);
  _setStatus("idle");
}

// ─── Boot ─────────────────────────

async function bootOnce(): Promise<WebContainer> {
  if (_instance) return _instance;
  if (_bootPromise) return _bootPromise;

  _bootPromise = WebContainer.boot().then((wc) => {
    _instance = wc;
    return wc;
  });

  return _bootPromise;
}

// ─── Helpers ─────────────────────────

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
    try {
      await _instance.fs.readFile(path);
      return;
    } catch {}
    await new Promise((r) => setTimeout(r, 100));
  }
}

// ─── Kill dev server ─────────────────────────

async function killDevServer() {
  if (_devProcess) {
    try { _devProcess.kill(); } catch {}
    _devProcess = null;
    await new Promise((r) => setTimeout(r, 300));
  }
}

// ─── Write files ─────────────────────────

async function _writeFilesToFs(files: AIFile[]) {
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

// ─── Start dev server ─────────────────────────

async function _startDevServer(wc: WebContainer) {
  _setStatus("starting");

  const dev = await wc.spawn("npm", ["run", "dev"]);
  _devProcess = dev;

  dev.output.pipeTo(
    new WritableStream({
      write(chunk) {
        console.log("[vite]", String(chunk));
      },
    })
  );

  await new Promise<void>((resolve) => {
    let resolved = false;

    wc.on("server-ready", (_port, url) => {
      if (resolved) return;
      resolved = true;
      _setUrl(url);
      _setStatus("running");
      resolve();
    });
  });
}

// ─── FULL PIPELINE ─────────────────────────

async function _doMountAndRun(files: AIFile[]) {
  if (!hasRequiredFiles(files)) {
    _setStatus("waiting-files");
    return;
  }

  const pkg = files.find((f) => f.path === "package.json");
  if (!pkg) {
    console.error("❌ Missing package.json");
    _setStatus("error");
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

  // 🔥 CLEAN INSTALL FIX
  try { await wc.fs.rm("node_modules", { recursive: true }); } catch {}
  try { await wc.fs.rm("package-lock.json"); } catch {}

  const install = await wc.spawn("npm", ["install", "--no-audit", "--no-fund"]);

  install.output.pipeTo(
    new WritableStream({
      write(chunk) {
        console.log("[npm]", String(chunk));
      },
    })
  );

  const exitCode = await Promise.race([
    install.exit,
    new Promise<number>((_, reject) =>
      setTimeout(() => reject(new Error("npm timeout")), 20000)
    ),
  ]);

  if (exitCode !== 0) {
    _setStatus("install-failed");
    return;
  }

  _installed = true;

  await _startDevServer(wc);
}

// ─── FAST UPDATE ─────────────────────────

async function _doWriteAndRestart(files: AIFile[]) {
  if (!_instance || !_installed) {
    return _doMountAndRun(files);
  }

  if (!hasRequiredFiles(files)) {
    _setStatus("waiting-files");
    return;
  }

  _setStatus("writing");

  await killDevServer();
  await _writeFilesToFs(files);

  _setStatus("restarting");
  await _startDevServer(_instance);
}

// ─── Queue system ─────────────────────────

async function _runExclusive(fn: () => Promise<void>) {
  if (_busy) {
    _pendingFn = fn;
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

    if (_pendingFn) {
      const next = _pendingFn;
      _pendingFn = null;
      _runExclusive(next);
    }
  }
}

// ─── Hook ─────────────────────────

export const useWebContainer = () => {
  const [, rerender] = useState(0);

  useEffect(() => {
    const listener = () => rerender((n) => n + 1);
    _listeners.add(listener);
    return () => {
  _listeners.delete(listener);
};
  }, []);

  const mountAndRun = useCallback(async (files: AIFile[]) => {
    await _runExclusive(() => _doMountAndRun(files));
  }, []);

  const remount = useCallback(async (files: AIFile[]) => {
    await _runExclusive(() => _doWriteAndRestart(files));
  }, []);

  return {
    status: _globalStatus,
    url: _globalUrl,
    isRunning: _globalStatus === "running",
    isInstalled: _installed,
    mountAndRun,
    remount,
  };
};