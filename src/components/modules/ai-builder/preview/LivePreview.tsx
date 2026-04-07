"use client";

// src/components/modules/ai-builder/preview/LivePreview.tsx
//
// FIX LP1 — Double-boot guard was unreliable for the ChatPanel-first flow.
//
//   Previous logic used lastCommitLabel to decide whether LivePreview should
//   call mountAndRun on the initial boot. But this introduced a race:
//   if ChatPanel calls setFiles() BEFORE calling mountAndRun(), LivePreview's
//   effect fires first (isBootedRef=false → initial boot path), sees a
//   "Generated:" label, skips — then ChatPanel calls mountAndRun() separately.
//   That's fine. BUT if something causes the effect to re-run (StrictMode double
//   invoke, HMR, parent re-render) after isBootedRef flips to true, the "already
//   booted" diff path fires and sends a spurious writeFiles/remount.
//
//   Fix: the boot decision is now SOLELY based on whether _globalStatus is already
//   "running" or "installing" (i.e. something is already in flight). LivePreview
//   defers to the WC queue — if a job is already queued/running it does nothing.
//   ChatPanel is the primary driver; LivePreview only boots when the WC is truly idle.
//
// FIX LP2 — Project switch didn't fully reset boot refs.
//
//   bootedProjectIdRef changing correctly reset isBootedRef, but prevFilesMapRef
//   was rebuilt from the new files inside the same effect pass. This meant the
//   first diff after a project switch always saw 0 changed files (new map ==
//   new map) and silently skipped. Reset prevFilesMapRef to empty Map on switch
//   so the first effect pass correctly populates it without triggering a diff.
//
// FIX LP3 — iframe key={url} rebuilds the iframe on every URL change.
//
//   WebContainer's URL is stable per-session (it's based on the container ID).
//   Changing `key` tears down and remounts the iframe, wiping any partial load.
//   Use a separate `iframeReloadKey` that only increments when we explicitly
//   want a hard reload (e.g. manual refresh button). The URL is set as src
//   normally so the iframe just navigates rather than remounting.

import { useEffect, useRef, useState, memo } from "react";
import { Loader2, Monitor, AlertCircle, RefreshCw } from "lucide-react";
import { useAIBuilderStore } from "../state/ai-builder.store";
import { useWebContainer } from "../state/use-webcontainer";

type AIFile = { path: string; content: string };

// ── Status badge ───────────────────────────────────────────────────────────────
const StatusBadge = ({ status }: { status: string }) => {
  const isRunning = status === "running";
  const isError   = status === "error" || status === "install-failed";
  const isLoading =
    !isRunning && !isError && status !== "idle" && status !== "waiting-files";

  return (
    <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
      {isRunning && (
        <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
      )}
      {isLoading && <Loader2 className="h-3 w-3 animate-spin text-yellow-500" />}
      {isError   && <AlertCircle className="h-3 w-3 text-red-500" />}
      {status}
    </span>
  );
};

// ── Main component ─────────────────────────────────────────────────────────────
const LivePreview = memo(({ projectId }: { projectId: string | null }) => {
  const files           = useAIBuilderStore((s) => s.files);
  const lastCommitLabel = useAIBuilderStore((s) => s.lastCommitLabel);

  const { mountAndRun, writeFiles, remount, url, status, isInstalled } =
    useWebContainer();

  // FIX LP3: separate reload key — increments only on explicit refresh, not
  // on every URL change. The iframe navigates via src, not key remounts.
  const [iframeReloadKey, setIframeReloadKey] = useState(0);

  const isBootedRef        = useRef(false);
  const prevFilesMapRef    = useRef<Map<string, string>>(new Map());
  const bootedProjectIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!files.length) return;
    if (!files.some((f) => f.path === "package.json")) return;

    // ── FIX LP2: Project switch → fully reset all boot state ────────────────
    if (projectId !== bootedProjectIdRef.current) {
      console.log(`🔁 [LivePreview] project switch → ${projectId}`);
      isBootedRef.current        = false;
      prevFilesMapRef.current    = new Map(); // reset to empty — don't populate yet
      bootedProjectIdRef.current = projectId;
      // Don't return yet — fall through to initial boot logic below.
    }

    // ── FIX LP1: Initial boot ────────────────────────────────────────────────
    // Only boot if:
    //   (a) we haven't booted for this project yet, AND
    //   (b) the WC isn't already running/installing something
    //       (ChatPanel may have already queued a mountAndRun)
    if (!isBootedRef.current) {
      isBootedRef.current     = true;
      prevFilesMapRef.current = new Map(files.map((f) => [f.path, f.content]));

      const wcAlreadyBusy =
        status === "booting"    ||
        status === "mounting"   ||
        status === "installing" ||
        status === "starting"   ||
        status === "running";

      if (wcAlreadyBusy) {
        // ChatPanel or another caller already kicked off the pipeline. Stand down.
        console.log(`[LivePreview] WC already ${status} — skipping duplicate boot`);
      } else {
        // WC is idle — this is a DB-load scenario. LivePreview owns the boot.
        console.log("[LivePreview] WC idle on first boot → mountAndRun");
        mountAndRun(files);
      }
      return;
    }

    // ── Already booted: diff for code-editor edits ───────────────────────────
    const newMap      = new Map(files.map((f) => [f.path, f.content]));
    const changed: AIFile[] = [];

    for (const file of files) {
      if (prevFilesMapRef.current.get(file.path) !== file.content) {
        changed.push(file);
      }
    }

    prevFilesMapRef.current = newMap;

    if (!changed.length) return;

    // Large ChatPanel batch — it already drove mountAndRun/remount directly.
    const isChatPanelCommit =
      lastCommitLabel.startsWith("Generated:") ||
      lastCommitLabel.startsWith("Edit:");

    if (isChatPanelCommit || changed.length >= 5) {
      console.log(
        `⏭️  [LivePreview] skipping ChatPanel batch (${changed.length} files, "${lastCommitLabel}")`
      );
      return;
    }

    // Small change = user manually edited a file in the code editor.
    const needsRemount = changed.some(
      (f) =>
        f.path === "package.json"   ||
        f.path === "vite.config.js" ||
        f.path === "vite.config.ts" ||
        f.path === "index.html"
    );

    if (needsRemount) {
      console.log("🔄 [LivePreview] structural change → remounting");
      remount(files);
    } else {
      console.log(`⚡ [LivePreview] HMR patch — ${changed.length} file(s)`);
      writeFiles(changed);
    }
  }, [files, projectId, lastCommitLabel, status, isInstalled, mountAndRun, writeFiles, remount]);

  // ── Manual refresh ──────────────────────────────────────────────────────────
  const handleRefresh = () => {
    if (!files.length) return;
    isBootedRef.current        = false;
    prevFilesMapRef.current    = new Map();
    bootedProjectIdRef.current = null;
    // FIX LP3: bump reload key to force iframe hard-reload, not just src re-set
    setIframeReloadKey((k) => k + 1);
    remount(files);
  };

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Toolbar */}
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

      {/* Content */}
      <div className="flex-1 relative overflow-hidden">
        {url ? (
          // FIX LP3: key only changes on explicit refresh, not on every URL change.
          // src changes navigate the iframe without tearing it down.
          <iframe
            key={iframeReloadKey}
            src={url}
            allow="cross-origin-isolated"
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"
            className="absolute inset-0 w-full h-full border-0"
            style={{ background: "#ffffff" }}
            title="Live preview"
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

// ── Placeholder ────────────────────────────────────────────────────────────────
const STAGE_MESSAGES: Record<string, string> = {
  idle:             "Generate a project to see the preview",
  "waiting-files":  "Waiting for project files…",
  booting:          "Booting WebContainer…",
  mounting:         "Mounting project files…",
  installing:       "Installing dependencies (first run ~30–60 s)…",
  "install-failed": "Dependency install failed — check the browser console",
  starting:         "Starting Vite dev server…",
  writing:          "Writing updated files…",
  restarting:       "Restarting dev server…",
  running:          "Server is running — loading preview…",
  error:            "Something went wrong — click refresh to retry",
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