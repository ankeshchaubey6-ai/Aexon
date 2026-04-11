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
import { useAIBuilderStore } from "../state/ai-builder.store";
import { useWebContainer } from "../state/use-webcontainer";

type AIFile = { path: string; content: string };

// ─── Safe Icons (replaces lucide-react) ───────────────────────────────────────
const Icon = ({ children }: { children: React.ReactNode }) => (
  <span style={{ display: "inline-flex", width: 14, height: 14 }}>
    {children}
  </span>
);

const Icons = {
  monitor: () => <Icon>🖥</Icon>,
  alert: () => <Icon>⚠</Icon>,
  refresh: () => <Icon>↻</Icon>,
  loading: () => <Icon>⏳</Icon>,
};

// ── Status badge ───────────────────────────────────────────────────────────────
const StatusBadge = ({ status }: { status: string }) => {
  const isRunning = status === "running";
  const isError   = status === "error" || status === "install-failed";
  const isLoading =
    !isRunning && !isError && status !== "idle" && status !== "waiting-files";

  return (
    <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#94a3b8" }}>
      {isRunning && (
        <span
          style={{
            height: 6,
            width: 6,
            borderRadius: "50%",
            backgroundColor: "#22c55e",
            animation: "pulse 1.5s infinite",
          }}
        />
      )}
      {isLoading && (
        <span style={{ display: "inline-flex", animation: "spin 1s linear infinite", color: "#eab308" }}>
          <Icons.loading />
        </span>
      )}
      {isError && (
        <span style={{ display: "inline-flex", color: "#ef4444" }}>
          <Icons.alert />
        </span>
      )}
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
    <div style={{
      height: "100%",
      display: "flex",
      flexDirection: "column",
      background: "#0f172a",
      color: "#e2e8f0"
    }}>
      {/* Toolbar */}
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "8px 12px",
        borderBottom: "1px solid #1e293b",
        flexShrink: 0,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ display: "inline-flex", color: "#94a3b8" }}>
            <Icons.monitor />
          </span>
          <span style={{ fontSize: 12, fontWeight: 500 }}>Preview</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <StatusBadge status={status} />
          <button
            onClick={handleRefresh}
            disabled={!files.length}
            title="Force remount"
            style={{
              padding: 4,
              borderRadius: 4,
              background: "transparent",
              border: "none",
              cursor: files.length ? "pointer" : "default",
              opacity: files.length ? 1 : 0.4,
              color: "#94a3b8",
              display: "inline-flex",
            }}
          >
            <Icons.refresh />
          </button>
        </div>
      </div>

      {/* Content */}
      <div style={{
        flex: 1,
        position: "relative",
        overflow: "hidden",
        height: "100%"
      }}>
        {url ? (
          // FIX LP3: key only changes on explicit refresh, not on every URL change.
          // src changes navigate the iframe without tearing it down.
          <div style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            overflow: "hidden",
            background: "#0f172a"
          }}>
            <iframe
              key={iframeReloadKey}
              src={url}
              allow="cross-origin-isolated"
              sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"
              style={{
                width: "100%",
                height: "100%",
                border: 0,
                display: "block",
                background: "#0f172a"
              }}
              title="Live preview"
            />
          </div>
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
    <div style={{
      width: "100%",
      height: "100%",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      gap: 12,
      textAlign: "center",
      padding: "0 24px",
    }}>
      {isError ? (
        <span style={{ display: "inline-flex", color: "#f87171", fontSize: 32 }}>
          <Icons.alert />
        </span>
      ) : status === "idle" ? (
        <span style={{ display: "inline-flex", color: "#64748b", opacity: 0.4, fontSize: 32 }}>
          <Icons.monitor />
        </span>
      ) : (
        <span style={{
          display: "inline-flex",
          animation: "spin 1s linear infinite",
          color: "#818cf8",
          opacity: 0.6,
          fontSize: 32,
        }}>
          <Icons.loading />
        </span>
      )}
      <p style={{ fontSize: 14, color: "#94a3b8", maxWidth: "20rem" }}>{message}</p>
      {status === "installing" && (
        <p style={{ fontSize: 12, color: "#64748b", opacity: 0.6 }}>
          Dependencies are cached after the first run
        </p>
      )}
    </div>
  );
}