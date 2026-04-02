"use client";

// src/components/modules/ai-builder/layout/AIWorkspace.tsx

import { useEffect, useRef, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import {
  PanelLeftClose, PanelLeftOpen, Monitor, Tablet, Smartphone,
  Code2, ExternalLink, Copy, Check, Undo2, Redo2,
  FolderOpen, MessageSquare, Rocket, Download, Github,
  Loader2, ChevronDown,
} from "lucide-react";

import ChatPanel from "../chat/ChatPanel";
import ProjectSidebar from "../chat/ProjectSidebar";
import LivePreview from "../preview/LivePreview";
import FileExplorer from "../explorer/FileExplorer";
import MonacoEditor from "../editor/MonacoEditor";
import { useAIBuilderStore } from "../state/ai-builder.store";
import { useWebContainer, resetContainer } from "../state/use-webcontainer";
import { cn } from "@/lib/utils";

type SidebarTab = "history" | "files";
type PreviewTab = "preview" | "code";
type Device = "desktop" | "tablet" | "mobile";
type DeployTarget = "vercel" | "netlify" | "github-pages";

const DEVICE_WIDTHS: Record<Device, string> = {
  desktop: "100%",
  tablet: "768px",
  mobile: "390px",
};

// ─── Deploy Drawer ─────────────────────────────────────────────────────────────
function DeployDrawer({
  projectId,
  subaccountId,
  onClose,
}: {
  projectId: string;
  subaccountId: string;
  onClose: () => void;
}) {
  const [target, setTarget] = useState<DeployTarget>("vercel");
  const [status, setStatus] = useState<"idle" | "deploying" | "done" | "error">("idle");
  const [deployedUrl, setDeployedUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleDeploy = async () => {
    setStatus("deploying");
    try {
      const res = await fetch("/api/ai/deploy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, subaccountId, target }),
      });
      const data = await res.json();
      if (data?.url) { setDeployedUrl(data.url); setStatus("done"); }
      else setStatus("error");
    } catch { setStatus("error"); }
  };

  const copyUrl = () => {
    if (!deployedUrl) return;
    navigator.clipboard.writeText(deployedUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const targets: { id: DeployTarget; label: string; description: string }[] = [
    { id: "vercel", label: "Vercel", description: "Instant global CDN deployment" },
    { id: "netlify", label: "Netlify", description: "JAMstack with form support" },
    { id: "github-pages", label: "GitHub Pages", description: "Free static hosting" },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-md mx-4 mb-4 sm:mb-0 bg-[#0f0f11] border border-white/10 rounded-2xl shadow-2xl overflow-hidden">
        <div className="h-[2px] w-full bg-gradient-to-r from-violet-500 via-fuchsia-500 to-cyan-500" />
        <div className="px-5 py-4 border-b border-white/8">
          <h2 className="text-sm font-semibold text-white flex items-center gap-2">
            <Rocket className="w-4 h-4 text-violet-400" /> Deploy Project
          </h2>
          <p className="text-xs text-white/40 mt-0.5">Choose a platform and go live</p>
        </div>
        <div className="px-5 py-4 flex flex-col gap-2">
          {targets.map((t) => (
            <button key={t.id} onClick={() => setTarget(t.id)}
              className={cn(
                "flex items-start gap-3 px-3 py-3 rounded-xl border text-left transition-all",
                target === t.id
                  ? "border-violet-500/50 bg-violet-500/10"
                  : "border-white/8 hover:border-white/15"
              )}>
              <div className={cn(
                "w-2 h-2 mt-1 rounded-full shrink-0",
                target === t.id ? "bg-violet-400" : "bg-white/20"
              )} />
              <div>
                <p className="text-xs font-medium text-white">{t.label}</p>
                <p className="text-[11px] text-white/40">{t.description}</p>
              </div>
            </button>
          ))}
        </div>
        {status === "done" && deployedUrl && (
          <div className="mx-5 mb-4 flex items-center gap-2 px-3 py-2.5 bg-green-500/10 border border-green-500/20 rounded-xl">
            <span className="text-xs text-green-400 truncate flex-1">{deployedUrl}</span>
            <button onClick={copyUrl} className="text-green-400 hover:text-green-300 shrink-0">
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
            <a href={deployedUrl} target="_blank" rel="noopener noreferrer"
              className="text-green-400 hover:text-green-300 shrink-0">
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        )}
        {status === "error" && (
          <p className="mx-5 mb-4 text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2">
            Deployment failed — check your API configuration
          </p>
        )}
        <div className="px-5 pb-5 flex gap-2">
          <button onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-white/10 text-xs text-white/50 hover:text-white/80 hover:bg-white/5 transition-all">
            Cancel
          </button>
          <button
            onClick={status === "done" ? onClose : handleDeploy}
            disabled={status === "deploying"}
            className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 text-xs font-medium text-white flex items-center justify-center gap-1.5 disabled:opacity-50">
            {status === "deploying"
              ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Deploying…</>
              : status === "done" ? "Done"
              : <><Rocket className="w-3.5 h-3.5" /> Deploy to {targets.find((t) => t.id === target)?.label}</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Header Toolbar ────────────────────────────────────────────────────────────
function WorkspaceToolbar({
  projectId, subaccountId, previewUrl, onDeploy,
  canUndo, canRedo, onUndo, onRedo,
}: {
  projectId: string | null;
  subaccountId: string;
  previewUrl: string | null;
  onDeploy: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
}) {
  const [copiedUrl, setCopiedUrl]         = useState(false);
  const [exportingZip, setExportingZip]   = useState(false);
  const [pushingGithub, setPushingGithub] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);

  const copyPreviewUrl = () => {
    const url = previewUrl ?? `${window.location.origin}/api/preview?projectId=${projectId}`;
    navigator.clipboard.writeText(url);
    setCopiedUrl(true);
    setTimeout(() => setCopiedUrl(false), 2000);
  };

  const openExternalPreview = () => {
    if (!projectId) return;
    window.open(previewUrl ?? `/api/preview?projectId=${projectId}`, "_blank");
  };

  const handleExportZip = async () => {
    if (!projectId) return;
    setExportingZip(true);
    setShowExportMenu(false);
    try {
      const res = await fetch("/api/ai/export-zip", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, subaccountId }),
      });
      const data = await res.json();
      if (data?.downloadUrl) window.open(data.downloadUrl, "_blank");
    } finally { setExportingZip(false); }
  };

  const handlePushGithub = async () => {
    if (!projectId) return;
    setPushingGithub(true);
    setShowExportMenu(false);
    try {
      const res = await fetch("/api/ai/push-github", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, subaccountId }),
      });
      const data = await res.json();
      if (data?.repoUrl) window.open(data.repoUrl, "_blank");
    } finally { setPushingGithub(false); }
  };

  return (
    <div className="h-11 shrink-0 flex items-center gap-2 px-3 border-b border-border bg-background">
      <button onClick={onUndo} disabled={!canUndo} title="Undo"
        className="p-1.5 rounded-lg hover:bg-muted transition-colors disabled:opacity-30">
        <Undo2 className="w-3.5 h-3.5" />
      </button>
      <button onClick={onRedo} disabled={!canRedo} title="Redo"
        className="p-1.5 rounded-lg hover:bg-muted transition-colors disabled:opacity-30">
        <Redo2 className="w-3.5 h-3.5" />
      </button>
      <div className="w-px h-5 bg-border" />
      {(previewUrl || projectId) && (
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-muted border border-border text-xs text-muted-foreground max-w-[240px]">
          <span className={cn(
            "w-1.5 h-1.5 rounded-full shrink-0",
            previewUrl ? "bg-green-500" : "bg-muted-foreground/30"
          )} />
          <span className="truncate">
            {previewUrl ? previewUrl.replace(/https?:\/\//, "") : "Not running yet"}
          </span>
          <button
            onClick={copyPreviewUrl}
            disabled={!previewUrl && !projectId}
            className="shrink-0 hover:text-foreground ml-0.5 disabled:opacity-30">
            {copiedUrl ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
          </button>
        </div>
      )}
      <button
        onClick={openExternalPreview}
        disabled={!projectId}
        title={previewUrl ? "Open live app in new tab" : "Start preview first"}
        className="p-1.5 rounded-lg hover:bg-muted transition-colors disabled:opacity-30 text-muted-foreground hover:text-foreground">
        <ExternalLink className="w-3.5 h-3.5" />
      </button>
      <div className="flex-1" />
      <div className="relative">
        <button
          onClick={() => setShowExportMenu(!showExportMenu)}
          disabled={!projectId || exportingZip || pushingGithub}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-border text-xs hover:bg-muted transition-all disabled:opacity-40">
          {exportingZip || pushingGithub
            ? <Loader2 className="w-3 h-3 animate-spin" />
            : <Download className="w-3 h-3" />}
          Export <ChevronDown className="w-3 h-3" />
        </button>
        {showExportMenu && (
          <div className="absolute right-0 top-full mt-1 w-44 bg-popover border border-border rounded-xl shadow-xl overflow-hidden z-50">
            <button onClick={handleExportZip}
              className="w-full flex items-center gap-2 px-3 py-2.5 text-xs hover:bg-muted transition-colors">
              <Download className="w-3.5 h-3.5 text-muted-foreground" />
              Download ZIP
            </button>
            <button onClick={handlePushGithub}
              className="w-full flex items-center gap-2 px-3 py-2.5 text-xs hover:bg-muted transition-colors">
              <Github className="w-3.5 h-3.5 text-muted-foreground" />
              Push to GitHub
            </button>
          </div>
        )}
      </div>
      <button
        onClick={onDeploy}
        disabled={!projectId}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 text-xs font-medium text-white transition-all disabled:opacity-40 shadow-sm">
        <Rocket className="w-3 h-3" /> Deploy
      </button>
    </div>
  );
}

// ─── Main Workspace ────────────────────────────────────────────────────────────
const AIWorkspace = () => {
  const params = useParams();
  const subaccountId = params?.subaccountId as string;
  const projectId    = params?.projectId as string;

  const {
    setProject, setFiles, reset,
    files, projectId: storeProjectId,
    undo, redo, canUndo, canRedo,
  } = useAIBuilderStore();

  const { url: previewUrl } = useWebContainer();

  // Track which projectId we last fully loaded to avoid double-fetching.
  const loadedForProjectRef = useRef<string | null>(null);

  const [sidebarOpen, setSidebarOpen]     = useState(true);
  const [sidebarTab, setSidebarTab]       = useState<SidebarTab>("history");
  const [previewTab, setPreviewTab]       = useState<PreviewTab>("preview");
  const [device, setDevice]               = useState<Device>("desktop");
  const [showDeployDrawer, setShowDeployDrawer] = useState(false);
  const [exportMenuOpen, setExportMenuOpen]     = useState(false);

  // ── Reset store + WebContainer whenever the URL projectId changes ────────────
  // This is the fix for Bug 2: stale preview from previous project.
  // resetContainer() kills the dev server and clears _globalUrl immediately,
  // so LivePreview stops rendering the old iframe before new files load.
  useEffect(() => {
    if (!projectId || projectId === "new") return;
    if (loadedForProjectRef.current === projectId) return;

    // 1. Wipe the old project's WebContainer state (kills dev server, clears URL)
    resetContainer();

    // 2. Wipe the Zustand store so ChatPanel's isEditMode resets correctly
    reset();
    loadedForProjectRef.current = null;

    const load = async () => {
      try {
        const res = await fetch(`/api/ai/projects/${projectId}`);
        if (!res.ok) {
          console.warn(`[AIWorkspace] Project ${projectId} not found — new project`);
          setProject(projectId);
          loadedForProjectRef.current = projectId;
          return;
        }

        const data = await res.json();
        const loadedFiles = data?.project?.files ?? [];

        loadedForProjectRef.current = projectId;
        setProject(projectId);

        if (loadedFiles.length > 0) {
          setFiles(loadedFiles, "Loaded from DB");
        }
      } catch (err) {
        console.error("[AIWorkspace] Failed to load project files:", err);
      }
    };

    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  useEffect(() => {
    if (!exportMenuOpen) return;
    const handler = () => setExportMenuOpen(false);
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [exportMenuOpen]);

  const handleUndo = useCallback(() => undo?.(), [undo]);
  const handleRedo = useCallback(() => redo?.(), [redo]);

  return (
    <div className="w-full h-full flex flex-col bg-background overflow-hidden">
      <WorkspaceToolbar
        projectId={storeProjectId}
        subaccountId={subaccountId}
        previewUrl={previewUrl}
        onDeploy={() => setShowDeployDrawer(true)}
        canUndo={canUndo ?? false}
        canRedo={canRedo ?? false}
        onUndo={handleUndo}
        onRedo={handleRedo}
      />

      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Sidebar */}
        <div className={cn(
          "shrink-0 flex flex-col border-r border-border overflow-hidden transition-all duration-200",
          sidebarOpen ? "w-52" : "w-0"
        )}>
          <div className="flex items-center shrink-0 border-b border-border">
            <button
              onClick={() => setSidebarTab("history")}
              className={cn(
                "flex items-center gap-1.5 flex-1 px-3 py-2 text-xs font-medium transition-colors",
                sidebarTab === "history"
                  ? "text-foreground border-b-2 border-primary"
                  : "text-muted-foreground hover:text-foreground"
              )}>
              <MessageSquare className="w-3 h-3" /> History
            </button>
            <button
              onClick={() => setSidebarTab("files")}
              className={cn(
                "flex items-center gap-1.5 flex-1 px-3 py-2 text-xs font-medium transition-colors",
                sidebarTab === "files"
                  ? "text-foreground border-b-2 border-primary"
                  : "text-muted-foreground hover:text-foreground"
              )}>
              <FolderOpen className="w-3 h-3" /> Files
            </button>
          </div>
          <div className="flex-1 overflow-hidden">
            {sidebarTab === "history"
              ? <ProjectSidebar subaccountId={subaccountId} />
              : <FileExplorer />}
          </div>
        </div>

        {/* Sidebar toggle */}
        <button
          onClick={() => setSidebarOpen((v) => !v)}
          title={sidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
          className="shrink-0 self-center -ml-px z-10 w-5 h-10 flex items-center justify-center border border-border rounded-r-lg bg-background hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">
          {sidebarOpen ? <PanelLeftClose className="w-3 h-3" /> : <PanelLeftOpen className="w-3 h-3" />}
        </button>

        {/* Chat */}
        <div className="w-[360px] shrink-0 flex flex-col border-r border-border overflow-hidden">
          <ChatPanel />
        </div>

        {/* Preview / Code */}
        <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
          <div className="shrink-0 flex items-center gap-1 px-3 py-1.5 border-b border-border bg-background">
            <div className="flex items-center rounded-lg border border-border overflow-hidden">
              <button
                onClick={() => setPreviewTab("preview")}
                className={cn(
                  "px-2.5 py-1 text-xs flex items-center gap-1 transition-colors",
                  previewTab === "preview"
                    ? "bg-muted text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}>
                <Monitor className="w-3 h-3" /> Preview
              </button>
              <button
                onClick={() => setPreviewTab("code")}
                className={cn(
                  "px-2.5 py-1 text-xs flex items-center gap-1 transition-colors",
                  previewTab === "code"
                    ? "bg-muted text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}>
                <Code2 className="w-3 h-3" /> Code
              </button>
            </div>
            {previewTab === "preview" && (
              <div className="flex items-center rounded-lg border border-border overflow-hidden ml-1">
                {(["desktop", "tablet", "mobile"] as Device[]).map((d) => {
                  const Icon = d === "desktop" ? Monitor : d === "tablet" ? Tablet : Smartphone;
                  return (
                    <button
                      key={d}
                      onClick={() => setDevice(d)}
                      title={d.charAt(0).toUpperCase() + d.slice(1)}
                      className={cn(
                        "px-2 py-1 transition-colors",
                        device === d
                          ? "bg-muted text-foreground"
                          : "text-muted-foreground hover:text-foreground"
                      )}>
                      <Icon className="w-3 h-3" />
                    </button>
                  );
                })}
              </div>
            )}
          </div>
          <div className="flex-1 min-h-0 flex items-start justify-center overflow-hidden bg-muted/30">
            {previewTab === "preview" ? (
              <div
                className="h-full transition-all duration-300 overflow-hidden"
                style={{ width: DEVICE_WIDTHS[device] }}>
                {/* Pass storeProjectId so LivePreview can detect project switches */}
                <LivePreview projectId={storeProjectId} />
              </div>
            ) : (
              <div className="w-full h-full">
                <MonacoEditor />
              </div>
            )}
          </div>
        </div>
      </div>

      {showDeployDrawer && storeProjectId && (
        <DeployDrawer
          projectId={storeProjectId}
          subaccountId={subaccountId}
          onClose={() => setShowDeployDrawer(false)}
        />
      )}
    </div>
  );
};

export default AIWorkspace;