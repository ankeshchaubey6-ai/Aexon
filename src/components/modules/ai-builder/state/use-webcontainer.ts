"use client";

// src/components/modules/ai-builder/state/use-webcontainer.ts

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
  | "remounting"
  | "running"
  | "error";

// ─────────────────────────────────────────────────────────────
// GLOBAL SINGLETON STATE
// All hook instances share the same state and listeners.
// ─────────────────────────────────────────────────────────────
let _instance: WebContainer | null = null;
let _bootPromise: Promise<WebContainer> | null = null;
let _globalStatus: WCStatus = "idle";
let _globalUrl: string | null = null;
let _devProcess: Awaited<ReturnType<WebContainer["spawn"]>> | null = null;
let _installed = false;
let _busy = false; // prevent concurrent mountAndRun calls

// Listeners — every hook instance subscribes here
const _listeners = new Set<() => void>();

function _notify() {
  _listeners.forEach((fn) => fn());
}

function _setStatus(s: WCStatus) {
  _globalStatus = s;
  _notify();
}

function _setUrl(u: string | null) {
  _globalUrl = u;
  _notify();
}

// ─────────────────────────────────────────────────────────────
// BOOT
// ─────────────────────────────────────────────────────────────
async function bootOnce(): Promise<WebContainer> {
  if (_instance) return _instance;
  if (_bootPromise) return _bootPromise;

  _bootPromise = WebContainer.boot().then((wc) => {
    _instance = wc;
    return wc;
  });

  return _bootPromise;
}

// ─────────────────────────────────────────────────────────────
// FILE TREE BUILDER
// ─────────────────────────────────────────────────────────────
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

// ─────────────────────────────────────────────────────────────
// REQUIRED FILE CHECK
// ─────────────────────────────────────────────────────────────
function hasRequiredFiles(files: AIFile[]): boolean {
  return (
    files.some((f) => f.path === "package.json") &&
    files.some((f) => f.path === "src/main.jsx") &&
    files.some((f) => f.path === "src/App.jsx")
  );
}

// ─────────────────────────────────────────────────────────────
// WAIT FOR FILE IN FS
// ─────────────────────────────────────────────────────────────
async function waitForFile(path: string) {
  if (!_instance) return;
  while (true) {
    try {
      await _instance.fs.readFile(path);
      break;
    } catch {
      await new Promise((r) => setTimeout(r, 100));
    }
  }
}

// ─────────────────────────────────────────────────────────────
// CORE LOGIC (module-level, not inside hook)
// ─────────────────────────────────────────────────────────────
async function _doMountAndRun(files: AIFile[], isRemount = false) {
  if (_busy) {
    console.warn("[WebContainer] Already busy, skipping duplicate call");
    return;
  }

  if (!hasRequiredFiles(files)) {
    _setStatus("waiting-files");
    return;
  }

  _busy = true;

  try {
    _setStatus(isRemount ? "remounting" : "booting");
    _setUrl(null);

    if (_devProcess) {
      try { _devProcess.kill(); } catch {}
      _devProcess = null;
    }

    const wc = await bootOnce();

    // Remove old server-ready listeners to avoid duplicates
    // (WebContainer doesn't expose removeListener, so we track via flag)
    _setStatus("mounting");
    await wc.mount(buildFileTree(files));

    await waitForFile("src/App.jsx");
    await waitForFile("src/main.jsx");

    // Always reinstall on remount (new package.json may differ)
    if (!_installed || isRemount) {
      _setStatus("installing");

      const install = await wc.spawn("npm", ["install"]);
      install.output.pipeTo(
        new WritableStream({ write(chunk) { console.log("[npm install]", chunk); } })
      );

      const exit = await install.exit;
      if (exit !== 0) {
        _setStatus("install-failed");
        _busy = false;
        return;
      }

      _installed = true;
    }

    _setStatus("starting");

    const dev = await wc.spawn("npm", ["run", "dev"]);
    _devProcess = dev;

    dev.output.pipeTo(
      new WritableStream({ write(chunk) { console.log("[vite]", chunk); } })
    );

    // Use a one-time listener flag so server-ready only fires once per boot
    let resolved = false;
    wc.on("server-ready", (_port, serverUrl) => {
      if (resolved) return;
      resolved = true;
      _setUrl(serverUrl);
      _setStatus("running");
      _busy = false;
    });

  } catch (err) {
    console.error("[WebContainer]", err);
    _setStatus("error");
    _busy = false;
  }
}

async function _doWriteFiles(files: AIFile[]) {
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

// ─────────────────────────────────────────────────────────────
// HOOK — just subscribes to global state
// ─────────────────────────────────────────────────────────────
export const useWebContainer = () => {
  // Force re-render when global state changes
  const [, rerender] = useState(0);

  useEffect(() => {
    const listener = () => rerender((n) => n + 1);
    _listeners.add(listener);
    return () => { _listeners.delete(listener); };
  }, []);

  const mountAndRun = useCallback(async (files: AIFile[]) => {
    await _doMountAndRun(files, false);
  }, []);

  const remount = useCallback(async (files: AIFile[]) => {
    _installed = false; // force reinstall on remount
    await _doMountAndRun(files, true);
  }, []);

  const writeFiles = useCallback(async (files: AIFile[]) => {
    await _doWriteFiles(files);
  }, []);

  return {
    status: _globalStatus,
    url: _globalUrl,
    isRunning: _globalStatus === "running",
    mountAndRun,
    writeFiles,
    remount,
  };
};