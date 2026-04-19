// src/components/modules/ai-builder/layout/AIWorkspace.tsx
"use client";

import React, {
  useEffect,
  useRef,
  useState,
  useCallback,
  useMemo,
  memo,
  ComponentType,
} from "react";
import { useParams } from "next/navigation";

import ChatPanel from "../chat/ChatPanel";
import ProjectSidebar from "../chat/ProjectSidebar";
import LivePreview from "../preview/LivePreview";
import FileExplorer from "../explorer/FileExplorer";
import MonacoEditor from "../editor/MonacoEditor";
import { useAIBuilderStore } from "../state/ai-builder.store";
import { useWebContainer, resetContainer } from "../state/use-webcontainer";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

// -----------------------------------------------------------------------------
// Types & Constants
// -----------------------------------------------------------------------------
type SidebarTab = "history" | "files";
type PreviewTab = "preview" | "code";
type Device = "desktop" | "tablet" | "mobile";
type DeployTarget = "vercel" | "netlify" | "github-pages";

const DEVICE_WIDTHS: Record<Device, string> = {
  desktop: "100%",
  tablet: "768px",
  mobile: "390px",
};

// -----------------------------------------------------------------------------
// Icon Components (Memoized & Accessible)
// -----------------------------------------------------------------------------
const IconWrapper = memo(({ children, label }: { children: React.ReactNode; label?: string }) => (
  <span
    className="inline-flex items-center justify-center w-3.5 h-3.5"
    aria-label={label}
    aria-hidden={!label}
  >
    {children}
  </span>
));
IconWrapper.displayName = "IconWrapper";

const Icons = {
  close: () => <IconWrapper label="Close">×</IconWrapper>,
  open: () => <IconWrapper label="Open">≡</IconWrapper>,
  monitor: () => <IconWrapper label="Desktop">🖥</IconWrapper>,
  tablet: () => <IconWrapper label="Tablet">📱</IconWrapper>,
  mobile: () => <IconWrapper label="Mobile">📲</IconWrapper>,
  code: () => <IconWrapper label="Code">{"</>"}</IconWrapper>,
  copy: () => <IconWrapper label="Copy">📋</IconWrapper>,
  check: () => <IconWrapper label="Copied">✔</IconWrapper>,
  undo: () => <IconWrapper label="Undo">↶</IconWrapper>,
  redo: () => <IconWrapper label="Redo">↷</IconWrapper>,
  folder: () => <IconWrapper label="Folder">📁</IconWrapper>,
  chat: () => <IconWrapper label="Chat">💬</IconWrapper>,
  rocket: () => <IconWrapper label="Deploy">🚀</IconWrapper>,
  download: () => <IconWrapper label="Download">⬇</IconWrapper>,
  github: () => <IconWrapper label="GitHub">🐙</IconWrapper>,
  loading: () => <IconWrapper label="Loading">⏳</IconWrapper>,
  chevron: () => <IconWrapper label="Expand">⌄</IconWrapper>,
};

// -----------------------------------------------------------------------------
// Error Fallback Component
// -----------------------------------------------------------------------------
const PreviewErrorFallback = ({ error, resetErrorBoundary }: any) => (
  <div className="flex flex-col items-center justify-center h-full p-6 text-center">
    <p className="text-destructive text-sm mb-2">Preview failed to load</p>
    <p className="text-muted-foreground text-xs mb-4">{error.message}</p>
    <Button variant="outline" size="sm" onClick={resetErrorBoundary}>
      Retry
    </Button>
  </div>
);

// -----------------------------------------------------------------------------
// Safe Preview Wrapper
// -----------------------------------------------------------------------------
const SafePreview = memo(({ projectId }: { projectId: string | null }) => {
  if (!projectId) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        No project selected
      </div>
    );
  }

  return <LivePreview projectId={projectId} />;
});
SafePreview.displayName = "SafePreview";

// -----------------------------------------------------------------------------
// Deploy Drawer (Extracted & Optimized)
// -----------------------------------------------------------------------------
const DeployDrawer = memo(
  ({
    projectId,
    subaccountId,
    onClose,
  }: {
    projectId: string;
    subaccountId: string;
    onClose: () => void;
  }) => {
    const [target, setTarget] = useState<DeployTarget>("vercel");
    const [status, setStatus] = useState<"idle" | "deploying" | "done" | "error">("idle");
    const [deployedUrl, setDeployedUrl] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);

    const handleDeploy = useCallback(async () => {
      setStatus("deploying");
      try {
        const res = await fetch("/api/ai/deploy", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ projectId, subaccountId, target }),
        });
        const data = await res.json();
        if (data?.url) {
          setDeployedUrl(data.url);
          setStatus("done");
        } else {
          setStatus("error");
        }
      } catch {
        setStatus("error");
      }
    }, [projectId, subaccountId, target]);

    const copyUrl = useCallback(() => {
      if (!deployedUrl) return;
      navigator.clipboard.writeText(deployedUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }, [deployedUrl]);

    const targets: Array<{ id: DeployTarget; label: string; description: string }> = useMemo(
      () => [
        { id: "vercel", label: "Vercel", description: "Instant global CDN deployment" },
        { id: "netlify", label: "Netlify", description: "JAMstack with form support" },
        { id: "github-pages", label: "GitHub Pages", description: "Free static hosting" },
      ],
      []
    );

    const handleBackdropClick = useCallback(
      (e: React.MouseEvent<HTMLDivElement>) => {
        if (e.target === e.currentTarget) onClose();
      },
      [onClose]
    );

    return (
      <div
        className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm"
        onClick={handleBackdropClick}
        role="dialog"
        aria-modal="true"
        aria-label="Deploy project"
      >
        <div className="w-full max-w-md mx-4 mb-4 sm:mb-0 bg-[#0f0f11] border border-white/10 rounded-2xl shadow-2xl overflow-hidden">
          <div className="h-[2px] w-full bg-gradient-to-r from-violet-500 via-fuchsia-500 to-cyan-500" />
          <div className="px-5 py-4 border-b border-white/8">
            <h2 className="text-sm font-semibold text-white flex items-center gap-2">
              <Icons.rocket /> Deploy Project
            </h2>
            <p className="text-xs text-white/40 mt-0.5">Choose a platform and go live</p>
          </div>
          <div className="px-5 py-4 flex flex-col gap-2">
            {targets.map((t) => (
              <button
                key={t.id}
                onClick={() => setTarget(t.id)}
                className={cn(
                  "flex items-start gap-3 px-3 py-3 rounded-xl border text-left transition-all",
                  target === t.id
                    ? "border-violet-500/50 bg-violet-500/10"
                    : "border-white/8 hover:border-white/15"
                )}
                aria-pressed={target === t.id}
              >
                <div
                  className={cn(
                    "w-2 h-2 mt-1 rounded-full shrink-0",
                    target === t.id ? "bg-violet-400" : "bg-white/20"
                  )}
                />
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
              <button
                onClick={copyUrl}
                className="text-green-400 hover:text-green-300 shrink-0"
                aria-label="Copy URL"
              >
                {copied ? <Icons.check /> : <Icons.copy />}
              </button>
              <a
                href={deployedUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-green-400 hover:text-green-300 shrink-0"
                aria-label="Open deployed site"
              >
                ↗
              </a>
            </div>
          )}
          {status === "error" && (
            <p className="mx-5 mb-4 text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2">
              Deployment failed — check your API configuration
            </p>
          )}
          <div className="px-5 pb-5 flex gap-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={onClose}
              aria-label="Cancel deployment"
            >
              Cancel
            </Button>
            <Button
              className="flex-1 bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white"
              onClick={status === "done" ? onClose : handleDeploy}
              disabled={status === "deploying"}
              aria-busy={status === "deploying"}
            >
              {status === "deploying" ? (
                <>
                  <Icons.loading /> Deploying…
                </>
              ) : status === "done" ? (
                "Done"
              ) : (
                <>
                  <Icons.rocket /> Deploy to {targets.find((t) => t.id === target)?.label}
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    );
  }
);
DeployDrawer.displayName = "DeployDrawer";

// -----------------------------------------------------------------------------
// Preview Actions (Export + Deploy)
// -----------------------------------------------------------------------------
const PreviewActions = memo(
  ({
    projectId,
    subaccountId,
    onDeploy,
  }: {
    projectId: string | null;
    subaccountId: string;
    onDeploy: () => void;
  }) => {
    const [exportingZip, setExportingZip] = useState(false);
    const [pushingGithub, setPushingGithub] = useState(false);
    const [showExportMenu, setShowExportMenu] = useState(false);

    useEffect(() => {
      if (!showExportMenu) return;
      const handler = () => setShowExportMenu(false);
      document.addEventListener("mousedown", handler);
      return () => document.removeEventListener("mousedown", handler);
    }, [showExportMenu]);

    const handleExportZip = useCallback(async () => {
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
      } finally {
        setExportingZip(false);
      }
    }, [projectId, subaccountId]);

    const handlePushGithub = useCallback(async () => {
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
      } finally {
        setPushingGithub(false);
      }
    }, [projectId, subaccountId]);

    const isDisabled = !projectId || exportingZip || pushingGithub;

    return (
      <div className="flex items-center gap-1.5 ml-auto">
        {/* Export Dropdown */}
        <div className="relative">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowExportMenu((v) => !v)}
                  disabled={isDisabled}
                  aria-haspopup="true"
                  aria-expanded={showExportMenu}
                >
                  {exportingZip || pushingGithub ? <Icons.loading /> : <Icons.download />}
                  Export <Icons.chevron />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Export project as ZIP or push to GitHub</TooltipContent>
            </Tooltip>
          </TooltipProvider>
          {showExportMenu && (
            <div className="absolute right-0 top-full mt-1 w-44 bg-popover border border-border rounded-xl shadow-xl overflow-hidden z-50">
              <button
                onClick={handleExportZip}
                className="w-full flex items-center gap-2 px-3 py-2.5 text-xs hover:bg-muted transition-colors"
              >
                <Icons.download /> Download ZIP
              </button>
              <button
                onClick={handlePushGithub}
                className="w-full flex items-center gap-2 px-3 py-2.5 text-xs hover:bg-muted transition-colors"
              >
                <Icons.github /> Push to GitHub
              </button>
            </div>
          )}
        </div>

        {/* Deploy Button */}
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="sm"
                className="bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white"
                onClick={onDeploy}
                disabled={!projectId}
              >
                <Icons.rocket /> Deploy
              </Button>
            </TooltipTrigger>
            <TooltipContent>Deploy to production</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    );
  }
);
PreviewActions.displayName = "PreviewActions";

// -----------------------------------------------------------------------------
// Sidebar Tab Component
// -----------------------------------------------------------------------------
const SidebarTabButton = memo(
  ({
    active,
    onClick,
    icon,
    label,
  }: {
    active: boolean;
    onClick: () => void;
    icon: React.ReactNode;
    label: string;
  }) => (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-1.5 flex-1 px-3 py-2 text-xs font-medium transition-colors",
        active
          ? "text-foreground border-b-2 border-primary"
          : "text-muted-foreground hover:text-foreground"
      )}
      aria-selected={active}
      role="tab"
    >
      {icon} {label}
    </button>
  )
);
SidebarTabButton.displayName = "SidebarTabButton";

// -----------------------------------------------------------------------------
// Device Toggle Component
// -----------------------------------------------------------------------------
const DeviceToggle = memo(({ device, setDevice }: { device: Device; setDevice: (d: Device) => void }) => {
  const devices: Device[] = ["desktop", "tablet", "mobile"];
  const icons: Record<Device, ComponentType> = {
    desktop: Icons.monitor,
    tablet: Icons.tablet,
    mobile: Icons.mobile,
  };
  return (
    <div className="flex items-center rounded-lg border border-border overflow-hidden ml-1">
      {devices.map((d) => {
        const Icon = icons[d];
        return (
          <TooltipProvider key={d}>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => setDevice(d)}
                  className={cn(
                    "px-2 py-1 transition-colors",
                    device === d
                      ? "bg-muted text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                  aria-pressed={device === d}
                >
                  <Icon />
                </button>
              </TooltipTrigger>
              <TooltipContent>{d.charAt(0).toUpperCase() + d.slice(1)}</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        );
      })}
    </div>
  );
});
DeviceToggle.displayName = "DeviceToggle";

// -----------------------------------------------------------------------------
// Loading Skeleton for Workspace
// -----------------------------------------------------------------------------
const WorkspaceSkeleton = () => (
  <div className="w-full h-full flex flex-col bg-background">
    <div className="flex flex-1 min-h-0">
      <div className="w-52 border-r border-border p-4 space-y-3">
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-6 w-3/4" />
        <Skeleton className="h-6 w-1/2" />
      </div>
      <div className="w-[360px] border-r border-border p-4">
        <Skeleton className="h-full w-full" />
      </div>
      <div className="flex-1 p-4">
        <Skeleton className="h-full w-full" />
      </div>
    </div>
  </div>
);

// -----------------------------------------------------------------------------
// Main Workspace Component
// -----------------------------------------------------------------------------
const AIWorkspace = () => {
  const params = useParams();
  const subaccountId = params?.subaccountId as string;
  const projectId = params?.projectId as string;

  const {
    setProject,
    setFiles,
    reset,
    files,
    projectId: storeProjectId,
  } = useAIBuilderStore();

  const { mountAndRun } = useWebContainer();

  const loadedForProjectRef = useRef<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [sidebarTab, setSidebarTab] = useState<SidebarTab>("history");
  const [previewTab, setPreviewTab] = useState<PreviewTab>("preview");
  const [device, setDevice] = useState<Device>("desktop");
  const [showDeployDrawer, setShowDeployDrawer] = useState(false);

  // -------------------------------------------------------------------------
  // Load project effect with proper cleanup
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (!projectId || projectId === "new") {
      // Handle "new" project scenario
      reset();
      resetContainer();
      loadedForProjectRef.current = null;
      return;
    }

    if (loadedForProjectRef.current === projectId) return;

    const controller = new AbortController();
    const loadProject = async () => {
      setIsLoading(true);
      try {
        resetContainer();
        reset();

        const res = await fetch(`/api/ai/projects/${projectId}`, {
          signal: controller.signal,
        });

        if (!res.ok) {
          console.warn(`[AIWorkspace] Project ${projectId} not found — treating as new`);
          setProject(projectId);
          loadedForProjectRef.current = projectId;
          return;
        }

        const data = await res.json();
        const loadedFiles = data?.project?.files ?? [];

        setProject(projectId);
        if (loadedFiles.length > 0) {
          setFiles(loadedFiles, "Loaded from DB");
        }

        loadedForProjectRef.current = projectId;
      } catch (err: any) {
        if (err.name !== "AbortError") {
          console.error("[AIWorkspace] Failed to load project files:", err);
        }
      } finally {
        setIsLoading(false);
      }
    };

    loadProject();

    return () => {
      controller.abort();
    };
  }, [projectId, setProject, setFiles, reset]);

  // -------------------------------------------------------------------------
  // Auto-switch sidebar to Files when files arrive
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (files.length > 0) {
      setSidebarTab("files");
      if (!sidebarOpen) setSidebarOpen(true);
    }
  }, [files.length, sidebarOpen]);

  // -------------------------------------------------------------------------
  // Memoized handlers
  // -------------------------------------------------------------------------
  const handleSidebarTabChange = useCallback((tab: SidebarTab) => {
    setSidebarTab(tab);
  }, []);

  const handlePreviewTabChange = useCallback((tab: PreviewTab) => {
    setPreviewTab(tab);
  }, []);

  const toggleSidebar = useCallback(() => {
    setSidebarOpen((prev) => !prev);
  }, []);

  const openDeployDrawer = useCallback(() => {
    setShowDeployDrawer(true);
  }, []);

  const closeDeployDrawer = useCallback(() => {
    setShowDeployDrawer(false);
  }, []);

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------
  if (isLoading) {
    return <WorkspaceSkeleton />;
  }

  return (
    <TooltipProvider>
      <div className="w-full h-full flex flex-col bg-background overflow-hidden">
        <div className="flex flex-1 min-h-0 overflow-hidden">
          {/* Sidebar */}
          <div
            className={cn(
              "shrink-0 flex flex-col border-r border-border overflow-hidden transition-all duration-200",
              sidebarOpen ? "w-52" : "w-0"
            )}
            role="region"
            aria-label="Project sidebar"
          >
            <div className="flex items-center shrink-0 border-b border-border" role="tablist">
              <SidebarTabButton
                active={sidebarTab === "history"}
                onClick={() => handleSidebarTabChange("history")}
                icon={<Icons.chat />}
                label="History"
              />
              <SidebarTabButton
                active={sidebarTab === "files"}
                onClick={() => handleSidebarTabChange("files")}
                icon={<Icons.folder />}
                label="Files"
              />
            </div>
            <div className="flex-1 overflow-hidden">
              {sidebarTab === "history" ? (
                <ProjectSidebar subaccountId={subaccountId} />
              ) : (
                <FileExplorer />
              )}
            </div>
          </div>

          {/* Sidebar Toggle */}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={toggleSidebar}
                className="shrink-0 self-center -ml-px z-10 w-5 h-10 flex items-center justify-center border border-border rounded-r-lg bg-background hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                aria-label={sidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
              >
                {sidebarOpen ? <Icons.close /> : <Icons.open />}
              </button>
            </TooltipTrigger>
            <TooltipContent>{sidebarOpen ? "Collapse" : "Expand"}</TooltipContent>
          </Tooltip>

          {/* Chat Panel */}
          <div className="w-[360px] shrink-0 flex flex-col border-r border-border overflow-hidden">
            <ChatPanel />
          </div>

          {/* Preview / Code Panel */}
          <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
            {/* Tab Bar */}
            <div className="shrink-0 flex items-center gap-1 px-3 py-1.5 border-b border-border bg-background">
              {/* Preview / Code Toggle */}
              <div className="flex items-center rounded-lg border border-border overflow-hidden">
                <button
                  onClick={() => handlePreviewTabChange("preview")}
                  className={cn(
                    "px-2.5 py-1 text-xs flex items-center gap-1 transition-colors",
                    previewTab === "preview"
                      ? "bg-muted text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                  aria-pressed={previewTab === "preview"}
                >
                  <Icons.monitor /> Preview
                </button>
                <button
                  onClick={() => handlePreviewTabChange("code")}
                  className={cn(
                    "px-2.5 py-1 text-xs flex items-center gap-1 transition-colors",
                    previewTab === "code"
                      ? "bg-muted text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                  aria-pressed={previewTab === "code"}
                >
                  <Icons.code /> Code
                </button>
              </div>

              {previewTab === "preview" && (
                <>
                  <DeviceToggle device={device} setDevice={setDevice} />
                  <PreviewActions
                    projectId={storeProjectId}
                    subaccountId={subaccountId}
                    onDeploy={openDeployDrawer}
                  />
                </>
              )}
            </div>

            {/* Content Area */}
            <div className="flex-1 min-h-0 flex items-start justify-center overflow-hidden bg-muted/30">
              {previewTab === "preview" ? (
                <div
                  className="h-full transition-all duration-300 overflow-hidden"
                  style={{ width: DEVICE_WIDTHS[device] }}
                >
                  <SafePreview projectId={storeProjectId} />
                </div>
              ) : (
                <div className="w-full h-full">
                  <MonacoEditor />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Deploy Drawer */}
        {showDeployDrawer && storeProjectId && (
          <DeployDrawer
            projectId={storeProjectId}
            subaccountId={subaccountId}
            onClose={closeDeployDrawer}
          />
        )}
      </div>
    </TooltipProvider>
  );
};

export default AIWorkspace;