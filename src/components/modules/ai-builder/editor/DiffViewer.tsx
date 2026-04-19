// src/components/modules/ai-builder/editor/DiffViewer.tsx
"use client";

import React, {
  useMemo,
  useRef,
  useState,
  useEffect,
  useCallback,
  memo,
} from "react";
import { DiffEditor, DiffOnMount, loader } from "@monaco-editor/react";
import * as monaco from "monaco-editor";
import { useAIBuilderStore } from "../state/ai-builder.store";
import { cn } from "@/lib/utils";
import { useTheme } from "next-themes";
import {
  Check,
  X,
  ArrowLeft,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  Copy,
  Download,
  GitMerge,
  RotateCcw,
  Settings,
  SplitSquareVertical,
  AlignJustify,
  FileCode,
  Search,
  WrapText,
  Eye,
  EyeOff,
  Save,
  Upload,
  RefreshCw,
  MoreHorizontal,
  PanelLeftClose,
  PanelLeftOpen,
  ListFilter,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Info,
  Code2,
  Braces,
  Maximize2,
  Minimize2,
  Pin,
  PinOff,
  History,
  BookOpen,
  Link2,
  ExternalLink,
  GripVertical,
  Star,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
  DropdownMenuCheckboxItem,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator as ContextMenuSep,
  ContextMenuShortcut,
} from "@/components/ui/context-menu";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";

// ----------------------------------------------------------------------
// Types & Interfaces
// ----------------------------------------------------------------------

interface DiffViewerProps {
  original: string;
  modified: string;
  language?: string;
  filePath?: string;
  onAccept?: (acceptedContent: string) => void;
  onReject?: () => void;
  onAcceptPartial?: (changes: DiffChange[]) => void;
  readOnly?: boolean;
  showToolbar?: boolean;
  showStats?: boolean;
  // New props
  onSaveModified?: (content: string) => void;
  aiSuggestionId?: string;
}

interface DiffChange {
  id: string;
  originalStartLineNumber: number;
  originalEndLineNumber: number;
  modifiedStartLineNumber: number;
  modifiedEndLineNumber: number;
  changeType: "insert" | "delete" | "modify";
  content: string;
  accepted?: boolean;
  rejected?: boolean;
}

interface DiffViewerSettings {
  renderSideBySide: boolean;
  minimap: boolean;
  wordWrap: "on" | "off";
  fontSize: number;
  theme: "vs-dark" | "light" | "hc-black";
  showInlineDiff: boolean;
  ignoreTrimWhitespace: boolean;
  showUnchangedRegions: boolean;
  renderIndicators: boolean;
  originalEditable: boolean;
  modifiedEditable: boolean;
  enableSplitViewResizing: boolean;
  // New settings
  showOverviewRuler: boolean;
  useInlineViewWhenSpaceIsLimited: boolean;
  maxComputationTime: number;
  showDiffDecorations: "all" | "gutter" | "overview" | "minimap";
  diffAlgorithm: "legacy" | "advanced";
}

const DEFAULT_SETTINGS: DiffViewerSettings = {
  renderSideBySide: true,
  minimap: false,
  wordWrap: "on",
  fontSize: 13,
  theme: "vs-dark",
  showInlineDiff: true,
  ignoreTrimWhitespace: true,
  showUnchangedRegions: true,
  renderIndicators: true,
  originalEditable: false,
  modifiedEditable: false,
  enableSplitViewResizing: true,
  showOverviewRuler: true,
  useInlineViewWhenSpaceIsLimited: true,
  maxComputationTime: 5000,
  showDiffDecorations: "all",
  diffAlgorithm: "advanced",
};

// ----------------------------------------------------------------------
// Utility Functions
// ----------------------------------------------------------------------

const loadSettings = (): DiffViewerSettings => {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  try {
    const stored = localStorage.getItem("diff-viewer-settings-v2");
    if (stored) {
      const parsed = JSON.parse(stored);
      return { ...DEFAULT_SETTINGS, ...parsed };
    }
  } catch (error) {
    console.error("Failed to load diff viewer settings:", error);
  }
  return DEFAULT_SETTINGS;
};

const saveSettings = (settings: DiffViewerSettings) => {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem("diff-viewer-settings-v2", JSON.stringify(settings));
  } catch (error) {
    console.error("Failed to save diff viewer settings:", error);
  }
};

const getLanguageFromPath = (path?: string): string => {
  if (!path) return "plaintext";
  const ext = path.split(".").pop()?.toLowerCase();
  const langMap: Record<string, string> = {
    js: "javascript",
    jsx: "javascript",
    ts: "typescript",
    tsx: "typescript",
    css: "css",
    scss: "scss",
    html: "html",
    json: "json",
    md: "markdown",
    py: "python",
    java: "java",
    cpp: "cpp",
    go: "go",
    rs: "rust",
  };
  return langMap[ext || ""] || "plaintext";
};

const computeDiffStats = (original: string, modified: string) => {
  const lines = { added: 0, removed: 0, modified: 0, unchanged: 0 };
  const originalLines = original.split("\n");
  const modifiedLines = modified.split("\n");
  let i = 0,
    j = 0;
  while (i < originalLines.length && j < modifiedLines.length) {
    if (originalLines[i] === modifiedLines[j]) {
      lines.unchanged++;
      i++;
      j++;
    } else {
      let match = false;
      for (let k = 1; k < 5 && i + k < originalLines.length; k++) {
        if (originalLines[i + k] === modifiedLines[j]) {
          lines.removed += k;
          i += k;
          match = true;
          break;
        }
      }
      if (!match) {
        for (let k = 1; k < 5 && j + k < modifiedLines.length; k++) {
          if (originalLines[i] === modifiedLines[j + k]) {
            lines.added += k;
            j += k;
            match = true;
            break;
          }
        }
      }
      if (!match) {
        lines.modified++;
        i++;
        j++;
      }
    }
  }
  lines.added += Math.max(0, modifiedLines.length - j);
  lines.removed += Math.max(0, originalLines.length - i);
  return {
    additions: lines.added,
    deletions: lines.removed,
    modifications: lines.modified,
    unchanged: lines.unchanged,
  };
};

// ----------------------------------------------------------------------
// Settings Dialog Component
// ----------------------------------------------------------------------

const DiffSettingsDialog: React.FC<{
  settings: DiffViewerSettings;
  onSettingsChange: (settings: DiffViewerSettings) => void;
}> = ({ settings, onSettingsChange }) => {
  const [open, setOpen] = useState(false);
  const [localSettings, setLocalSettings] = useState(settings);
  const [activeTab, setActiveTab] = useState("view");

  useEffect(() => {
    setLocalSettings(settings);
  }, [settings, open]);

  const handleSave = () => {
    onSettingsChange(localSettings);
    setOpen(false);
    toast.success("Diff settings updated");
  };

  const handleReset = () => {
    setLocalSettings(DEFAULT_SETTINGS);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" title="Diff Settings">
          <Settings className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Diff Viewer Settings</DialogTitle>
          <DialogDescription>Customize how differences are displayed.</DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 min-h-0">
          <TabsList className="grid grid-cols-3 w-full">
            <TabsTrigger value="view">View</TabsTrigger>
            <TabsTrigger value="appearance">Appearance</TabsTrigger>
            <TabsTrigger value="advanced">Advanced</TabsTrigger>
          </TabsList>

          <ScrollArea className="flex-1 h-[350px] mt-4 pr-4">
            <TabsContent value="view" className="space-y-4">
              <div className="flex items-center justify-between">
                <Label>Side-by-side view</Label>
                <Switch
                  checked={localSettings.renderSideBySide}
                  onCheckedChange={(checked) =>
                    setLocalSettings((s) => ({ ...s, renderSideBySide: checked }))
                  }
                />
              </div>
              {localSettings.renderSideBySide && (
                <>
                  <div className="flex items-center justify-between">
                    <Label>Show inline diff indicators</Label>
                    <Switch
                      checked={localSettings.showInlineDiff}
                      onCheckedChange={(checked) =>
                        setLocalSettings((s) => ({ ...s, showInlineDiff: checked }))
                      }
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label>Auto inline when space limited</Label>
                    <Switch
                      checked={localSettings.useInlineViewWhenSpaceIsLimited}
                      onCheckedChange={(checked) =>
                        setLocalSettings((s) => ({ ...s, useInlineViewWhenSpaceIsLimited: checked }))
                      }
                    />
                  </div>
                </>
              )}
              <div className="flex items-center justify-between">
                <Label>Show unchanged regions</Label>
                <Switch
                  checked={localSettings.showUnchangedRegions}
                  onCheckedChange={(checked) =>
                    setLocalSettings((s) => ({ ...s, showUnchangedRegions: checked }))
                  }
                />
              </div>
              <div className="flex items-center justify-between">
                <Label>Allow editing original</Label>
                <Switch
                  checked={localSettings.originalEditable}
                  onCheckedChange={(checked) =>
                    setLocalSettings((s) => ({ ...s, originalEditable: checked }))
                  }
                />
              </div>
              <div className="flex items-center justify-between">
                <Label>Allow editing modified</Label>
                <Switch
                  checked={localSettings.modifiedEditable}
                  onCheckedChange={(checked) =>
                    setLocalSettings((s) => ({ ...s, modifiedEditable: checked }))
                  }
                />
              </div>
            </TabsContent>

            <TabsContent value="appearance" className="space-y-4">
              <div className="grid gap-2">
                <Label>Theme</Label>
                <Tabs
                  value={localSettings.theme}
                  onValueChange={(val) =>
                    setLocalSettings((s) => ({ ...s, theme: val as any }))
                  }
                >
                  <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="vs-dark">Dark</TabsTrigger>
                    <TabsTrigger value="light">Light</TabsTrigger>
                    <TabsTrigger value="hc-black">High Contrast</TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>
              <div className="grid gap-2">
                <Label>Font Size: {localSettings.fontSize}px</Label>
                <Slider
                  value={[localSettings.fontSize]}
                  min={8}
                  max={24}
                  step={1}
                  onValueChange={([val]) =>
                    setLocalSettings((s) => ({ ...s, fontSize: val }))
                  }
                />
              </div>
              <div className="flex items-center justify-between">
                <Label>Minimap</Label>
                <Switch
                  checked={localSettings.minimap}
                  onCheckedChange={(checked) =>
                    setLocalSettings((s) => ({ ...s, minimap: checked }))
                  }
                />
              </div>
              <div className="flex items-center justify-between">
                <Label>Word Wrap</Label>
                <Switch
                  checked={localSettings.wordWrap === "on"}
                  onCheckedChange={(checked) =>
                    setLocalSettings((s) => ({ ...s, wordWrap: checked ? "on" : "off" }))
                  }
                />
              </div>
              <div className="flex items-center justify-between">
                <Label>Show overview ruler</Label>
                <Switch
                  checked={localSettings.showOverviewRuler}
                  onCheckedChange={(checked) =>
                    setLocalSettings((s) => ({ ...s, showOverviewRuler: checked }))
                  }
                />
              </div>
              <div className="grid gap-2">
                <Label>Diff Decorations</Label>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" className="justify-between">
                      {localSettings.showDiffDecorations}
                      <ChevronDown className="h-4 w-4 opacity-50" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {(["all", "gutter", "overview", "minimap"] as const).map((opt) => (
                      <DropdownMenuItem
                        key={opt}
                        onClick={() => setLocalSettings((s) => ({ ...s, showDiffDecorations: opt }))}
                      >
                        {opt}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </TabsContent>

            <TabsContent value="advanced" className="space-y-4">
              <div className="flex items-center justify-between">
                <Label>Ignore trim whitespace</Label>
                <Switch
                  checked={localSettings.ignoreTrimWhitespace}
                  onCheckedChange={(checked) =>
                    setLocalSettings((s) => ({ ...s, ignoreTrimWhitespace: checked }))
                  }
                />
              </div>
              <div className="grid gap-2">
                <Label>Diff Algorithm</Label>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" className="justify-between">
                      {localSettings.diffAlgorithm}
                      <ChevronDown className="h-4 w-4 opacity-50" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => setLocalSettings((s) => ({ ...s, diffAlgorithm: "legacy" }))}>
                      Legacy
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setLocalSettings((s) => ({ ...s, diffAlgorithm: "advanced" }))}>
                      Advanced
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              <div className="grid gap-2">
                <Label>Max Computation Time: {localSettings.maxComputationTime}ms</Label>
                <Slider
                  value={[localSettings.maxComputationTime]}
                  min={1000}
                  max={10000}
                  step={500}
                  onValueChange={([val]) =>
                    setLocalSettings((s) => ({ ...s, maxComputationTime: val }))
                  }
                />
              </div>
              <div className="flex items-center justify-between">
                <Label>Enable split view resizing</Label>
                <Switch
                  checked={localSettings.enableSplitViewResizing}
                  onCheckedChange={(checked) =>
                    setLocalSettings((s) => ({ ...s, enableSplitViewResizing: checked }))
                  }
                />
              </div>
            </TabsContent>
          </ScrollArea>
        </Tabs>

        <DialogFooter className="flex justify-between items-center border-t pt-4 mt-2">
          <Button variant="outline" onClick={handleReset}>
            <RotateCcw className="mr-2 h-4 w-4" /> Reset
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={handleSave}>Apply</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// ----------------------------------------------------------------------
// Diff Change List Panel (Sidebar)
// ----------------------------------------------------------------------

const ChangeListPanel: React.FC<{
  changes: DiffChange[];
  onNavigate: (change: DiffChange) => void;
  onAcceptChange: (changeId: string) => void;
  onRejectChange: (changeId: string) => void;
  currentChangeId: string | null;
}> = ({ changes, onNavigate, onAcceptChange, onRejectChange, currentChangeId }) => {
  const [filter, setFilter] = useState<"all" | "accepted" | "rejected" | "pending">("all");
  const filtered = changes.filter((c) => {
    if (filter === "all") return true;
    if (filter === "accepted") return c.accepted;
    if (filter === "rejected") return c.rejected;
    return !c.accepted && !c.rejected;
  });

  return (
    <div className="w-64 border-r border-border flex flex-col h-full bg-muted/10">
      <div className="p-2 border-b flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider">Changes</span>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-6 w-6">
              <ListFilter className="h-3.5 w-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="text-xs">
            <DropdownMenuLabel>Filter</DropdownMenuLabel>
            <DropdownMenuCheckboxItem checked={filter === "all"} onCheckedChange={() => setFilter("all")}>
              All ({changes.length})
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem checked={filter === "pending"} onCheckedChange={() => setFilter("pending")}>
              Pending ({changes.filter(c => !c.accepted && !c.rejected).length})
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem checked={filter === "accepted"} onCheckedChange={() => setFilter("accepted")}>
              Accepted ({changes.filter(c => c.accepted).length})
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem checked={filter === "rejected"} onCheckedChange={() => setFilter("rejected")}>
              Rejected ({changes.filter(c => c.rejected).length})
            </DropdownMenuCheckboxItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <ScrollArea className="flex-1">
        <div className="p-1">
          {filtered.length === 0 ? (
            <div className="text-center text-muted-foreground text-xs py-4">No changes</div>
          ) : (
            filtered.map((change) => (
              <div
                key={change.id}
                className={cn(
                  "p-2 mb-1 rounded text-xs cursor-pointer transition-colors border border-transparent",
                  currentChangeId === change.id && "bg-primary/10 border-primary/30",
                  change.accepted && "bg-green-500/10",
                  change.rejected && "bg-red-500/10 line-through opacity-60",
                  !change.accepted && !change.rejected && "hover:bg-muted"
                )}
                onClick={() => onNavigate(change)}
              >
                <div className="flex items-center gap-1 mb-1">
                  <Badge
                    variant="outline"
                    className={cn(
                      "h-4 text-[9px] px-1",
                      change.changeType === "insert" && "text-green-500 border-green-500/30",
                      change.changeType === "delete" && "text-red-500 border-red-500/30",
                      change.changeType === "modify" && "text-yellow-500 border-yellow-500/30"
                    )}
                  >
                    {change.changeType}
                  </Badge>
                  <span className="text-muted-foreground ml-auto">
                    L{change.modifiedStartLineNumber}-{change.modifiedEndLineNumber}
                  </span>
                </div>
                <div className="font-mono truncate text-[11px]">
                  {change.content.slice(0, 40)}...
                </div>
                <div className="flex items-center gap-1 mt-1">
                  {!change.accepted && !change.rejected ? (
                    <>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-5 w-5 text-green-500 hover:text-green-600 hover:bg-green-500/10"
                        onClick={(e) => { e.stopPropagation(); onAcceptChange(change.id); }}
                      >
                        <Check className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-5 w-5 text-red-500 hover:text-red-600 hover:bg-red-500/10"
                        onClick={(e) => { e.stopPropagation(); onRejectChange(change.id); }}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </>
                  ) : change.accepted ? (
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                  ) : (
                    <XCircle className="h-4 w-4 text-red-500" />
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
};

// ----------------------------------------------------------------------
// Diff Toolbar Component
// ----------------------------------------------------------------------

const DiffToolbar: React.FC<{
  stats: ReturnType<typeof computeDiffStats>;
  onAccept: (() => void) | undefined;
  onReject: (() => void) | undefined;
  onNavigateNext: () => void;
  onNavigatePrev: () => void;
  currentChangeIndex: number;
  totalChanges: number;
  settings: DiffViewerSettings;
  onSettingsChange: (settings: DiffViewerSettings) => void;
  onCopyOriginal: () => void;
  onCopyModified: () => void;
  onDownloadDiff: () => void;
  onToggleSideBySide: () => void;
  onSaveModified?: () => void;
  showChangeList: boolean;
  setShowChangeList: (show: boolean) => void;
  onAcceptAllNonConflicting?: () => void;
  onRejectAll?: () => void;
}> = ({
  stats,
  onAccept,
  onReject,
  onNavigateNext,
  onNavigatePrev,
  currentChangeIndex,
  totalChanges,
  settings,
  onSettingsChange,
  onCopyOriginal,
  onCopyModified,
  onDownloadDiff,
  onToggleSideBySide,
  onSaveModified,
  showChangeList,
  setShowChangeList,
  onAcceptAllNonConflicting,
  onRejectAll,
}) => {
  return (
    <div className="flex items-center gap-1 px-2 py-1 border-b bg-muted/20">
      {onAccept && (
        <TooltipProvider delayDuration={300}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="default"
                size="sm"
                onClick={onAccept}
                className="bg-green-600 hover:bg-green-700 text-white h-7 text-xs"
              >
                <Check className="h-3.5 w-3.5 mr-1" /> Accept All
              </Button>
            </TooltipTrigger>
            <TooltipContent>Accept all changes</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
      {onReject && (
        <TooltipProvider delayDuration={300}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="destructive" size="sm" className="h-7 text-xs" onClick={onReject}>
                <X className="h-3.5 w-3.5 mr-1" /> Reject All
              </Button>
            </TooltipTrigger>
            <TooltipContent>Reject all changes</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
      <div className="w-px h-4 bg-border mx-1" />

      {/* Navigation */}
      <TooltipProvider delayDuration={300}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={onNavigatePrev}
              disabled={totalChanges === 0}
            >
              <ChevronUp className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Previous change</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={onNavigateNext}
              disabled={totalChanges === 0}
            >
              <ChevronDown className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Next change</TooltipContent>
        </Tooltip>
      </TooltipProvider>
      <span className="text-xs text-muted-foreground ml-1">
        {totalChanges > 0 ? `${currentChangeIndex + 1} / ${totalChanges}` : "0/0"}
      </span>

      <div className="w-px h-4 bg-border mx-1" />

      {/* View Options */}
      <TooltipProvider delayDuration={300}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant={settings.renderSideBySide ? "secondary" : "ghost"}
              size="icon"
              className="h-7 w-7"
              onClick={onToggleSideBySide}
            >
              <SplitSquareVertical className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Toggle side-by-side</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant={showChangeList ? "secondary" : "ghost"}
              size="icon"
              className="h-7 w-7"
              onClick={() => setShowChangeList(!showChangeList)}
            >
              <PanelLeftOpen className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Toggle change list</TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <div className="w-px h-4 bg-border mx-1" />

      <TooltipProvider delayDuration={300}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onCopyOriginal}>
              <Copy className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Copy original content</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onCopyModified}>
              <FileCode className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Copy modified content</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onDownloadDiff}>
              <Download className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Download as patch</TooltipContent>
        </Tooltip>
        {onSaveModified && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onSaveModified}>
                <Save className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Save modified content</TooltipContent>
          </Tooltip>
        )}
      </TooltipProvider>

      <div className="flex-1" />

      {/* Stats Summary */}
      <div className="flex items-center gap-3 text-xs mr-2">
        <span className="text-green-600 flex items-center gap-0.5">
          <ArrowUp className="h-3 w-3" /> {stats.additions}
        </span>
        <span className="text-red-600 flex items-center gap-0.5">
          <ArrowDown className="h-3 w-3" /> {stats.deletions}
        </span>
        <span className="text-yellow-600 flex items-center gap-0.5">
          <RefreshCw className="h-3 w-3" /> {stats.modifications}
        </span>
      </div>

      {/* More actions dropdown */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-7 w-7">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48 text-xs">
          <DropdownMenuItem onClick={onAcceptAllNonConflicting}>
            <Check className="mr-2 h-3.5 w-3.5 text-green-500" /> Accept Non-Conflicting
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onRejectAll} className="text-destructive">
            <X className="mr-2 h-3.5 w-3.5" /> Reject All
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => {}}>
            <GitMerge className="mr-2 h-3.5 w-3.5" /> Merge with Original
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DiffSettingsDialog settings={settings} onSettingsChange={onSettingsChange} />
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
};

// ----------------------------------------------------------------------
// Main DiffViewer Component
// ----------------------------------------------------------------------

const DiffViewer: React.FC<DiffViewerProps> = ({
  original,
  modified,
  language: propLanguage,
  filePath,
  onAccept,
  onReject,
  onAcceptPartial,
  readOnly = true,
  showToolbar = true,
  showStats = true,
  onSaveModified,
  aiSuggestionId,
}) => {
  const { activeFilePath, updateFile } = useAIBuilderStore();
  const { resolvedTheme } = useTheme();
  const diffEditorRef = useRef<monaco.editor.IStandaloneDiffEditor | null>(null);
  const monacoRef = useRef<typeof monaco | null>(null);
  const [editorMounted, setEditorMounted] = useState(false);
  const [settings, setSettings] = useState<DiffViewerSettings>(loadSettings);
  const [currentChangeIndex, setCurrentChangeIndex] = useState(0);
  const [totalChanges, setTotalChanges] = useState(0);
  const [monacoLoadError, setMonacoLoadError] = useState(false);
  const [showChangeList, setShowChangeList] = useState(true);
  const [changes, setChanges] = useState<DiffChange[]>([]);
  const [currentChangeId, setCurrentChangeId] = useState<string | null>(null);

  // Language detection
  const language = useMemo(
    () => propLanguage || getLanguageFromPath(filePath || activeFilePath || undefined),
    [propLanguage, filePath, activeFilePath]
  );

  const editorTheme = useMemo(() => {
    if (settings.theme !== "vs-dark") return settings.theme;
    return resolvedTheme === "dark" ? "vs-dark" : "light";
  }, [settings.theme, resolvedTheme]);

  const stats = useMemo(() => computeDiffStats(original, modified), [original, modified]);
  const hasDiff = original !== modified;

  // Update settings with persistence
  const handleSettingsChange = useCallback((newSettings: DiffViewerSettings) => {
    setSettings(newSettings);
    saveSettings(newSettings);
    if (diffEditorRef.current) {
      // Transform settings to Monaco IDiffEditorOptions
      const monacoOptions: any = {
        ...newSettings,
        minimap: newSettings.minimap ? { enabled: true } : { enabled: false },
      };
      delete monacoOptions.renderSideBySideInline; // Remove unsupported prop
      diffEditorRef.current.updateOptions(monacoOptions);
    }
  }, []);

  const toggleSideBySide = useCallback(() => {
    handleSettingsChange({
      ...settings,
      renderSideBySide: !settings.renderSideBySide,
    });
  }, [settings, handleSettingsChange]);

  // Navigation
  const navigateNext = useCallback(() => {
    if (diffEditorRef.current && totalChanges > 0) {
      const nextIndex = (currentChangeIndex + 1) % totalChanges;
      diffEditorRef.current.goToDiff("next");
      setCurrentChangeIndex(nextIndex);
      if (changes[nextIndex]) setCurrentChangeId(changes[nextIndex].id);
    }
  }, [currentChangeIndex, totalChanges, changes]);

  const navigatePrev = useCallback(() => {
    if (diffEditorRef.current && totalChanges > 0) {
      const prevIndex = currentChangeIndex === 0 ? totalChanges - 1 : currentChangeIndex - 1;
      diffEditorRef.current.goToDiff("previous");
      setCurrentChangeIndex(prevIndex);
      if (changes[prevIndex]) setCurrentChangeId(changes[prevIndex].id);
    }
  }, [currentChangeIndex, totalChanges, changes]);

  const navigateToChange = useCallback((change: DiffChange) => {
    // Find index and navigate
    const idx = changes.findIndex(c => c.id === change.id);
    if (idx !== -1 && diffEditorRef.current) {
      // Navigate to next diff (can't jump to specific index with Monaco's goToDiff)
      if (idx > currentChangeIndex) {
        diffEditorRef.current.goToDiff("next");
      } else if (idx < currentChangeIndex) {
        diffEditorRef.current.goToDiff("previous");
      }
      setCurrentChangeIndex(idx);
      setCurrentChangeId(change.id);
    }
  }, [changes, currentChangeIndex]);

  // Copy actions
  const copyOriginal = useCallback(() => {
    navigator.clipboard.writeText(original);
    toast.success("Original content copied");
  }, [original]);

  const copyModified = useCallback(() => {
    navigator.clipboard.writeText(modified);
    toast.success("Modified content copied");
  }, [modified]);

  const downloadDiff = useCallback(() => {
    const header = `--- a/${filePath || "original"}\n+++ b/${filePath || "modified"}\n`;
    const lines = modified.split("\n");
    const patch = header + "@@ -1,1 +1,1 @@\n" + lines.map((l) => `+${l}`).join("\n");
    const blob = new Blob([patch], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${filePath?.split("/").pop() || "changes"}.patch`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Patch downloaded");
  }, [original, modified, filePath]);

  const handleSaveModified = useCallback(() => {
    if (onSaveModified) {
      onSaveModified(modified);
    } else if (filePath) {
      updateFile(filePath, modified);
      toast.success(`Saved ${filePath.split("/").pop()}`);
    }
  }, [modified, filePath, onSaveModified, updateFile]);

  // Handle individual change accept/reject
  const handleAcceptChange = useCallback((changeId: string) => {
    setChanges(prev => prev.map(c => c.id === changeId ? { ...c, accepted: true, rejected: false } : c));
    toast.success("Change accepted");
  }, []);

  const handleRejectChange = useCallback((changeId: string) => {
    setChanges(prev => prev.map(c => c.id === changeId ? { ...c, rejected: true, accepted: false } : c));
    toast.success("Change rejected");
  }, []);

  // Parse changes from Monaco diff editor
  const parseChanges = useCallback(() => {
    if (!diffEditorRef.current) return;
    const lineChanges = diffEditorRef.current.getLineChanges();
    if (!lineChanges) return;
    const newChanges: DiffChange[] = lineChanges.map((lc, idx) => ({
      id: `change-${idx}`,
      originalStartLineNumber: lc.originalStartLineNumber,
      originalEndLineNumber: lc.originalEndLineNumber,
      modifiedStartLineNumber: lc.modifiedStartLineNumber,
      modifiedEndLineNumber: lc.modifiedEndLineNumber,
      changeType: lc.originalEndLineNumber === 0 ? "insert" : lc.modifiedEndLineNumber === 0 ? "delete" : "modify",
      content: modified.split("\n").slice(lc.modifiedStartLineNumber - 1, lc.modifiedEndLineNumber).join("\n"),
      accepted: false,
      rejected: false,
    }));
    setChanges(newChanges);
    setTotalChanges(newChanges.length);
  }, [modified]);

  // Editor mount handler
  const handleEditorDidMount: DiffOnMount = (editor, monaco) => {
    diffEditorRef.current = editor;
    monacoRef.current = monaco;
    setEditorMounted(true);

    // Update change count
    const lineChanges = editor.getLineChanges();
    setTotalChanges(lineChanges?.length || 0);
    parseChanges();

    // Register custom actions
    editor.addAction({
      id: "accept-current-change",
      label: "Accept Current Change",
      keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter],
      run: () => {
        if (currentChangeId) handleAcceptChange(currentChangeId);
        else toast.info("No change selected");
      },
    });

    editor.addAction({
      id: "reject-current-change",
      label: "Reject Current Change",
      keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.Enter],
      run: () => {
        if (currentChangeId) handleRejectChange(currentChangeId);
        else toast.info("No change selected");
      },
    });

    editor.onDidUpdateDiff(() => {
      parseChanges();
    });
  };

  // Fallback on load error
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (!editorMounted) setMonacoLoadError(true);
    }, 8000);
    return () => clearTimeout(timeout);
  }, [editorMounted]);

  const handleEditorError = (error: unknown) => {
    console.error("Diff editor load error:", error);
    setMonacoLoadError(true);
  };

  // Render fallback
  if (monacoLoadError) {
    return (
      <div className="h-full flex flex-col">
        <div className="p-3 border-b text-sm font-medium flex items-center justify-between bg-muted/20">
          <span>Diff Viewer (fallback)</span>
          <span className="text-xs text-muted-foreground">{filePath || activeFilePath || "No file"}</span>
        </div>
        <div className="flex-1 grid grid-cols-2 gap-4 p-4 overflow-auto">
          <div>
            <h3 className="text-sm font-medium mb-2">Original</h3>
            <pre className="p-2 border rounded bg-muted text-xs whitespace-pre-wrap">{original}</pre>
          </div>
          <div>
            <h3 className="text-sm font-medium mb-2">Modified</h3>
            <pre className="p-2 border rounded bg-muted text-xs whitespace-pre-wrap">{modified}</pre>
          </div>
        </div>
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="h-full flex flex-col overflow-hidden">
        {/* Header with file info */}
        <div className="p-3 border-b text-sm font-medium flex items-center justify-between bg-muted/20 shrink-0">
          <div className="flex items-center gap-2">
            <GitMerge className="h-4 w-4 text-blue-500" />
            <span>AI Suggested Changes</span>
            {aiSuggestionId && <Badge variant="outline">{aiSuggestionId}</Badge>}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground font-mono">
              {filePath || activeFilePath || "Untitled"}
            </span>
            <span className="text-xs bg-muted px-2 py-0.5 rounded">{language}</span>
          </div>
        </div>

        {/* Toolbar */}
        {showToolbar && (
          <DiffToolbar
            stats={stats}
            onAccept={onAccept ? () => onAccept(modified) : undefined}
            onReject={onReject}
            onNavigateNext={navigateNext}
            onNavigatePrev={navigatePrev}
            currentChangeIndex={currentChangeIndex}
            totalChanges={totalChanges}
            settings={settings}
            onSettingsChange={handleSettingsChange}
            onCopyOriginal={copyOriginal}
            onCopyModified={copyModified}
            onDownloadDiff={downloadDiff}
            onToggleSideBySide={toggleSideBySide}
            onSaveModified={handleSaveModified}
            showChangeList={showChangeList}
            setShowChangeList={setShowChangeList}
            onAcceptAllNonConflicting={() => {
              setChanges(prev => prev.map(c => ({ ...c, accepted: true })));
              toast.success("All non-conflicting changes accepted");
            }}
            onRejectAll={() => {
              setChanges(prev => prev.map(c => ({ ...c, rejected: true })));
              toast.success("All changes rejected");
            }}
          />
        )}

        {/* Main Content: Change List + Diff Editor */}
        <div className="flex-1 flex min-h-0">
          <AnimatePresence>
            {showChangeList && (
              <motion.div
                initial={{ width: 0, opacity: 0 }}
                animate={{ width: 260, opacity: 1 }}
                exit={{ width: 0, opacity: 0 }}
                className="shrink-0"
              >
                <ChangeListPanel
                  changes={changes}
                  onNavigate={navigateToChange}
                  onAcceptChange={handleAcceptChange}
                  onRejectChange={handleRejectChange}
                  currentChangeId={currentChangeId}
                />
              </motion.div>
            )}
          </AnimatePresence>

          <div className="flex-1 relative">
            {hasDiff ? (
              <DiffEditor
                height="100%"
                language={language}
                original={original}
                modified={modified}
                theme={editorTheme}
                onMount={handleEditorDidMount}
                options={{
                  renderSideBySide: settings.renderSideBySide,
                  lineNumbers: "on",
                  glyphMargin: true,
                  folding: true,
                  readOnly,
                  originalEditable: settings.originalEditable,
                  wordWrap: settings.wordWrap,
                  fontSize: settings.fontSize,
                  fontFamily: "JetBrains Mono, Menlo, Monaco, 'Courier New', monospace",
                  renderIndicators: settings.renderIndicators,
                  ignoreTrimWhitespace: settings.ignoreTrimWhitespace,
                  renderOverviewRuler: settings.showOverviewRuler,
                  enableSplitViewResizing: settings.enableSplitViewResizing,
                  automaticLayout: true,
                  scrollBeyondLastLine: false,
                  smoothScrolling: true,
                  renderWhitespace: "selection",
                  bracketPairColorization: { enabled: true },
                  minimap: settings.minimap ? { enabled: true } : { enabled: false },
                  ...(settings.showUnchangedRegions
                    ? {}
                    : { hideUnchangedRegions: { enabled: true } }),
                  useInlineViewWhenSpaceIsLimited: settings.useInlineViewWhenSpaceIsLimited,
                  maxComputationTime: settings.maxComputationTime,
                  diffAlgorithm: settings.diffAlgorithm,
                }}
                loading={
                  <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
                    Loading diff...
                  </div>
                }
              />
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-sm text-muted-foreground">
                <FileCode className="h-8 w-8 mb-2 opacity-50" />
                <p>No differences to display.</p>
                <p className="text-xs mt-1">The original and modified content are identical.</p>
              </div>
            )}
          </div>
        </div>

        {/* Stats Footer */}
        {showStats && hasDiff && (
          <div className="flex items-center justify-between px-3 py-1 border-t text-xs text-muted-foreground bg-muted/10 shrink-0">
            <div className="flex items-center gap-4">
              <span>
                <span className="text-green-600">+{stats.additions}</span> additions,
                <span className="text-red-600 ml-1">-{stats.deletions}</span> deletions,
                <span className="text-yellow-600 ml-1">~{stats.modifications}</span> modifications
              </span>
            </div>
            <div className="flex items-center gap-4">
              <span>
                {totalChanges} change{totalChanges !== 1 ? "s" : ""}
              </span>
              <span>UTF-8</span>
              <span>{editorTheme}</span>
            </div>
          </div>
        )}
      </div>
    </TooltipProvider>
  );
};

export default DiffViewer;