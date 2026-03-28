"use client";

import { useEffect, useRef, memo } from "react";
import { Loader2, Monitor, AlertCircle, RefreshCw } from "lucide-react";
import { useAIBuilderStore } from "../state/ai-builder.store";
import { useWebContainer } from "../state/use-webcontainer";

type AIFile = { path: string; content: string };

// ─────────────────────────────────────────────────────────────
// STATUS BADGE
// ─────────────────────────────────────────────────────────────
const StatusBadge = ({ status }: { status: string }) => {
  const isRunning = status === "running";
  const isError = status === "error" || status === "install-failed";
  const isLoading = !isRunning && !isError && status !== "idle";

  return (
    <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
      {isRunning && (
        <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
      )}
      {isLoading && (
        <Loader2 className="h-3 w-3 animate-spin text-yellow-500" />
      )}
      {isError && (
        <AlertCircle className="h-3 w-3 text-red-500" />
      )}
      {status}
    </span>
  );
};

// ─────────────────────────────────────────────────────────────
// LIVE PREVIEW
// ─────────────────────────────────────────────────────────────
const LivePreview = memo(() => {
  const { files } = useAIBuilderStore();
  const { mountAndRun, writeFiles, remount, url, status } = useWebContainer();

  // Track boot state and previous files for diffing
  const isBootedRef = useRef(false);
  const prevFilesRef = useRef<AIFile[]>([]);
  const prevFilesMapRef = useRef<Map<string, string>>(new Map());

  useEffect(() => {
    if (!files.length) return;

    // ── First load: boot WebContainer with all files ──
    if (!isBootedRef.current) {
      isBootedRef.current = true;
      prevFilesRef.current = files;
      prevFilesMapRef.current = new Map(files.map((f) => [f.path, f.content]));
      mountAndRun(files);
      return;
    }

    // ── Subsequent updates: diff and patch only changed files ──
    const changed: AIFile[] = [];
    const newMap = new Map(files.map((f) => [f.path, f.content]));

    for (const file of files) {
      const prev = prevFilesMapRef.current.get(file.path);
      if (prev !== file.content) {
        changed.push(file);
      }
    }

    // Check for deleted files (path in prev but not in new)
    // WebContainers doesn't support delete easily — we skip this edge case
    // and rely on the file content changing to trigger HMR

    if (changed.length === 0) return;

    // If it's a structural change (package.json, vite.config) — full remount
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

    // Update refs
    prevFilesRef.current = files;
    prevFilesMapRef.current = newMap;
  }, [files, mountAndRun, writeFiles, remount]);

  // ── Manual refresh ──
  const handleRefresh = () => {
    if (!files.length) return;
    console.log("🔄 Manual remount triggered");
    isBootedRef.current = false;
    prevFilesRef.current = [];
    prevFilesMapRef.current = new Map();
    remount(files);
  };

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Header */}
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

      {/* Preview area */}
      <div className="flex-1 relative overflow-hidden">
        {url ? (
          <iframe
            src={url}
            className="absolute inset-0 w-full h-full border-0 bg-white"
            title="Live preview"
            // allow is required for some WebContainer features
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

// ─────────────────────────────────────────────────────────────
// PLACEHOLDER while container boots
// ─────────────────────────────────────────────────────────────
const STAGE_MESSAGES: Record<string, string> = {
  idle:             "Generate a project to see the preview",
  booting:          "Booting WebContainer...",
  mounting:         "Mounting project files...",
  installing:       "Installing dependencies (this takes ~30s the first time)...",
  "install-failed": "Dependency installation failed",
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