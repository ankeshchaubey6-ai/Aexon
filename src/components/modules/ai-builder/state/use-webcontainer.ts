"use client";

import { useState, useCallback } from "react";
import { WebContainer } from "@webcontainer/api";
import type { FileSystemTree } from "@webcontainer/api";

type AIFile = { path: string; content: string };

// ─────────────────────────────────────────────────────────────
// MODULE-LEVEL SINGLETONS
// Stored outside React so they survive HMR reloads and
// re-renders. A new component mount NEVER re-boots the container.
// ─────────────────────────────────────────────────────────────
let _instance: WebContainer | null = null;
let _bootPromise: Promise<WebContainer> | null = null;

// Track container lifecycle flags together so they're always in sync
const _state = {
  mounted: false,     // files have been mounted
  installed: false,   // npm install completed
  running: false,     // dev server is up
  devProcess: null as Awaited<ReturnType<WebContainer["spawn"]>> | null,
};

// ─────────────────────────────────────────────────────────────
// BOOT — idempotent, only ever runs once per page load
// ─────────────────────────────────────────────────────────────
async function bootOnce(): Promise<WebContainer> {
  if (_instance) return _instance;

  // If a boot is already in progress, wait for it
  if (_bootPromise) return _bootPromise;

  _bootPromise = WebContainer.boot().then((wc) => {
    _instance = wc;
    return wc;
  });

  return _bootPromise;
}

// ─────────────────────────────────────────────────────────────
// FILE TREE — converts flat file list to WebContainer fs tree
// ─────────────────────────────────────────────────────────────
function buildFileTree(files: AIFile[]): FileSystemTree {
  const tree: FileSystemTree = {};

  for (const file of files) {
    const parts = file.path.replace(/^\//, "").split("/");
    let current: any = tree;

    parts.forEach((part, index) => {
      if (index === parts.length - 1) {
        current[part] = {
          file: {
            contents: file.content,
          },
        };
      } else {
        if (!current[part]) {
          current[part] = { directory: {} };
        }
        current = current[part].directory;
      }
    });
  }

  return tree;
}

// ─────────────────────────────────────────────────────────────
// HOOK
// ─────────────────────────────────────────────────────────────
export const useWebContainer = () => {
  const [status, setStatus] = useState<string>("idle");
  const [url, setUrl] = useState<string | null>(null);

  // ── mountAndRun ──────────────────────────────────────────
  // Called once when the first complete set of files arrives.
  // Boots container → mounts files → npm install → npm run dev.
  const mountAndRun = useCallback(async (files: AIFile[]) => {
    if (_state.running) {
      // Container already running — just patch changed files
      await writeFiles(files);
      return;
    }

    try {
      setStatus("booting");
      const wc = await bootOnce();

      // ── Mount ──
      setStatus("mounting");
      await wc.mount(buildFileTree(files));
      _state.mounted = true;

      // ── Install ──
      // Only install if we haven't yet (survives re-renders, not page reload)
      if (!_state.installed) {
        setStatus("installing");

        const install = await wc.spawn("npm", ["install"]);

        // Stream install output for debugging
        install.output.pipeTo(
          new WritableStream({
            write(chunk) {
              // Uncomment for verbose install logs:
              // console.log("[npm install]", chunk);
            },
          })
        );

        const exitCode = await install.exit;

        if (exitCode !== 0) {
          setStatus("install-failed");
          console.error("npm install failed with exit code", exitCode);
          return;
        }

        _state.installed = true;
      }

      // ── Dev server ──
      setStatus("starting");

      // Kill any previous dev process (e.g. after a full remount)
      if (_state.devProcess) {
        try { _state.devProcess.kill(); } catch (_) {}
        _state.devProcess = null;
      }

      const dev = await wc.spawn("npm", ["run", "dev"]);
      _state.devProcess = dev;

      dev.output.pipeTo(
        new WritableStream({
          write(chunk) {
            // Uncomment for verbose dev server logs:
            // console.log("[dev]", chunk);
          },
        })
      );

      // ── Server ready ──
      wc.on("server-ready", (_port, serverUrl) => {
        _state.running = true;
        setUrl(serverUrl);
        setStatus("running");
        console.log("✅ Preview ready:", serverUrl);
      });

    } catch (err) {
      console.error("WebContainer error:", err);
      _state.running = false;
      setStatus("error");
    }
  }, []);

  // ── writeFiles ───────────────────────────────────────────
  // Writes changed files directly into the running container.
  // Vite HMR detects the changes and updates the preview instantly.
  // Only touches files that actually changed — never triggers a reload.
  const writeFiles = useCallback(async (files: AIFile[]) => {
    if (!_instance) {
      console.warn("writeFiles called before container is ready");
      return;
    }

    const results = await Promise.allSettled(
      files.map(async (file) => {
        const normalizedPath = file.path.replace(/^\//, "");
        const parts = normalizedPath.split("/");

        // Ensure parent directories exist
        if (parts.length > 1) {
          const dir = parts.slice(0, -1).join("/");
          await _instance!.fs.mkdir(dir, { recursive: true });
        }

        await _instance!.fs.writeFile(normalizedPath, file.content);
      })
    );

    const failed = results.filter((r) => r.status === "rejected");
    if (failed.length > 0) {
      console.warn(
        `⚠️ ${failed.length}/${files.length} file writes failed`,
        failed
      );
    } else {
      console.log(`⚡ Patched ${files.length} file(s)`);
    }
  }, []);

  // ── remount ──────────────────────────────────────────────
  // Full remount: used when the user generates a completely new project.
  // Kills the dev server, clears state flags, remounts fresh files.
  const remount = useCallback(async (files: AIFile[]) => {
    if (!_instance) {
      // Container not booted yet — just do a normal mountAndRun
      await mountAndRun(files);
      return;
    }

    try {
      setStatus("remounting");
      setUrl(null);

      // Kill dev server
      if (_state.devProcess) {
        try { _state.devProcess.kill(); } catch (_) {}
        _state.devProcess = null;
      }

      // Reset flags (keep installed=true — node_modules still exist)
      _state.mounted = false;
      _state.running = false;

      // Remount files
      setStatus("mounting");
      await _instance.mount(buildFileTree(files));
      _state.mounted = true;

      // Restart dev server
      setStatus("starting");
      const dev = await _instance.spawn("npm", ["run", "dev"]);
      _state.devProcess = dev;

      dev.output.pipeTo(new WritableStream({ write() {} }));

      _instance.on("server-ready", (_port, serverUrl) => {
        _state.running = true;
        setUrl(serverUrl);
        setStatus("running");
      });

    } catch (err) {
      console.error("Remount error:", err);
      setStatus("error");
    }
  }, [mountAndRun]);

  return {
    status,
    url,
    isRunning: _state.running,
    mountAndRun,
    writeFiles,
    remount,
  };
};