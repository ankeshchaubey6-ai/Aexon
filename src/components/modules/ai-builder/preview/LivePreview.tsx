 "use client";

import { useEffect, useRef, useState, memo } from "react";
import { useAIBuilderStore } from "../state/ai-builder.store";
import { useWebContainer } from "../state/use-webcontainer";

type AIFile = { path: string; content: string };

function hasRequiredFiles(files: AIFile[]): boolean {
  const requiredPaths = ["index.html", "package.json", "src/main.jsx", "src/App.jsx"];
  const filePaths = new Set(files.map(f => f.path));
  for (const required of requiredPaths) {
    if (!filePaths.has(required)) {
      console.log(`[MOUNT CHECK] ❌ Missing required file: ${required}`);
      return false;
    }
  }
  console.log(`[MOUNT CHECK] ✅ All required files present`);
  return true;
}

const Icon = ({ children }: { children: React.ReactNode }) => (
  <span style={{ display: "inline-flex", width: 14, height: 14 }}>{children}</span>
);

const Icons = {
  monitor: () => <Icon>🖥</Icon>,
  alert:   () => <Icon>⚠</Icon>,
  refresh: () => <Icon>↻</Icon>,
  loading: () => <Icon>⏳</Icon>,
};

const StatusBadge = ({ status }: { status: string }) => {
  const isRunning = status === "running";
  const isError   = status === "error" || status === "install-failed";
  const isLoading = !isRunning && !isError && status !== "idle" && status !== "waiting-files";

  return (
    <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#94a3b8" }}>
      {isRunning && (
        <span style={{ height: 6, width: 6, borderRadius: "50%", backgroundColor: "#22c55e", animation: "pulse 1.5s infinite" }} />
      )}
      {isLoading && (
        <span style={{ display: "inline-flex", animation: "spin 1s linear infinite", color: "#eab308" }}>
          <Icons.loading />
        </span>
      )}
      {isError && (
        <span style={{ display: "inline-flex", color: "#ef4444" }}><Icons.alert /></span>
      )}
      {status}
    </span>
  );
};

const LivePreview = memo(({ projectId }: { projectId: string | null }) => {
  const files           = useAIBuilderStore((s) => s.files);
  const lastCommitLabel = useAIBuilderStore((s) => s.lastCommitLabel);

  const { mountAndRun, writeFiles, remount, url, status, isInstalled } = useWebContainer();

  const [iframeKey, setIframeKey]   = useState(0);
  const isBootedRef                 = useRef(false);
  const prevFilesMapRef             = useRef<Map<string, string>>(new Map());
  const bootedProjectIdRef          = useRef<string | null>(null);
  const previewLoadedRef            = useRef(false);

  // ── Core boot effect ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!files.length) return;
    if (!files.some((f) => f.path === "package.json")) return;

    console.log("[LivePreview] Files available:", files.map(f => f.path).sort());

    if (projectId !== bootedProjectIdRef.current) {
      console.log(`🔁 [LivePreview] PROJECT SWITCH: "${bootedProjectIdRef.current}" → "${projectId}"`);
      isBootedRef.current        = false;
      prevFilesMapRef.current    = new Map();
      bootedProjectIdRef.current = projectId;
      previewLoadedRef.current   = false;
    }

    if (!isBootedRef.current) {
      if (previewLoadedRef.current && (status === "running" || status === "starting")) {
        console.log("[REMOUNT BLOCKED] Preview already active");
        isBootedRef.current = true;
        return;
      }

      const blockingPhases = ["booting", "mounting", "installing", "starting", "loading-snapshot"];
      if (blockingPhases.includes(status)) {
        console.log(`[REMOUNT BLOCKED] Container is ${status} — waiting`);
        return;
      }

      isBootedRef.current     = true;
      prevFilesMapRef.current = new Map(files.map((f) => [f.path, f.content]));

      if (status === "idle" || status === "waiting-files") {
        if (!hasRequiredFiles(files)) {
          isBootedRef.current = false;
          return;
        }
        console.log(`[LivePreview] First boot → mountAndRun`);
        mountAndRun(files, projectId);
      } else if (status === "error") {
        console.log(`[LivePreview] Error state → remounting`);
        remount(files, projectId);
      }
      return;
    }

    if (previewLoadedRef.current) {
      console.log("[LivePreview] Preview loaded — ignoring further file changes");
      return;
    }

    const newMap      = new Map(files.map((f) => [f.path, f.content]));
    const changed: AIFile[] = [];
    for (const file of files) {
      if (prevFilesMapRef.current.get(file.path) !== file.content) changed.push(file);
    }
    prevFilesMapRef.current = newMap;
    if (!changed.length) return;

    const isChatPanelCommit = lastCommitLabel.startsWith("Generated:") || lastCommitLabel.startsWith("Edit:");
    if (isChatPanelCommit || changed.length >= 5) return;

    const needsRemount = changed.some(
      (f) => f.path === "package.json" || f.path === "vite.config.js" || f.path === "vite.config.ts" || f.path === "index.html"
    );

    if (needsRemount) {
      remount(files, projectId);
    } else {
      writeFiles(changed);
    }
  }, [files, projectId, lastCommitLabel, status, isInstalled, mountAndRun, writeFiles, remount]);

  // ── Mark preview as loaded when URL arrives ─────────────────────────────────
  useEffect(() => {
    if (url) {
      console.log("[Preview] ✅ URL ready:", url);
      previewLoadedRef.current = true;
    }
  }, [url]);

  const handleRefresh = () => {
    if (!files.length) return;
    isBootedRef.current        = false;
    prevFilesMapRef.current    = new Map();
    bootedProjectIdRef.current = null;
    previewLoadedRef.current   = false;
    setIframeKey((k) => k + 1);
    remount(files, projectId);
  };

  const handleOpenExternal = () => {
    if (url) window.open(url, "_blank");
  };

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", background: "#0f172a", color: "#e2e8f0" }}>
      <style>{`
        @keyframes spin  { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
      `}</style>

      {/* Toolbar */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 12px", borderBottom: "1px solid #1e293b", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ display: "inline-flex", color: "#94a3b8" }}><Icons.monitor /></span>
          <span style={{ fontSize: 12, fontWeight: 500 }}>Preview</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <StatusBadge status={status} />
          <button onClick={handleOpenExternal} disabled={!url} title="Open in new tab"
            style={{ padding: 4, borderRadius: 4, background: "transparent", border: "none", cursor: url ? "pointer" : "default", opacity: url ? 1 : 0.4, color: "#94a3b8", display: "inline-flex", fontSize: 12 }}>
            📑
          </button>
          <button onClick={handleRefresh} disabled={!files.length} title="Force remount"
            style={{ padding: 4, borderRadius: 4, background: "transparent", border: "none", cursor: files.length ? "pointer" : "default", opacity: files.length ? 1 : 0.4, color: "#94a3b8", display: "inline-flex" }}>
            <Icons.refresh />
          </button>
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, position: "relative", overflow: "hidden" }}>
        {url ? (
          <iframe
            key={iframeKey}
            src={url}
            // 🔥 credentialless: allows the cross-origin iframe to load
            // without inheriting parent COEP restrictions that block subresources.
            // This is required when parent has COEP: credentialless/require-corp.
          
            // 🔥 No sandbox attr: sandbox blocks JS module execution entirely.
            // Removing it allows full script execution inside the WC iframe.
            style={{ width: "100%", height: "100%", border: "none", display: "block" }}
            title="Live preview"
            loading="eager"
            onLoad={() => console.log("[Preview] iframe onLoad fired")}
            onError={() => console.error("[Preview] iframe onError fired")}
          />
        ) : (
          <div style={{ padding: "16px", color: "#64748b", fontSize: "14px", display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ animation: "spin 1s linear infinite", display: "inline-flex" }}>⏳</span>
            Preparing preview... ({status})
          </div>
        )}
      </div>
    </div>
  );
});

LivePreview.displayName = "LivePreview";
export default LivePreview;