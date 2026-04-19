


// src/components/modules/ai-builder/preview/LivePreview.tsx
"use client";

import React, {
  useEffect,
  useRef,
  useState,
  memo,
  useCallback,
  useMemo,
  useReducer,
} from "react";
import { createPortal } from "react-dom";
import { useAIBuilderStore } from "../state/ai-builder.store";
import { useWebContainer } from "../state/use-webcontainer";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import {
  Monitor,
  Smartphone,
  Tablet,
  RefreshCw,
  X,
  Maximize2,
  Minimize2,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Wifi,
  WifiOff,
  Terminal,
  ChevronUp,
  ChevronDown,
  Trash2,
  Copy,
  Download,
  RotateCcw,
  ExternalLink,
  Code,
  Eye,
  EyeOff,
  Server,
  Package,
  FileCode,
  Play,
  Square,
  Clock,
  Zap,
  Bug,
  Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------
type AIFile = { path: string; content: string };

type PreviewDevice = "desktop" | "tablet" | "mobile";

interface ConsoleEntry {
  id: string;
  type: "log" | "warn" | "error" | "info";
  message: string;
  timestamp: Date;
  count?: number;
}

interface NetworkRequest {
  id: string;
  url: string;
  method: string;
  status: number;
  duration: number;
  timestamp: Date;
}

interface BuildProgress {
  stage: "install" | "build" | "ready";
  percent: number;
  message: string;
}

// -----------------------------------------------------------------------------
// Utility Functions
// -----------------------------------------------------------------------------
function hasRequiredFiles(files: AIFile[]): boolean {
  const requiredPaths = ["index.html", "package.json", "src/main.jsx", "src/App.jsx"];
  const filePaths = new Set(files.map((f) => f.path));
  for (const required of requiredPaths) {
    if (!filePaths.has(required)) {
      console.log(`[MOUNT CHECK] ❌ Missing required file: ${required}`);
      return false;
    }
  }
  console.log(`[MOUNT CHECK] ✅ All required files present`);
  return true;
}

function getFileChangeType(
  path: string,
  oldContent: string | undefined,
  newContent: string
): "config" | "dependency" | "source" | "asset" {
  if (path === "package.json") {
    return "config";
  }
  if (path === "package-lock.json" || path === "yarn.lock" || path === "pnpm-lock.yaml") {
    return "dependency";
  }
  if (path.match(/\.(jsx?|tsx?|css|scss|less|html)$/)) {
    return "source";
  }
  return "asset";
}

// -----------------------------------------------------------------------------
// Subcomponents
// -----------------------------------------------------------------------------

// Status Badge with appropriate icon and color
const StatusBadge: React.FC<{ status: string; className?: string }> = ({ status, className }) => {
  const getStatusConfig = (s: string) => {
    switch (s) {
      case "running":
        return { icon: CheckCircle2, color: "text-green-500", bg: "bg-green-500/10", label: "Running" };
      case "error":
      case "install-failed":
        return { icon: AlertCircle, color: "text-red-500", bg: "bg-red-500/10", label: "Error" };
      case "booting":
      case "mounting":
      case "installing":
      case "starting":
        return { icon: Loader2, color: "text-yellow-500", bg: "bg-yellow-500/10", label: "Loading", spin: true };
      case "idle":
        return { icon: WifiOff, color: "text-gray-400", bg: "bg-gray-500/10", label: "Idle" };
      case "waiting-files":
        return { icon: FileCode, color: "text-blue-400", bg: "bg-blue-500/10", label: "Waiting" };
      default:
        return { icon: Info, color: "text-muted-foreground", bg: "bg-muted", label: s };
    }
  };
  const config = getStatusConfig(status);
  const Icon = config.icon;
  return (
    <Badge variant="outline" className={cn("gap-1", config.bg, config.color, className)}>
      <Icon className={cn("h-3 w-3", config.spin && "animate-spin")} />
      {config.label}
    </Badge>
  );
};

// Progress indicator for build stages
const BuildProgressBar: React.FC<{ progress: BuildProgress }> = ({ progress }) => {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">{progress.message}</span>
        <span className="font-mono">{progress.percent}%</span>
      </div>
      <Progress value={progress.percent} className="h-1.5" />
    </div>
  );
};

// Console Output Panel
const ConsolePanel: React.FC<{
  entries: ConsoleEntry[];
  onClear: () => void;
  onCopy: () => void;
}> = ({ entries, onClear, onCopy }) => {
  const bottomRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [entries]);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-2 py-1 border-b">
        <span className="text-xs font-medium">Console</span>
        <div className="flex items-center gap-1">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onCopy}>
                  <Copy className="h-3 w-3" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Copy all</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onClear}>
                  <Trash2 className="h-3 w-3" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Clear</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>
      <ScrollArea className="flex-1 p-2 font-mono text-xs">
        {entries.length === 0 ? (
          <div className="text-muted-foreground text-center py-4">No console output</div>
        ) : (
          entries.map((entry) => (
            <div
              key={entry.id}
              className={cn(
                "py-0.5 border-b border-border/30 last:border-0",
                entry.type === "error" && "text-red-400",
                entry.type === "warn" && "text-yellow-400",
                entry.type === "info" && "text-blue-400"
              )}
            >
              <span className="opacity-50 mr-2">
                {entry.timestamp.toLocaleTimeString()}
              </span>
              <span>{entry.message}</span>
              {entry.count && entry.count > 1 && (
                <Badge variant="secondary" className="ml-2 h-4 text-[9px]">
                  {entry.count}
                </Badge>
              )}
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </ScrollArea>
    </div>
  );
};

// Network Panel (simplified)
const NetworkPanel: React.FC<{ requests: NetworkRequest[]; onClear: () => void }> = ({
  requests,
  onClear,
}) => {
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-2 py-1 border-b">
        <span className="text-xs font-medium">Network</span>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onClear}>
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>
      <ScrollArea className="flex-1 p-2 font-mono text-xs">
        {requests.length === 0 ? (
          <div className="text-muted-foreground text-center py-4">No network activity</div>
        ) : (
          requests.map((req) => (
            <div key={req.id} className="flex items-center gap-2 py-0.5 border-b border-border/30">
              <Badge
                variant="outline"
                className={cn(
                  "h-4 text-[9px]",
                  req.status >= 400
                    ? "text-red-500"
                    : req.status >= 300
                    ? "text-yellow-500"
                    : "text-green-500"
                )}
              >
                {req.status}
              </Badge>
              <span className="w-8 text-right">{req.method}</span>
              <span className="truncate flex-1">{req.url}</span>
              <span className="opacity-50">{req.duration}ms</span>
            </div>
          ))
        )}
      </ScrollArea>
    </div>
  );
};

// Device Frame Wrapper
const DeviceFrame: React.FC<{
  device: PreviewDevice;
  children: React.ReactNode;
  url?: string;
}> = ({ device, children, url }) => {
  const frameClasses = cn(
    "h-full min-h-0 flex flex-col relative overflow-hidden transition-all duration-300",
    device === "mobile" && "max-w-[375px] mx-auto rounded-[2rem] border-8 border-gray-800 shadow-2xl",
    device === "tablet" && "max-w-[768px] mx-auto rounded-2xl border-8 border-gray-800 shadow-2xl",
    device === "desktop" && "w-full rounded-lg"
  );

  return (
    <div className={frameClasses}>
      {device !== "desktop" && (
        <div className="bg-gray-800 py-2 px-4 flex items-center gap-2 border-b border-gray-700 shrink-0">
          <div className="flex gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-red-500" />
            <div className="w-2.5 h-2.5 rounded-full bg-yellow-500" />
            <div className="w-2.5 h-2.5 rounded-full bg-green-500" />
          </div>
          <span className="text-[10px] text-gray-400 truncate flex-1 text-center">
            {url || "localhost"}
          </span>
        </div>
      )}
      <div className="flex-1 min-h-0">
        {children}
      </div>
    </div>
  );
};

// -----------------------------------------------------------------------------
// Reducer for Console & Network State
// -----------------------------------------------------------------------------
type PreviewAction =
  | { type: "ADD_CONSOLE"; payload: Omit<ConsoleEntry, "id" | "timestamp"> }
  | { type: "CLEAR_CONSOLE" }
  | { type: "ADD_NETWORK"; payload: Omit<NetworkRequest, "id" | "timestamp"> }
  | { type: "CLEAR_NETWORK" };

interface PreviewState {
  consoleEntries: ConsoleEntry[];
  networkRequests: NetworkRequest[];
}

function previewReducer(state: PreviewState, action: PreviewAction): PreviewState {
  switch (action.type) {
    case "ADD_CONSOLE": {
      const last = state.consoleEntries[state.consoleEntries.length - 1];
      if (last && last.message === action.payload.message && last.type === action.payload.type) {
        // Increment count instead of adding duplicate
        return {
          ...state,
          consoleEntries: [
            ...state.consoleEntries.slice(0, -1),
            { ...last, count: (last.count || 1) + 1 },
          ],
        };
      }
      return {
        ...state,
        consoleEntries: [
          ...state.consoleEntries.slice(-99),
          {
            ...action.payload,
            id: Math.random().toString(36).substr(2, 9),
            timestamp: new Date(),
          },
        ],
      };
    }
    case "CLEAR_CONSOLE":
      return { ...state, consoleEntries: [] };
    case "ADD_NETWORK":
      return {
        ...state,
        networkRequests: [
          ...state.networkRequests.slice(-49),
          {
            ...action.payload,
            id: Math.random().toString(36).substr(2, 9),
            timestamp: new Date(),
          },
        ],
      };
    case "CLEAR_NETWORK":
      return { ...state, networkRequests: [] };
    default:
      return state;
  }
}

// -----------------------------------------------------------------------------
// Custom Hook: WebContainer Event Listener
// -----------------------------------------------------------------------------
function useWebContainerEvents(
  dispatch: React.Dispatch<PreviewAction>,
  setBuildProgress: React.Dispatch<React.SetStateAction<BuildProgress>>
) {
  const { status } = useWebContainer();

  useEffect(() => {
    if (status !== "running") return;

    // Listen for console messages from the iframe (via postMessage)
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === "webcontainer:console") {
        dispatch({
          type: "ADD_CONSOLE",
          payload: {
            type: event.data.level || "log",
            message: event.data.message,
          },
        });
      } else if (event.data?.type === "webcontainer:network") {
        dispatch({
          type: "ADD_NETWORK",
          payload: {
            url: event.data.url,
            method: event.data.method,
            status: event.data.status,
            duration: event.data.duration,
          },
        });
      }
    };
    window.addEventListener("message", handleMessage);

    // Listen to WebContainer events for progress updates
    const onProgress = (data: { stage: string; percent: number; message: string }) => {
      setBuildProgress({
        stage: data.stage as BuildProgress["stage"],
        percent: data.percent,
        message: data.message,
      });
    };

    // Note: In a real implementation, you'd subscribe to WebContainer events here
    // For now, we simulate progress based on status changes

    return () => {
      window.removeEventListener("message", handleMessage);
    };
  }, [status, dispatch, setBuildProgress]);
}

// -----------------------------------------------------------------------------
// Main Component
// -----------------------------------------------------------------------------
const LivePreview = memo(({ projectId }: { projectId: string | null }) => {
  // Store
  const files = useAIBuilderStore((s) => s.files);
  const lastCommitLabel = useAIBuilderStore((s) => s.lastCommitLabel);
  const setActiveFile = useAIBuilderStore((s) => s.setActiveFile);

  // WebContainer
  const {
    mountAndRun,
    writeFiles,
    remount,
    url,
    activeProjectId,
    status,
    isInstalled,
  } = useWebContainer();

  // Local state
  const [iframeKey, setIframeKey] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [device, setDevice] = useState<PreviewDevice>("desktop");
  const [showConsole, setShowConsole] = useState(false);
  const [activeTab, setActiveTab] = useState<"console" | "network">("console");
  const [buildProgress, setBuildProgress] = useState<BuildProgress>({
    stage: "ready",
    percent: 100,
    message: "Ready",
  });
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [autoReload, setAutoReload] = useState(true);

  // Refs for lifecycle management
  const isBootedRef = useRef(false);
  const prevFilesMapRef = useRef<Map<string, string>>(new Map());
  const bootedProjectIdRef = useRef<string | null>(null);
  const previewLoadedRef = useRef(false);
  const pendingChangesRef = useRef<AIFile[]>([]);
  const reloadTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Reducer for console/network
  const [state, dispatch] = useReducer(previewReducer, {
    consoleEntries: [],
    networkRequests: [],
  });
  const previewUrl = activeProjectId === projectId ? url : null;

  // Hook for events
  useWebContainerEvents(dispatch, setBuildProgress);

  // Update build progress based on status
  useEffect(() => {
    if (status === "installing") {
      setBuildProgress({ stage: "install", percent: 30, message: "Installing dependencies..." });
    } else if (status === "starting") {
      setBuildProgress({ stage: "build", percent: 70, message: "Building application..." });
    } else if (status === "running") {
      setBuildProgress({ stage: "ready", percent: 100, message: "Ready" });
    } else if (status === "error") {
      setBuildProgress({ stage: "ready", percent: 0, message: "Build failed" });
    }
  }, [status]);

  // Reset boot state when project changes
  useEffect(() => {
    if (projectId !== bootedProjectIdRef.current) {
      console.log(`🔁 [LivePreview] PROJECT SWITCH: "${bootedProjectIdRef.current}" → "${projectId}"`);
      isBootedRef.current = false;
      prevFilesMapRef.current = new Map();
      bootedProjectIdRef.current = projectId;
      previewLoadedRef.current = false;
      pendingChangesRef.current = [];
      setIframeKey((k) => k + 1);
      if (reloadTimeoutRef.current) {
        clearTimeout(reloadTimeoutRef.current);
        reloadTimeoutRef.current = null;
      }
    }
  }, [projectId]);

  // Core boot and update logic
  useEffect(() => {
    if (!projectId) return;
    if (!files.length) return;
    if (!files.some((f) => f.path === "package.json")) {
      // Wait for package.json
      return;
    }

    console.log("[LivePreview] Files available:", files.map((f) => f.path).sort());

    // First time boot
    if (!isBootedRef.current) {
      // Don't boot if already booting/running
      if (previewLoadedRef.current && (status === "running" || status === "starting")) {
        isBootedRef.current = true;
        return;
      }

      const blockingPhases = ["booting", "mounting", "installing", "starting"];
      if (blockingPhases.includes(status)) {
        console.log(`[REMOUNT BLOCKED] Container is ${status} — waiting`);
        return;
      }

      // Check required files
      if (!hasRequiredFiles(files)) {
        isBootedRef.current = false;
        return;
      }

      isBootedRef.current = true;
      prevFilesMapRef.current = new Map(files.map((f) => [f.path, f.content]));

      if (status === "idle" || status === "waiting-files") {
        console.log(`[LivePreview] First boot → mountAndRun`);
        mountAndRun(files, projectId);
      } else if (status === "error") {
        console.log(`[LivePreview] Error state → remounting`);
        remount(files, projectId);
      }
      return;
    }

    // Detect if this is a post-load edit or generation
    const isEditOrGeneration = 
      lastCommitLabel.startsWith("Generated:") || lastCommitLabel.startsWith("Edit:");
    
    // 🔧 FIX: For edits/generations, reset the previewLoaded flag to allow file updates
    if (isEditOrGeneration && previewLoadedRef.current) {
      console.log("[LivePreview] 🔧 Edit detected → resetting previewLoaded to allow updates");
      previewLoadedRef.current = false;
    }

    // Already booted - handle file changes
    if (previewLoadedRef.current) {
      console.log("[LivePreview] Preview loaded — ignoring further file changes");
      return;
    }

    const newMap = new Map(files.map((f) => [f.path, f.content]));
    const changed: AIFile[] = [];
    for (const file of files) {
      if (prevFilesMapRef.current.get(file.path) !== file.content) {
        changed.push(file);
      }
    }
    prevFilesMapRef.current = newMap;
    if (!changed.length) return;

    // Check if changes came from chat panel (full generation)
    if (isEditOrGeneration || changed.length >= 5) {
      // Full remount
      console.log("[LivePreview] Major change → remount");
      remount(files, projectId);
      return;
    }

    // Determine if remount needed
    const needsRemount = changed.some(
      (f) =>
        f.path === "package.json" ||
        f.path === "vite.config.js" ||
        f.path === "vite.config.ts" ||
        f.path === "index.html"
    );

    if (needsRemount) {
      remount(files, projectId);
    } else {
      // Hot update via writeFiles
      if (autoReload) {
        writeFiles(changed);
        toast.success(`Updated ${changed.length} file(s)`, { duration: 1500 });
      } else {
        pendingChangesRef.current = [...pendingChangesRef.current, ...changed];
        toast.info(`${changed.length} file(s) changed. Click refresh to apply.`, {
          action: {
            label: "Apply",
            onClick: () => {
              writeFiles(pendingChangesRef.current);
              pendingChangesRef.current = [];
            },
          },
        });
      }
    }
  }, [
    files,
    projectId,
    lastCommitLabel,
    status,
    isInstalled,
    mountAndRun,
    writeFiles,
    remount,
    autoReload,
  ]);

  // Mark preview as loaded and set iframe src directly when URL arrives
  useEffect(() => {
    if (previewUrl && iframeRef.current) {
      console.log("[Preview] ✅ URL ready:", previewUrl);
      previewLoadedRef.current = true;
      setBuildProgress({ stage: "ready", percent: 100, message: "Ready" });
      // 🔧 FIX 2: Set iframe.src directly instead of relying on React state change + service worker
      iframeRef.current.src = previewUrl;
    }
  }, [previewUrl]);

  // Actions
  const handleRefresh = useCallback(() => {
    if (!files.length) return;
    setIsRefreshing(true);
    isBootedRef.current = false;
    prevFilesMapRef.current = new Map();
    bootedProjectIdRef.current = null;
    previewLoadedRef.current = false;
    pendingChangesRef.current = [];
    setIframeKey((k) => k + 1);
    remount(files, projectId);
    setTimeout(() => setIsRefreshing(false), 1000);
  }, [files, projectId, remount]);

  const handleHardRefresh = useCallback(() => {
    // Remount the preview completely
    handleRefresh();
  }, [handleRefresh]);

  const handleClearConsole = useCallback(() => {
    dispatch({ type: "CLEAR_CONSOLE" });
  }, []);

  const handleCopyConsole = useCallback(() => {
    const text = state.consoleEntries
      .map((e) => `[${e.timestamp.toISOString()}] ${e.type}: ${e.message}`)
      .join("\n");
    navigator.clipboard.writeText(text);
    toast.success("Console output copied");
  }, [state.consoleEntries]);

  const handleOpenInNewTab = useCallback(() => {
    if (previewUrl) {
      window.open(previewUrl, "_blank");
    }
  }, [previewUrl]);

  const handleDownloadLogs = useCallback(() => {
    const logs = {
      console: state.consoleEntries,
      network: state.networkRequests,
      timestamp: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(logs, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `preview-logs-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  }, [state]);

  // Simulate console capture from iframe
  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    // Override console methods in iframe (requires same origin, which WebContainer provides)
    try {
      const win = iframe.contentWindow as any;
      if (win && !win.__consoleHooked && win.console) {
        const originalConsole = win.console;
        const hook = (level: ConsoleEntry["type"]) => (...args: any[]) => {
          if (originalConsole[level]) originalConsole[level](...args);
          dispatch({
            type: "ADD_CONSOLE",
            payload: {
              type: level,
              message: args.map((a) => (typeof a === "object" ? JSON.stringify(a) : String(a))).join(" "),
            },
          });
        };
        win.console.log = hook("log");
        win.console.warn = hook("warn");
        win.console.error = hook("error");
        win.console.info = hook("info");
        win.__consoleHooked = true;
      }
    } catch (e) {
      // Cross-origin might block; ignore
    }
  }, [previewUrl, iframeKey]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === "r") {
        e.preventDefault();
        handleRefresh();
      }
      if (e.key === "Escape" && isFullscreen) {
        setIsFullscreen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleRefresh, isFullscreen]);

  // Prevent body scroll when fullscreen
  useEffect(() => {
    if (isFullscreen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isFullscreen]);

  return (
    <TooltipProvider>
      <div className="h-full min-h-0 flex flex-col bg-background border-l border-border">
        {/* Toolbar */}
        <div className="flex items-center justify-between px-3 py-2 border-b shrink-0 bg-muted/20">
          <div className="flex items-center gap-2">
            <Monitor className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">Preview</span>
            <StatusBadge status={status} />
          </div>

          <div className="flex items-center gap-1">
            {/* Device Selector */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7">
                  {device === "desktop" && <Monitor className="h-4 w-4" />}
                  {device === "tablet" && <Tablet className="h-4 w-4" />}
                  {device === "mobile" && <Smartphone className="h-4 w-4" />}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>Device</DropdownMenuLabel>
                <DropdownMenuItem onClick={() => setDevice("desktop")}>
                  <Monitor className="mr-2 h-4 w-4" /> Desktop
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setDevice("tablet")}>
                  <Tablet className="mr-2 h-4 w-4" /> Tablet
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setDevice("mobile")}>
                  <Smartphone className="mr-2 h-4 w-4" /> Mobile
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Auto-reload toggle */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => setAutoReload(!autoReload)}
                >
                  {autoReload ? (
                    <Wifi className="h-4 w-4 text-green-500" />
                  ) : (
                    <WifiOff className="h-4 w-4 text-muted-foreground" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {autoReload ? "Auto-reload on" : "Auto-reload off"}
              </TooltipContent>
            </Tooltip>

            {/* Refresh */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={handleRefresh}
                  disabled={!files.length || isRefreshing}
                >
                  <RefreshCw className={cn("h-4 w-4", isRefreshing && "animate-spin")} />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Refresh (Ctrl+R)</TooltipContent>
            </Tooltip>

            {/* More options */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7">
                  <ChevronDown className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onClick={handleHardRefresh}>
                  <RotateCcw className="mr-2 h-4 w-4" /> Hard Refresh
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleOpenInNewTab} disabled={!previewUrl}>
                  <ExternalLink className="mr-2 h-4 w-4" /> Open in New Tab
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setShowConsole(!showConsole)}>
                  <Terminal className="mr-2 h-4 w-4" />
                  {showConsole ? "Hide Console" : "Show Console"}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleDownloadLogs}>
                  <Download className="mr-2 h-4 w-4" /> Download Logs
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Fullscreen */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => setIsFullscreen(!isFullscreen)}
                >
                  {isFullscreen ? (
                    <Minimize2 className="h-4 w-4" />
                  ) : (
                    <Maximize2 className="h-4 w-4" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
              </TooltipContent>
            </Tooltip>
          </div>
        </div>

        {/* Build Progress (if not ready) */}
        {buildProgress.stage !== "ready" && (
          <div className="px-3 py-2 border-b bg-muted/10">
            <BuildProgressBar progress={buildProgress} />
          </div>
        )}

        {/* Preview Content */}
        <div className="flex-1 min-h-0 relative flex flex-col">
          {previewUrl ? (
            <DeviceFrame device={device} url={previewUrl}>
              <iframe
                key={iframeKey}
                ref={iframeRef}
                style={{
                  width: "100%",
                  height: "100%",
                  minHeight: "100%",
                  flex: 1,
                  border: "none",
                  display: "block",
                  backgroundColor: "#fff",
                }}
                title="Live preview"
                loading="eager"
                onLoad={() => {
                  console.log("[Preview] iframe onLoad fired");
                  // 🔧 FIX 3: Only hook console, don't trigger remount
                }}
                onError={(e) => {
                  console.error("[Preview] iframe onError", e);
                  dispatch({
                    type: "ADD_CONSOLE",
                    payload: { type: "error", message: "iframe failed to load" },
                  });
                }}
              />
            </DeviceFrame>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-3">
              {status === "error" ? (
                <>
                  <AlertCircle className="h-8 w-8 text-red-500" />
                  <p>Preview failed to start</p>
                  <Button variant="outline" size="sm" onClick={handleRefresh}>
                    <RefreshCw className="mr-2 h-4 w-4" /> Retry
                  </Button>
                </>
              ) : (
                <>
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  <p>Preparing preview... ({status})</p>
                </>
              )}
            </div>
          )}
        </div>

        {/* Console Panel (collapsible) */}
        <AnimatePresence>
          {showConsole && (
            <motion.div
              initial={{ height: 0 }}
              animate={{ height: 200 }}
              exit={{ height: 0 }}
              className="border-t overflow-hidden"
            >
              <Tabs
                value={activeTab}
                onValueChange={(v) => setActiveTab(v as typeof activeTab)}
                className="h-full flex flex-col"
              >
                <div className="flex items-center justify-between px-2 border-b">
                  <TabsList className="h-8">
                    <TabsTrigger value="console" className="text-xs">
                      Console
                    </TabsTrigger>
                    <TabsTrigger value="network" className="text-xs">
                      Network
                    </TabsTrigger>
                  </TabsList>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => setShowConsole(false)}
                  >
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                </div>
                <TabsContent value="console" className="flex-1 p-0">
                  <ConsolePanel
                    entries={state.consoleEntries}
                    onClear={handleClearConsole}
                    onCopy={handleCopyConsole}
                  />
                </TabsContent>
                <TabsContent value="network" className="flex-1 p-0">
                  <NetworkPanel
                    requests={state.networkRequests}
                    onClear={() => dispatch({ type: "CLEAR_NETWORK" })}
                  />
                </TabsContent>
              </Tabs>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Fullscreen Overlay */}
        {isFullscreen &&
          createPortal(
            <div className="fixed inset-0 z-[9999] bg-background">
              <div className="h-full flex flex-col">
                <div className="flex items-center justify-between p-2 border-b">
                  <span className="text-sm font-medium">Fullscreen Preview</span>
                  <Button variant="ghost" size="icon" onClick={() => setIsFullscreen(false)}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                <div className="flex-1 min-h-0">
                  {previewUrl && (
                    <iframe
                      src={previewUrl}
                      style={{
                        width: "100%",
                        height: "100%",
                        border: "none",
                        display: "block",
                      }}
                      title="Fullscreen preview"
                    />
                  )}
                </div>
              </div>
            </div>,
            document.body
          )}
      </div>
    </TooltipProvider>
  );
});

LivePreview.displayName = "LivePreview";
export default LivePreview;
