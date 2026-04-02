"use client";

// src/components/modules/ai-builder/preview/LivePreview.tsx

import { useEffect, useRef, memo } from "react";
import { Loader2, Monitor, AlertCircle, RefreshCw } from "lucide-react";
import { useAIBuilderStore } from "../state/ai-builder.store";
import { useWebContainer } from "../state/use-webcontainer";

type AIFile = { path: string; content: string };

const StatusBadge = ({ status }: { status: string }) => {
  const isRunning = status === "running";
  const isError = status === "error" || status === "install-failed";
  const isLoading = !isRunning && !isError && status !== "idle" && status !== "waiting";

  return (
    <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
      {isRunning && <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />}
      {isLoading && <Loader2 className="h-3 w-3 animate-spin text-yellow-500" />}
      {isError && <AlertCircle className="h-3 w-3 text-red-500" />}
      {status}
    </span>
  );
};

// projectId prop is used purely to detect project switches and reset boot state.
const LivePreview = memo(({ projectId }: { projectId: string | null }) => {
  const { files } = useAIBuilderStore();
  const { mountAndRun, writeFiles, remount, url, status } = useWebContainer();

  const isBootedRef = useRef(false);
  const prevFilesMapRef = useRef<Map<string, string>>(new Map());
  // Track which project we last booted for so we reset on switch.
  const bootedProjectIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!files.length) return;

    const hasPackageJson = files.some((f) => f.path === "package.json");
    if (!hasPackageJson) {
      console.log("⏳ [LivePreview] Waiting for package.json...");
      return;
    }

    // ── Project switch detected: reset boot state ──────────────────────
    // When AIWorkspace switches projects it calls resetContainer() which
    // clears _globalUrl to null. We mirror that here by resetting our refs
    // whenever the projectId prop changes.
    if (projectId !== bootedProjectIdRef.current) {
      console.log(`🔁 [LivePreview] Project changed → ${projectId}, resetting boot state`);
      isBootedRef.current = false;
      prevFilesMapRef.current = new Map();
      bootedProjectIdRef.current = projectId;
    }

    // ── First boot for this project ────────────────────────────────────
    if (!isBootedRef.current) {
      isBootedRef.current = true;
      prevFilesMapRef.current = new Map(files.map((f) => [f.path, f.content]));
      mountAndRun(files);
      return;
    }

    // ── Diff and patch ─────────────────────────────────────────────────
    const changed: AIFile[] = [];
    const newMap = new Map(files.map((f) => [f.path, f.content]));

    for (const file of files) {
      const prev = prevFilesMapRef.current.get(file.path);
      if (prev !== file.content) changed.push(file);
    }

    // Also catch newly added files that didn't exist before
    for (const file of files) {
      if (!prevFilesMapRef.current.has(file.path)) {
        if (!changed.find((c) => c.path === file.path)) {
          changed.push(file);
        }
      }
    }

    if (changed.length === 0) return;

    const needsRemount = changed.some(
      (f) =>
        f.path === "package.json" ||
        f.path === "vite.config.js" ||
        f.path === "vite.config.ts" ||
        f.path === "index.html"
    );

    if (needsRemount) {
      console.log("🔄 Structural change detected — remounting");
      remount(files);
    } else {
      console.log(`⚡ Patching ${changed.length} file(s):`, changed.map((f) => f.path));
      writeFiles(changed);
    }

    prevFilesMapRef.current = newMap;
  }, [files, projectId, mountAndRun, writeFiles, remount]);

  const handleRefresh = () => {
    if (!files.length) return;
    console.log("🔄 Manual remount triggered");
    isBootedRef.current = false;
    prevFilesMapRef.current = new Map();
    bootedProjectIdRef.current = null;
    remount(files);
  };

  return (
    <div className="h-full flex flex-col bg-background">
      <div className="flex items-center justify-between px-3 py-2 border-b shrink-0">
        <div className="flex items-center gap-2">
          <Monitor className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-xs font-medium">Preview</span>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge status={status} />
          <button
            onClick={handleRefresh}
            disabled={!files.length}
            title="Force remount"
            className="p-1 rounded hover:bg-muted transition-colors disabled:opacity-40"
          >
            <RefreshCw className="h-3 w-3 text-muted-foreground" />
          </button>
        </div>
      </div>

      <div className="flex-1 relative overflow-hidden">
        {url ? (
          <iframe
            src={url}
            className="absolute inset-0 w-full h-full border-0 bg-white"
            title="Live preview"
            allow="cross-origin-isolated"
          />
        ) : (
          <PreviewPlaceholder status={status} />
        )}
      </div>
    </div>
  );
});

LivePreview.displayName = "LivePreview";
export default LivePreview;

const STAGE_MESSAGES: Record<string, string> = {
  idle:             "Generate a project to see the preview",
  waiting:          "Waiting for package.json to arrive...",
  booting:          "Booting WebContainer...",
  mounting:         "Mounting project files...",
  installing:       "Installing dependencies (first run ~30s)...",
  "install-failed": "Dependency installation failed — check console",
  starting:         "Starting Vite dev server...",
  remounting:       "Remounting project...",
  error:            "Something went wrong — try refreshing",
};

function PreviewPlaceholder({ status }: { status: string }) {
  const message = STAGE_MESSAGES[status] ?? status;
  const isError = status === "error" || status === "install-failed";

  return (
    <div className="w-full h-full flex flex-col items-center justify-center gap-3 text-center px-6">
      {isError ? (
        <AlertCircle className="h-8 w-8 text-red-400" />
      ) : status === "idle" ? (
        <Monitor className="h-8 w-8 text-muted-foreground/40" />
      ) : (
        <Loader2 className="h-8 w-8 animate-spin text-primary/60" />
      )}
      <p className="text-sm text-muted-foreground max-w-xs">{message}</p>
      {status === "installing" && (
        <p className="text-xs text-muted-foreground/60">
          Dependencies are cached after the first run
        </p>
      )}
    </div>
  );
}