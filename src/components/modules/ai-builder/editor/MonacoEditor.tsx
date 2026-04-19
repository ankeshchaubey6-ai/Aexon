// src/components/modules/ai-builder/editor/MonacoEditor.tsx
"use client";

import React, {
  useCallback,
  useMemo,
  useRef,
  useEffect,
  useState,
  useContext,
  createContext,
  memo,
} from "react";
import MonacoEditorLib, {
  loader,
  OnMount,
  OnChange,
  EditorProps,
  Monaco,
} from "@monaco-editor/react";
import * as monacoModule from "monaco-editor";
import { useAIBuilderStore } from "../state/ai-builder.store";
import { cn } from "@/lib/utils";
import { useTheme } from "next-themes";
import {
  Save,
  Settings,
  Search,
  Replace,
  Undo2,
  Redo2,
  Copy,
  ClipboardPaste,
  Scissors,
  WrapText,
  Type,
  ChevronDown,
  Download,
  Upload,
  RotateCcw,
  Check,
  X,
  AlertCircle,
  Info,
  Terminal,
  GitBranch,
  Code,
  Eye,
  EyeOff,
  SplitSquareVertical,
  PanelRightClose,
  PanelRightOpen,
  LayoutGrid,
  Maximize2,
  Minimize2,
  Sparkles,
  FileCode,
  FolderOpen,
  RefreshCw,
  MoreHorizontal,
  Pin,
  PinOff,
  Star,
  Clock,
  History,
  BookOpen,
  Link,
  ExternalLink,
  ArrowUp,
  ArrowDown,
  Play,
  Bug,
  Variable,
  Braces,
  Square,
  GripVertical,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
  DropdownMenuCheckboxItem,
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
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
import type { AIFileNode } from "@/lib/ai/types/ai-project.types";

// ----------------------------------------------------------------------
// Types & Interfaces
// ----------------------------------------------------------------------

interface EditorSettings {
  fontSize: number;
  wordWrap: "on" | "off" | "wordWrapColumn" | "bounded";
  minimap: boolean;
  lineNumbers: "on" | "off" | "relative" | "interval";
  theme: "vs-dark" | "light" | "hc-black";
  tabSize: number;
  renderWhitespace: "none" | "boundary" | "selection" | "trailing" | "all";
  bracketPairColorization: boolean;
  autoSave: boolean;
  autoSaveDelay: number;
  fontFamily: string;
  fontLigatures: boolean;
  cursorStyle: "line" | "block" | "underline";
  cursorBlinking: "blink" | "smooth" | "phase" | "expand" | "solid";
  smoothScrolling: boolean;
  mouseWheelZoom: boolean;
  showFoldingControls: "always" | "mouseover";
  // New settings
  stickyScroll: boolean;
  parameterHints: boolean;
  quickSuggestions: boolean;
  formatOnSave: boolean;
  formatOnPaste: boolean;
  linkedEditing: boolean;
  rulers: number[];
  inlayHints: boolean;
  codeLens: boolean;
  lightbulb: boolean;
  renderLineHighlight: "none" | "gutter" | "line" | "all";
  matchBrackets: "never" | "near" | "always";
}

const DEFAULT_SETTINGS: EditorSettings = {
  fontSize: 13,
  wordWrap: "on",
  minimap: true,
  lineNumbers: "on",
  theme: "vs-dark",
  tabSize: 2,
  renderWhitespace: "selection",
  bracketPairColorization: true,
  autoSave: true,
  autoSaveDelay: 1000,
  fontFamily: "JetBrains Mono, Menlo, Monaco, 'Courier New', monospace",
  fontLigatures: true,
  cursorStyle: "line",
  cursorBlinking: "blink",
  smoothScrolling: true,
  mouseWheelZoom: false,
  showFoldingControls: "mouseover",
  stickyScroll: true,
  parameterHints: true,
  quickSuggestions: true,
  formatOnSave: false,
  formatOnPaste: true,
  linkedEditing: true,
  rulers: [80, 120],
  inlayHints: true,
  codeLens: true,
  lightbulb: true,
  renderLineHighlight: "all",
  matchBrackets: "always",
};

interface EditorTab {
  path: string;
  isDirty: boolean;
  isPinned: boolean;
  isPreview: boolean;
  lastAccessed: number;
}

interface SearchState {
  query: string;
  replaceWith: string;
  isRegex: boolean;
  matchCase: boolean;
  wholeWord: boolean;
  preserveCase: boolean;
  isSearchOpen: boolean;
  isReplaceOpen: boolean;
  resultsCount: number;
  currentResultIndex: number;
}

interface EditorContextValue {
  settings: EditorSettings;
  updateSettings: (partial: Partial<EditorSettings>) => void;
  openTabs: EditorTab[];
  activeTab: string | null;
  setActiveTab: (path: string) => void;
  closeTab: (path: string) => void;
  closeAllTabs: () => void;
  closeOtherTabs: (path: string) => void;
  closeTabsToTheRight: (path: string) => void;
  pinTab: (path: string) => void;
  previewTab: (path: string) => void;
  searchState: SearchState;
  setSearchState: React.Dispatch<React.SetStateAction<SearchState>>;
  editorInstance: monacoModule.editor.IStandaloneCodeEditor | null;
  monacoInstance: typeof monacoModule | null;
  // Additional
  isAIPanelOpen: boolean;
  setIsAIPanelOpen: (open: boolean) => void;
  isTerminalOpen: boolean;
  setIsTerminalOpen: (open: boolean) => void;
  splitViewEnabled: boolean;
  setSplitViewEnabled: (enabled: boolean) => void;
}

const EditorContext = createContext<EditorContextValue | null>(null);

const useEditorContext = () => {
  const ctx = useContext(EditorContext);
  if (!ctx) throw new Error("useEditorContext must be used within EditorProvider");
  return ctx;
};

// ----------------------------------------------------------------------
// Utility Functions & Hooks
// ----------------------------------------------------------------------

const loadSettings = (): EditorSettings => {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  try {
    const stored = localStorage.getItem("monaco-editor-settings-v2");
    if (stored) {
      const parsed = JSON.parse(stored) as Partial<EditorSettings>;
      return { ...DEFAULT_SETTINGS, ...parsed };
    }
  } catch (error) {
    console.error("Failed to load editor settings:", error);
  }
  return DEFAULT_SETTINGS;
};

const saveSettings = (settings: EditorSettings) => {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem("monaco-editor-settings-v2", JSON.stringify(settings));
  } catch (error) {
    console.error("Failed to save editor settings:", error);
  }
};

const getLanguageFromPath = (path: string): string => {
  const ext = path.split(".").pop()?.toLowerCase();
  const langMap: Record<string, string> = {
    js: "javascript",
    jsx: "javascript",
    ts: "typescript",
    tsx: "typescript",
    css: "css",
    scss: "scss",
    less: "less",
    html: "html",
    htm: "html",
    json: "json",
    md: "markdown",
    py: "python",
    java: "java",
    cpp: "cpp",
    c: "c",
    cs: "csharp",
    go: "go",
    rs: "rust",
    php: "php",
    rb: "ruby",
    swift: "swift",
    kt: "kotlin",
    xml: "xml",
    yaml: "yaml",
    yml: "yaml",
    sh: "shell",
    bat: "bat",
    sql: "sql",
    graphql: "graphql",
    vue: "vue",
    svelte: "svelte",
    astro: "astro",
    prisma: "prisma",
  };
  return langMap[ext || ""] || "plaintext";
};

const useDebouncedSave = (
  callback: (value: string) => void,
  delay: number,
  enabled: boolean
) => {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pendingValueRef = useRef<string | null>(null);

  const debouncedSave = useCallback(
    (value: string) => {
      if (!enabled) {
        callback(value);
        return;
      }
      pendingValueRef.current = value;
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => {
        if (pendingValueRef.current !== null) {
          callback(pendingValueRef.current);
          pendingValueRef.current = null;
        }
      }, delay);
    },
    [callback, delay, enabled]
  );

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  return debouncedSave;
};

// ----------------------------------------------------------------------
// Editor Toolbar Components
// ----------------------------------------------------------------------

const EditorToolbar: React.FC = memo(() => {
  const {
    settings,
    updateSettings,
    editorInstance,
    monacoInstance,
    searchState,
    setSearchState,
    isAIPanelOpen,
    setIsAIPanelOpen,
    isTerminalOpen,
    setIsTerminalOpen,
    splitViewEnabled,
    setSplitViewEnabled,
  } = useEditorContext();
  const { activeFilePath, files, updateFile } = useAIBuilderStore();
  const activeFile = files.find((f) => f.path === activeFilePath);
  const [isFormatting, setIsFormatting] = useState(false);

  const handleSave = useCallback(() => {
    if (!activeFilePath || !editorInstance) return;
    const content = editorInstance.getValue();
    updateFile(activeFilePath, content);
    toast.success(`Saved ${activeFilePath.split("/").pop()}`);
  }, [activeFilePath, editorInstance, updateFile]);

  const handleUndo = () => editorInstance?.trigger("keyboard", "undo", null);
  const handleRedo = () => editorInstance?.trigger("keyboard", "redo", null);
  const handleCopy = () => editorInstance?.trigger("keyboard", "editor.action.clipboardCopyAction", null);
  const handleCut = () => editorInstance?.trigger("keyboard", "editor.action.clipboardCutAction", null);
  const handlePaste = () => editorInstance?.trigger("keyboard", "editor.action.clipboardPasteAction", null);

  const handleFormatDocument = useCallback(async () => {
    if (!editorInstance || !monacoInstance) return;
    setIsFormatting(true);
    try {
      await editorInstance.getAction("editor.action.formatDocument")?.run();
      toast.success("Document formatted");
    } catch (e) {
      toast.error("Formatting failed");
    } finally {
      setIsFormatting(false);
    }
  }, [editorInstance, monacoInstance]);

  const handleSearchToggle = () => {
    if (editorInstance) {
      editorInstance.trigger("keyboard", "actions.find", null);
    }
    setSearchState((prev) => ({ ...prev, isSearchOpen: !prev.isSearchOpen }));
  };

  const handleReplaceToggle = () => {
    if (editorInstance) {
      editorInstance.trigger("keyboard", "editor.action.startFindReplaceAction", null);
    }
    setSearchState((prev) => ({ ...prev, isReplaceOpen: !prev.isReplaceOpen }));
  };

  const handleDownload = () => {
    if (!activeFile) return;
    const blob = new Blob([activeFile.content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = (activeFilePath || "file").split("/").pop() || "file";
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleUpload = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        const content = ev.target?.result as string;
        const path = file.name;
        updateFile(path, content);
        toast.success(`Uploaded ${path}`);
      };
      reader.readAsText(file);
    };
    input.click();
  };

  const handleToggleMinimap = () => {
    updateSettings({ minimap: !settings.minimap });
  };

  return (
    <div className="flex items-center gap-0.5 px-2 py-1 border-b bg-muted/20">
      <TooltipProvider delayDuration={300}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleSave}>
              <Save className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">Save (Ctrl+S)</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleUndo}>
              <Undo2 className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">Undo (Ctrl+Z)</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleRedo}>
              <Redo2 className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">Redo (Ctrl+Y)</TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <div className="w-px h-4 bg-border mx-1" />

      <TooltipProvider delayDuration={300}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleCopy}>
              <Copy className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">Copy (Ctrl+C)</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleCut}>
              <Scissors className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">Cut (Ctrl+X)</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handlePaste}>
              <ClipboardPaste className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">Paste (Ctrl+V)</TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <div className="w-px h-4 bg-border mx-1" />

      <TooltipProvider delayDuration={300}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant={searchState.isSearchOpen ? "secondary" : "ghost"}
              size="icon"
              className="h-7 w-7"
              onClick={handleSearchToggle}
            >
              <Search className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">Find (Ctrl+F)</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant={searchState.isReplaceOpen ? "secondary" : "ghost"}
              size="icon"
              className="h-7 w-7"
              onClick={handleReplaceToggle}
            >
              <Replace className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">Replace (Ctrl+H)</TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <div className="w-px h-4 bg-border mx-1" />

      <TooltipProvider delayDuration={300}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={handleFormatDocument}
              disabled={isFormatting}
            >
              <Braces className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">Format Document (Shift+Alt+F)</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleToggleMinimap}>
              {settings.minimap ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">Toggle Minimap</TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <div className="flex-1" />

      <TooltipProvider delayDuration={300}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant={isAIPanelOpen ? "secondary" : "ghost"}
              size="icon"
              className="h-7 w-7"
              onClick={() => setIsAIPanelOpen(!isAIPanelOpen)}
            >
              <Sparkles className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">AI Assistant</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant={isTerminalOpen ? "secondary" : "ghost"}
              size="icon"
              className="h-7 w-7"
              onClick={() => setIsTerminalOpen(!isTerminalOpen)}
            >
              <Terminal className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">Toggle Terminal</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant={splitViewEnabled ? "secondary" : "ghost"}
              size="icon"
              className="h-7 w-7"
              onClick={() => setSplitViewEnabled(!splitViewEnabled)}
            >
              <SplitSquareVertical className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">Split Editor</TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-7 w-7">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem onClick={handleDownload}>
            <Download className="mr-2 h-4 w-4" /> Download
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleUpload}>
            <Upload className="mr-2 h-4 w-4" /> Upload
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => editorInstance?.getAction("editor.action.goToDefinition")?.run()}>
            <Link className="mr-2 h-4 w-4" /> Go to Definition
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => editorInstance?.getAction("editor.action.peekDefinition")?.run()}>
            <ExternalLink className="mr-2 h-4 w-4" /> Peek Definition
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => editorInstance?.getAction("editor.action.referenceSearch.trigger")?.run()}>
            <BookOpen className="mr-2 h-4 w-4" /> Find References
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <EditorSettingsDialog />
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
});
EditorToolbar.displayName = "EditorToolbar";

// ----------------------------------------------------------------------
// Editor Settings Dialog (Expanded)
// ----------------------------------------------------------------------

const EditorSettingsDialog: React.FC = () => {
  const { settings, updateSettings } = useEditorContext();
  const [open, setOpen] = useState(false);
  const [localSettings, setLocalSettings] = useState(settings);
  const [activeTab, setActiveTab] = useState("general");

  useEffect(() => {
    setLocalSettings(settings);
  }, [settings, open]);

  const handleSave = () => {
    updateSettings(localSettings);
    setOpen(false);
    toast.success("Editor settings updated");
  };

  const handleReset = () => {
    setLocalSettings(DEFAULT_SETTINGS);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
          <Settings className="mr-2 h-4 w-4" /> Settings
        </DropdownMenuItem>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Editor Settings</DialogTitle>
          <DialogDescription>
            Customize your editing experience. Changes are applied immediately.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 min-h-0">
          <TabsList className="grid grid-cols-4 w-full">
            <TabsTrigger value="general">General</TabsTrigger>
            <TabsTrigger value="appearance">Appearance</TabsTrigger>
            <TabsTrigger value="behavior">Behavior</TabsTrigger>
            <TabsTrigger value="advanced">Advanced</TabsTrigger>
          </TabsList>

          <ScrollArea className="flex-1 h-[400px] mt-4 pr-4">
            <TabsContent value="general" className="space-y-4">
              <div className="grid gap-3">
                <div className="flex items-center justify-between">
                  <Label>Auto Save</Label>
                  <Switch
                    checked={localSettings.autoSave}
                    onCheckedChange={(checked) =>
                      setLocalSettings((s) => ({ ...s, autoSave: checked }))
                    }
                  />
                </div>
                {localSettings.autoSave && (
                  <div className="grid gap-2">
                    <Label>Auto Save Delay: {localSettings.autoSaveDelay}ms</Label>
                    <Slider
                      value={[localSettings.autoSaveDelay]}
                      min={500}
                      max={5000}
                      step={100}
                      onValueChange={([val]) =>
                        setLocalSettings((s) => ({ ...s, autoSaveDelay: val }))
                      }
                    />
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <Label>Format on Save</Label>
                  <Switch
                    checked={localSettings.formatOnSave}
                    onCheckedChange={(checked) =>
                      setLocalSettings((s) => ({ ...s, formatOnSave: checked }))
                    }
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label>Format on Paste</Label>
                  <Switch
                    checked={localSettings.formatOnPaste}
                    onCheckedChange={(checked) =>
                      setLocalSettings((s) => ({ ...s, formatOnPaste: checked }))
                    }
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Tab Size: {localSettings.tabSize}</Label>
                  <Slider
                    value={[localSettings.tabSize]}
                    min={2}
                    max={8}
                    step={1}
                    onValueChange={([val]) =>
                      setLocalSettings((s) => ({ ...s, tabSize: val }))
                    }
                  />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="appearance" className="space-y-4">
              <div className="grid gap-3">
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

                <div className="grid gap-2">
                  <Label>Font Family</Label>
                  <Input
                    value={localSettings.fontFamily}
                    onChange={(e) =>
                      setLocalSettings((s) => ({ ...s, fontFamily: e.target.value }))
                    }
                    placeholder="e.g., JetBrains Mono"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <Label>Font Ligatures</Label>
                  <Switch
                    checked={localSettings.fontLigatures}
                    onCheckedChange={(checked) =>
                      setLocalSettings((s) => ({ ...s, fontLigatures: checked }))
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

                <div className="grid gap-2">
                  <Label>Line Numbers</Label>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" className="justify-between">
                        {localSettings.lineNumbers}
                        <ChevronDown className="h-4 w-4 opacity-50" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {(["on", "off", "relative", "interval"] as const).map((opt) => (
                        <DropdownMenuItem
                          key={opt}
                          onClick={() => setLocalSettings((s) => ({ ...s, lineNumbers: opt }))}
                        >
                          {opt}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="behavior" className="space-y-4">
              <div className="grid gap-3">
                <div className="flex items-center justify-between">
                  <Label>Cursor Style</Label>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" className="justify-between w-32">
                        {localSettings.cursorStyle}
                        <ChevronDown className="h-4 w-4 opacity-50" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {(["line", "block", "underline"] as const).map((opt) => (
                        <DropdownMenuItem
                          key={opt}
                          onClick={() => setLocalSettings((s) => ({ ...s, cursorStyle: opt }))}
                        >
                          {opt}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                <div className="flex items-center justify-between">
                  <Label>Smooth Scrolling</Label>
                  <Switch
                    checked={localSettings.smoothScrolling}
                    onCheckedChange={(checked) =>
                      setLocalSettings((s) => ({ ...s, smoothScrolling: checked }))
                    }
                  />
                </div>

                <div className="flex items-center justify-between">
                  <Label>Mouse Wheel Zoom</Label>
                  <Switch
                    checked={localSettings.mouseWheelZoom}
                    onCheckedChange={(checked) =>
                      setLocalSettings((s) => ({ ...s, mouseWheelZoom: checked }))
                    }
                  />
                </div>

                <div className="flex items-center justify-between">
                  <Label>Linked Editing</Label>
                  <Switch
                    checked={localSettings.linkedEditing}
                    onCheckedChange={(checked) =>
                      setLocalSettings((s) => ({ ...s, linkedEditing: checked }))
                    }
                  />
                </div>

                <div className="flex items-center justify-between">
                  <Label>Sticky Scroll</Label>
                  <Switch
                    checked={localSettings.stickyScroll}
                    onCheckedChange={(checked) =>
                      setLocalSettings((s) => ({ ...s, stickyScroll: checked }))
                    }
                  />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="advanced" className="space-y-4">
              <div className="grid gap-3">
                <div className="flex items-center justify-between">
                  <Label>Bracket Pair Colorization</Label>
                  <Switch
                    checked={localSettings.bracketPairColorization}
                    onCheckedChange={(checked) =>
                      setLocalSettings((s) => ({ ...s, bracketPairColorization: checked }))
                    }
                  />
                </div>

                <div className="flex items-center justify-between">
                  <Label>Code Lens</Label>
                  <Switch
                    checked={localSettings.codeLens}
                    onCheckedChange={(checked) =>
                      setLocalSettings((s) => ({ ...s, codeLens: checked }))
                    }
                  />
                </div>

                <div className="flex items-center justify-between">
                  <Label>Inlay Hints</Label>
                  <Switch
                    checked={localSettings.inlayHints}
                    onCheckedChange={(checked) =>
                      setLocalSettings((s) => ({ ...s, inlayHints: checked }))
                    }
                  />
                </div>

                <div className="flex items-center justify-between">
                  <Label>Quick Suggestions</Label>
                  <Switch
                    checked={localSettings.quickSuggestions}
                    onCheckedChange={(checked) =>
                      setLocalSettings((s) => ({ ...s, quickSuggestions: checked }))
                    }
                  />
                </div>

                <div className="flex items-center justify-between">
                  <Label>Parameter Hints</Label>
                  <Switch
                    checked={localSettings.parameterHints}
                    onCheckedChange={(checked) =>
                      setLocalSettings((s) => ({ ...s, parameterHints: checked }))
                    }
                  />
                </div>

                <div className="grid gap-2">
                  <Label>Render Whitespace</Label>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" className="justify-between">
                        {localSettings.renderWhitespace}
                        <ChevronDown className="h-4 w-4 opacity-50" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {(["none", "boundary", "selection", "trailing", "all"] as const).map(
                        (opt) => (
                          <DropdownMenuItem
                            key={opt}
                            onClick={() =>
                              setLocalSettings((s) => ({ ...s, renderWhitespace: opt }))
                            }
                          >
                            {opt}
                          </DropdownMenuItem>
                        )
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                <div className="grid gap-2">
                  <Label>Match Brackets</Label>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" className="justify-between">
                        {localSettings.matchBrackets}
                        <ChevronDown className="h-4 w-4 opacity-50" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {(["never", "near", "always"] as const).map((opt) => (
                        <DropdownMenuItem
                          key={opt}
                          onClick={() =>
                            setLocalSettings((s) => ({ ...s, matchBrackets: opt }))
                          }
                        >
                          {opt}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                <div className="grid gap-2">
                  <Label>Rulers (comma separated)</Label>
                  <Input
                    value={localSettings.rulers.join(",")}
                    onChange={(e) => {
                      const vals = e.target.value
                        .split(",")
                        .map(Number)
                        .filter((n) => !isNaN(n) && n > 0);
                      setLocalSettings((s) => ({ ...s, rulers: vals }));
                    }}
                    placeholder="80,120"
                  />
                </div>
              </div>
            </TabsContent>
          </ScrollArea>
        </Tabs>

        <DialogFooter className="flex justify-between items-center border-t pt-4 mt-2">
          <Button variant="outline" onClick={handleReset}>
            <RotateCcw className="mr-2 h-4 w-4" /> Reset to Defaults
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave}>Apply</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// ----------------------------------------------------------------------
// Tab Bar Component (Enhanced)
// ----------------------------------------------------------------------

const TabBar: React.FC = memo(() => {
  const {
    openTabs,
    activeTab,
    setActiveTab,
    closeTab,
    closeOtherTabs,
    closeTabsToTheRight,
    closeAllTabs,
    pinTab,
    previewTab,
  } = useEditorContext();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [draggedTab, setDraggedTab] = useState<string | null>(null);

  useEffect(() => {
    if (activeTab) {
      const el = scrollRef.current?.querySelector(`[data-tab="${activeTab}"]`);
      el?.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "smooth" });
    }
  }, [activeTab]);

  const handleDragStart = (e: React.DragEvent, path: string) => {
    e.dataTransfer.setData("text/plain", path);
    setDraggedTab(path);
  };

  const handleDrop = (e: React.DragEvent, targetPath: string) => {
    e.preventDefault();
    const source = e.dataTransfer.getData("text/plain");
    if (source && source !== targetPath) {
      // Reorder tabs logic would go here
      toast.info("Tab reordering not implemented");
    }
    setDraggedTab(null);
  };

  if (openTabs.length === 0) return null;

  return (
    <div className="flex items-center border-b bg-muted/20 overflow-hidden">
      <div
        ref={scrollRef}
        className="flex-1 flex overflow-x-auto scrollbar-thin scrollbar-thumb-border"
        style={{ scrollbarWidth: "thin" }}
      >
        {openTabs.map((tab) => {
          const fileName = tab.path.split("/").pop() || tab.path;
          const isActive = activeTab === tab.path;
          const isPreview = tab.isPreview;

          return (
            <ContextMenu key={tab.path}>
              <ContextMenuTrigger asChild>
                <div
                  data-tab={tab.path}
                  draggable
                  onDragStart={(e) => handleDragStart(e, tab.path)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => handleDrop(e, tab.path)}
                  className={cn(
                    "group relative flex items-center gap-1.5 px-3 py-1.5 text-xs border-r cursor-pointer select-none transition-colors min-w-0 max-w-[180px]",
                    isActive
                      ? "bg-background text-foreground border-b-2 border-b-primary -mb-[1px]"
                      : "hover:bg-muted/50 text-muted-foreground",
                    tab.isPinned && "border-l-2 border-l-blue-500",
                    isPreview && "italic"
                  )}
                  onClick={() => setActiveTab(tab.path)}
                  onMouseDown={(e) => {
                    if (e.button === 1) {
                      e.preventDefault();
                      closeTab(tab.path);
                    }
                  }}
                >
                  {tab.isPinned && (
                    <Pin className="w-3 h-3 text-blue-500 shrink-0" />
                  )}
                  <span className="truncate flex-1">{fileName}</span>
                  {tab.isDirty && (
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
                  )}
                  <button
                    className={cn(
                      "ml-0.5 h-4 w-4 rounded flex items-center justify-center shrink-0 transition-opacity",
                      "hover:bg-muted text-muted-foreground hover:text-foreground",
                      tab.isDirty ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                    )}
                    onClick={(e) => {
                      e.stopPropagation();
                      closeTab(tab.path);
                    }}
                  >
                    <X className="w-2.5 h-2.5" />
                  </button>
                </div>
              </ContextMenuTrigger>
              <ContextMenuContent className="w-48 text-xs">
                <ContextMenuItem onClick={() => setActiveTab(tab.path)}>
                  Switch to Tab
                </ContextMenuItem>
                <ContextMenuItem onClick={() => closeTab(tab.path)}>
                  <X className="mr-2 h-3.5 w-3.5" /> Close
                </ContextMenuItem>
                <ContextMenuItem onClick={() => closeOtherTabs(tab.path)}>
                  Close Others
                </ContextMenuItem>
                <ContextMenuItem onClick={() => closeTabsToTheRight(tab.path)}>
                  Close to the Right
                </ContextMenuItem>
                <ContextMenuItem onClick={closeAllTabs}>
                  Close All
                </ContextMenuItem>
                <ContextMenuSep />
                <ContextMenuItem onClick={() => pinTab(tab.path)}>
                  {tab.isPinned ? (
                    <>
                      <PinOff className="mr-2 h-3.5 w-3.5" /> Unpin
                    </>
                  ) : (
                    <>
                      <Pin className="mr-2 h-3.5 w-3.5" /> Pin
                    </>
                  )}
                </ContextMenuItem>
                <ContextMenuItem onClick={() => previewTab(tab.path)}>
                  {tab.isPreview ? "Keep Open" : "Mark as Preview"}
                </ContextMenuItem>
                <ContextMenuSep />
                <ContextMenuItem
                  onClick={() => {
                    navigator.clipboard.writeText(tab.path);
                    toast.success("Path copied");
                  }}
                >
                  <Copy className="mr-2 h-3.5 w-3.5" /> Copy Path
                </ContextMenuItem>
                <ContextMenuItem
                  onClick={() => {
                    // Reveal in file explorer
                    const event = new CustomEvent("reveal-in-explorer", { detail: tab.path });
                    window.dispatchEvent(event);
                  }}
                >
                  <FolderOpen className="mr-2 h-3.5 w-3.5" /> Reveal in Explorer
                </ContextMenuItem>
              </ContextMenuContent>
            </ContextMenu>
          );
        })}
      </div>
      <div className="flex items-center px-1 border-l">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-7 w-7">
              <ChevronDown className="h-3.5 w-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48 text-xs">
            <DropdownMenuItem onClick={closeAllTabs}>
              Close All Tabs
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => closeOtherTabs(activeTab || "")}>
              Close Other Tabs
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => closeTabsToTheRight(activeTab || "")}>
              Close Tabs to the Right
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => {
              openTabs.filter(t => t.isPinned).forEach(t => closeTab(t.path));
            }}>
              Close All Pinned
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => {
              openTabs.filter(t => t.isPreview).forEach(t => closeTab(t.path));
            }}>
              Close All Preview
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
});
TabBar.displayName = "TabBar";

// ----------------------------------------------------------------------
// AI Assistant Panel
// ----------------------------------------------------------------------

const AIPanel: React.FC<{ isOpen: boolean; onClose: () => void }> = ({ isOpen, onClose }) => {
  const { editorInstance } = useEditorContext();
  const [prompt, setPrompt] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [conversation, setConversation] = useState<{ role: "user" | "assistant"; content: string }[]>([]);

  const handleSend = async () => {
    if (!prompt.trim() || !editorInstance) return;
    const userMsg = prompt;
    setConversation(prev => [...prev, { role: "user", content: userMsg }]);
    setPrompt("");
    setIsGenerating(true);
    // Simulate AI response
    setTimeout(() => {
      const selection = editorInstance.getSelection();
      const selectedText = selection ? editorInstance.getModel()?.getValueInRange(selection) : "";
      const response = `I can help you with that. ${
        selectedText ? `You have selected: "${selectedText.slice(0, 50)}..."` : ""
      }`;
      setConversation(prev => [...prev, { role: "assistant", content: response }]);
      setIsGenerating(false);
    }, 1500);
  };

  if (!isOpen) return null;

  return (
    <motion.div
      initial={{ width: 0, opacity: 0 }}
      animate={{ width: 350, opacity: 1 }}
      exit={{ width: 0, opacity: 0 }}
      className="border-l border-border bg-background flex flex-col"
    >
      <div className="flex items-center justify-between px-3 py-2 border-b">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-purple-500" />
          <span className="text-sm font-medium">AI Assistant</span>
        </div>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onClose}>
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>
      <ScrollArea className="flex-1 p-3">
        <div className="space-y-3">
          {conversation.length === 0 && (
            <div className="text-center text-muted-foreground text-sm py-8">
              Ask me anything about your code.
            </div>
          )}
          {conversation.map((msg, i) => (
            <div
              key={i}
              className={cn(
                "p-2 rounded-lg text-sm",
                msg.role === "user"
                  ? "bg-primary/10 ml-8"
                  : "bg-muted mr-8"
              )}
            >
              {msg.content}
            </div>
          ))}
          {isGenerating && (
            <div className="bg-muted p-2 rounded-lg text-sm mr-8 animate-pulse">
              Thinking...
            </div>
          )}
        </div>
      </ScrollArea>
      <div className="p-3 border-t">
        <div className="flex gap-2">
          <Textarea
            placeholder="Ask a question or give an instruction..."
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            className="min-h-[60px] text-sm"
          />
          <Button size="icon" className="h-auto" onClick={handleSend} disabled={isGenerating}>
            <ArrowUp className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </motion.div>
  );
};

// ----------------------------------------------------------------------
// Terminal Panel (Simplified)
// ----------------------------------------------------------------------

const TerminalPanel: React.FC<{ isOpen: boolean; onClose: () => void }> = ({ isOpen, onClose }) => {
  const [commands, setCommands] = useState<string[]>([]);
  const [input, setInput] = useState("");

  const handleCommand = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && input.trim()) {
      setCommands(prev => [...prev, `$ ${input}`]);
      // Simulate command execution
      setTimeout(() => {
        setCommands(prev => [...prev, `Command not found: ${input.split(" ")[0]}`]);
      }, 100);
      setInput("");
    }
  };

  if (!isOpen) return null;

  return (
    <motion.div
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: 200, opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
      className="border-t border-border bg-background flex flex-col"
    >
      <div className="flex items-center justify-between px-3 py-1 border-b">
        <div className="flex items-center gap-2">
          <Terminal className="h-4 w-4" />
          <span className="text-xs font-medium">Terminal</span>
        </div>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onClose}>
          <X className="h-3 w-3" />
        </Button>
      </div>
      <ScrollArea className="flex-1 p-2 font-mono text-xs">
        {commands.map((cmd, i) => (
          <div key={i} className="whitespace-pre-wrap">
            {cmd}
          </div>
        ))}
        <div className="flex items-center">
          <span className="text-green-500 mr-1">$</span>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleCommand}
            className="flex-1 bg-transparent outline-none"
            autoFocus
          />
        </div>
      </ScrollArea>
    </motion.div>
  );
};

// ----------------------------------------------------------------------
// Status Bar
// ----------------------------------------------------------------------

const StatusBar: React.FC = () => {
  const { editorInstance, settings, openTabs, activeTab } = useEditorContext();
  const [position, setPosition] = useState({ line: 1, column: 1 });
  const [language, setLanguage] = useState("plaintext");
  const [selectionLength, setSelectionLength] = useState(0);

  useEffect(() => {
    if (!editorInstance) return;
    const updateStatus = () => {
      const pos = editorInstance.getPosition();
      if (pos) setPosition({ line: pos.lineNumber, column: pos.column });
      const model = editorInstance.getModel();
      if (model) setLanguage(model.getLanguageId());
      const selection = editorInstance.getSelection();
      if (selection && !selection.isEmpty()) {
        const text = model?.getValueInRange(selection) || "";
        setSelectionLength(text.length);
      } else {
        setSelectionLength(0);
      }
    };
    updateStatus();
    const disposable = editorInstance.onDidChangeCursorPosition(updateStatus);
    const disposable2 = editorInstance.onDidChangeModel(updateStatus);
    const disposable3 = editorInstance.onDidChangeCursorSelection(updateStatus);
    return () => {
      disposable.dispose();
      disposable2.dispose();
      disposable3.dispose();
    };
  }, [editorInstance]);

  const totalLines = editorInstance?.getModel()?.getLineCount() || 0;

  return (
    <div className="flex items-center justify-between px-3 py-0.5 border-t text-[11px] text-muted-foreground bg-muted/10">
      <div className="flex items-center gap-4">
        <span>Ln {position.line}, Col {position.column}</span>
        {selectionLength > 0 && (
          <span>{selectionLength} selected</span>
        )}
        <span>{totalLines} lines</span>
        <span className="capitalize">{language}</span>
      </div>
      <div className="flex items-center gap-4">
        <span>{settings.tabSize} spaces</span>
        <span>UTF-8</span>
        <span>{settings.theme}</span>
        <span className="flex items-center gap-1">
          <GitBranch className="h-3 w-3" />
          main
        </span>
      </div>
    </div>
  );
};

// ----------------------------------------------------------------------
// Split Editor View
// ----------------------------------------------------------------------

const SplitEditor: React.FC<{ enabled: boolean }> = ({ enabled }) => {
  const { activeTab, settings, editorInstance } = useEditorContext();
  const { files } = useAIBuilderStore();
  const [secondaryPath, setSecondaryPath] = useState<string | null>(null);

  if (!enabled || !activeTab) return null;

  const activeFile = files.find(f => f.path === activeTab);
  const secondaryFile = secondaryPath ? files.find(f => f.path === secondaryPath) : null;

  return (
    <div className="flex-1 flex">
      {/* Primary Editor (existing) */}
      <div className="flex-1 border-r">
        {/* Rendered by main component */}
      </div>
      {/* Secondary Editor */}
      <div className="flex-1 flex flex-col">
        <div className="flex items-center gap-1 px-2 py-1 border-b bg-muted/20">
          <select
            className="text-xs bg-transparent border rounded px-2 py-0.5"
            value={secondaryPath || ""}
            onChange={(e) => setSecondaryPath(e.target.value)}
          >
            <option value="">Select file...</option>
            {files.map(f => (
              <option key={f.path} value={f.path}>{f.path.split("/").pop()}</option>
            ))}
          </select>
          <Button variant="ghost" size="icon" className="h-6 w-6 ml-auto" onClick={() => setSecondaryPath(null)}>
            <X className="h-3 w-3" />
          </Button>
        </div>
        {secondaryFile ? (
          <MonacoEditorLib
            height="100%"
            language={getLanguageFromPath(secondaryPath!)}
            theme={settings.theme}
            value={secondaryFile.content}
            options={transformEditorSettings({ ...settings, readOnly: true })}
          />
        ) : (
          <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
            Select a file to compare
          </div>
        )}
      </div>
    </div>
  );
};

// Transform EditorSettings to Monaco-compatible options
function transformEditorSettings(settings: any): any {
  const monacoOptions: any = {
    fontSize: settings.fontSize,
    wordWrap: settings.wordWrap,
    lineNumbers: settings.lineNumbers,
    theme: settings.theme,
    tabSize: settings.tabSize,
    renderWhitespace: settings.renderWhitespace,
    bracketPairColorization: { enabled: settings.bracketPairColorization },
    fontFamily: settings.fontFamily,
    fontLigatures: settings.fontLigatures,
    cursorStyle: settings.cursorStyle,
    cursorBlinking: settings.cursorBlinking,
    smoothScrolling: settings.smoothScrolling,
    mouseWheelZoom: settings.mouseWheelZoom,
    showFoldingControls: settings.showFoldingControls,
    parameterHints: { enabled: settings.parameterHints },
    quickSuggestions: settings.quickSuggestions,
    formatOnSave: settings.formatOnSave,
    formatOnPaste: settings.formatOnPaste,
    linkedEditing: settings.linkedEditing,
    rulers: settings.rulers,
    codeLens: settings.codeLens,
    renderLineHighlight: settings.renderLineHighlight,
    matchBrackets: settings.matchBrackets,
  };
  
  if (settings.minimap !== undefined) {
    monacoOptions.minimap = settings.minimap ? { enabled: true } : { enabled: false };
  }
  
  if (settings.stickyScroll !== undefined) {
    monacoOptions.stickyScroll = settings.stickyScroll ? { enabled: true } : { enabled: false };
  }
  
  if (settings.inlayHints !== undefined) {
    monacoOptions.inlayHints = { enabled: settings.inlayHints ? "on" : "off" };
  }
  
  if (settings.lightbulb !== undefined) {
    monacoOptions.lightbulb = { enabled: settings.lightbulb ? "on" : "off" };
  }
  
  if (settings.autoSave !== undefined) {
    monacoOptions.autoSave = settings.autoSave ? "afterDelay" : "off";
    if (settings.autoSaveDelay !== undefined) {
      monacoOptions.autoSaveDelay = settings.autoSaveDelay;
    }
  }
  
  if (settings.readOnly !== undefined) {
    monacoOptions.readOnly = settings.readOnly;
  }
  
  return monacoOptions;
}

// ----------------------------------------------------------------------
// Main Editor Component
// ----------------------------------------------------------------------

const MonacoEditor: React.FC = () => {
  const { files, activeFilePath, updateFile } = useAIBuilderStore();
  const { resolvedTheme } = useTheme();
  const editorRef = useRef<monacoModule.editor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<typeof monacoModule | null>(null);
  const [editorMounted, setEditorMounted] = useState(false);
  const [monacoLoadError, setMonacoLoadError] = useState(false);

  // State
  const [settings, setSettings] = useState<EditorSettings>(loadSettings);
  const [openTabs, setOpenTabs] = useState<EditorTab[]>([]);
  const [searchState, setSearchState] = useState<SearchState>({
    query: "",
    replaceWith: "",
    isRegex: false,
    matchCase: false,
    wholeWord: false,
    preserveCase: false,
    isSearchOpen: false,
    isReplaceOpen: false,
    resultsCount: 0,
    currentResultIndex: 0,
  });
  const [isAIPanelOpen, setIsAIPanelOpen] = useState(false);
  const [isTerminalOpen, setIsTerminalOpen] = useState(false);
  const [splitViewEnabled, setSplitViewEnabled] = useState(false);

  const updateSettings = useCallback((partial: Partial<EditorSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...partial };
      saveSettings(next);
      if (editorRef.current) {
        editorRef.current.updateOptions(transformEditorSettings(next));
      }
      return next;
    });
  }, []);

  // Tabs management
  const activeTab = activeFilePath;

  const setActiveTab = useCallback((path: string) => {
    // This would be handled by store; for now just update internal state
    // Actually we rely on the store's setActiveFile
    const store = useAIBuilderStore.getState();
    store.setActiveFile(path);
  }, []);

  const closeTab = useCallback((path: string) => {
    setOpenTabs((prev) => {
      const idx = prev.findIndex((t) => t.path === path);
      const next = prev.filter((t) => t.path !== path);
      if (activeFilePath === path && next.length > 0) {
        const newActive = next[Math.min(idx, next.length - 1)].path;
        setActiveTab(newActive);
      }
      return next;
    });
  }, [activeFilePath, setActiveTab]);

  const closeOtherTabs = useCallback((path: string) => {
    setOpenTabs((prev) => prev.filter((t) => t.path === path));
  }, []);

  const closeTabsToTheRight = useCallback((path: string) => {
    setOpenTabs((prev) => {
      const idx = prev.findIndex((t) => t.path === path);
      if (idx === -1) return prev;
      return prev.slice(0, idx + 1);
    });
  }, []);

  const closeAllTabs = useCallback(() => {
    setOpenTabs([]);
  }, []);

  const pinTab = useCallback((path: string) => {
    setOpenTabs((prev) =>
      prev.map((t) => (t.path === path ? { ...t, isPinned: !t.isPinned } : t))
    );
  }, []);

  const previewTab = useCallback((path: string) => {
    setOpenTabs((prev) =>
      prev.map((t) => (t.path === path ? { ...t, isPreview: !t.isPreview } : t))
    );
  }, []);

  // Effect to sync tabs with active file from store
  useEffect(() => {
    if (activeFilePath) {
      setOpenTabs((prev) => {
        const existing = prev.find((t) => t.path === activeFilePath);
        if (existing) return prev;
        return [
          ...prev,
          {
            path: activeFilePath,
            isDirty: false,
            isPinned: false,
            isPreview: false,
            lastAccessed: Date.now(),
          },
        ];
      });
    }
  }, [activeFilePath]);

  // Active file data
  const activeFile = useMemo(
    () => files.find((f) => f.path === activeFilePath),
    [files, activeFilePath]
  );

  const language = useMemo(
    () => (activeFilePath ? getLanguageFromPath(activeFilePath) : "plaintext"),
    [activeFilePath]
  );

  const editorTheme = useMemo(() => {
    if (settings.theme !== "vs-dark") return settings.theme;
    return resolvedTheme === "dark" ? "vs-dark" : "light";
  }, [settings.theme, resolvedTheme]);

  // Debounced save
  const debouncedSave = useDebouncedSave(
    (value: string) => {
      if (activeFilePath) {
        updateFile(activeFilePath, value);
        setOpenTabs((prev) =>
          prev.map((t) => (t.path === activeFilePath ? { ...t, isDirty: false } : t))
        );
        toast.info("Auto-saved", { duration: 1000 });
      }
    },
    settings.autoSaveDelay,
    settings.autoSave
  );

  // Manual save
  const handleManualSave = useCallback(() => {
    if (!activeFilePath || !editorRef.current) return;
    const content = editorRef.current.getValue();
    updateFile(activeFilePath, content);
    setOpenTabs((prev) =>
      prev.map((t) => (t.path === activeFilePath ? { ...t, isDirty: false } : t))
    );
    toast.success("Saved");
  }, [activeFilePath, updateFile]);

  // Sync external file changes
  useEffect(() => {
    if (editorRef.current && activeFile) {
      const model = editorRef.current.getModel();
      if (model && model.getValue() !== activeFile.content) {
        model.setValue(activeFile.content);
        setOpenTabs((prev) =>
          prev.map((t) => (t.path === activeFile.path ? { ...t, isDirty: false } : t))
        );
      }
    }
  }, [activeFile?.content]);

  // Editor mount handler
  const handleEditorDidMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;
    setEditorMounted(true);

    // Apply settings
    editor.updateOptions(transformEditorSettings(settings));

    // Register commands
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, handleManualSave);

    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyP, () => {
      // Quick open - could integrate with a command palette
      toast.info("Command palette (Cmd+Shift+P)");
    });

    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyP, () => {
      // Quick file open - could integrate with file explorer search
      document.dispatchEvent(new CustomEvent("focus-file-search"));
    });

    // Add custom completion provider for AI
    monaco.languages.registerCompletionItemProvider(language, {
      provideCompletionItems: (model: any, position: any) => {
        // AI-powered suggestions placeholder
        return { suggestions: [] };
      },
    });

    // Configure TS/JS defaults
    monaco.languages.typescript.typescriptDefaults.setCompilerOptions({
      target: monaco.languages.typescript.ScriptTarget.ES2020,
      allowNonTsExtensions: true,
      moduleResolution: monaco.languages.typescript.ModuleResolutionKind.NodeJs,
      module: monaco.languages.typescript.ModuleKind.ESNext,
      noEmit: true,
      esModuleInterop: true,
      jsx: monaco.languages.typescript.JsxEmit.React,
      allowJs: true,
      typeRoots: ["node_modules/@types"],
    });

    monaco.languages.typescript.typescriptDefaults.setEagerModelSync(true);
    monaco.languages.typescript.javascriptDefaults.setEagerModelSync(true);
  };

  const handleChange: OnChange = (value) => {
    if (value === undefined || !activeFilePath) return;
    const isDirty = value !== (activeFile?.content || "");
    setOpenTabs((prev) =>
      prev.map((t) => (t.path === activeFilePath ? { ...t, isDirty } : t))
    );
    if (settings.autoSave) {
      debouncedSave(value);
    }
  };

  const handleEditorError = (error: unknown) => {
    console.error("Monaco load error:", error);
    setMonacoLoadError(true);
  };

  // Fallback timeout
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (!editorMounted) setMonacoLoadError(true);
    }, 8000);
    return () => clearTimeout(timeout);
  }, [editorMounted]);

  // Context value
  const contextValue: EditorContextValue = {
    settings,
    updateSettings,
    openTabs,
    activeTab,
    setActiveTab,
    closeTab,
    closeAllTabs,
    closeOtherTabs,
    closeTabsToTheRight,
    pinTab,
    previewTab,
    searchState,
    setSearchState,
    editorInstance: editorRef.current,
    monacoInstance: monacoRef.current,
    isAIPanelOpen,
    setIsAIPanelOpen,
    isTerminalOpen,
    setIsTerminalOpen,
    splitViewEnabled,
    setSplitViewEnabled,
  };

  // Render no file selected
  if (!activeFile) {
    return (
      <div className="h-full flex flex-col">
        <div className="p-3 border-b text-sm font-medium flex items-center justify-between bg-muted/20">
          <span>Code Editor</span>
          <span className="text-xs text-muted-foreground">No file selected</span>
        </div>
        <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
          Generate a project and select a file to start editing.
        </div>
      </div>
    );
  }

  // Fallback textarea
  if (monacoLoadError) {
    return (
      <div className="h-full flex flex-col">
        <div className="p-3 border-b text-sm font-medium flex items-center justify-between bg-muted/20">
          <span>Code Editor (fallback)</span>
          <span className="text-xs text-muted-foreground font-mono">{activeFilePath}</span>
        </div>
        <div className="flex-1 p-3">
          <textarea
            className="w-full h-full rounded-md border bg-background p-3 text-xs font-mono outline-none resize-none"
            value={activeFile.content}
            onChange={(e) => updateFile(activeFilePath || "", e.target.value)}
          />
        </div>
      </div>
    );
  }

  return (
    <EditorContext.Provider value={contextValue}>
      <TooltipProvider>
        <div className="h-full flex flex-col overflow-hidden">
          {/* Tab Bar */}
          <TabBar />

          {/* Toolbar */}
          <EditorToolbar />

          {/* Main Content Area */}
          <div className="flex-1 flex min-h-0">
            {/* Editor Area (and split view) */}
            <div className="flex-1 flex flex-col min-w-0">
              {splitViewEnabled ? (
                <SplitEditor enabled={splitViewEnabled} />
              ) : (
                <div className="flex-1 relative">
                  <MonacoEditorLib
                    height="100%"
                    language={language}
                    theme={editorTheme}
                    value={activeFile.content}
                    onChange={handleChange}
                    onMount={handleEditorDidMount}
                    options={{
                      fontSize: settings.fontSize,
                      fontFamily: settings.fontFamily,
                      fontLigatures: settings.fontLigatures,
                      lineHeight: 1.6,
                      wordWrap: settings.wordWrap,
                      minimap: { enabled: settings.minimap },
                      lineNumbers: settings.lineNumbers,
                      glyphMargin: true,
                      folding: true,
                      showFoldingControls: settings.showFoldingControls,
                      tabSize: settings.tabSize,
                      insertSpaces: true,
                      detectIndentation: true,
                      cursorStyle: settings.cursorStyle,
                      cursorBlinking: settings.cursorBlinking,
                      autoIndent: "full",
                      formatOnPaste: settings.formatOnPaste,
                      formatOnType: true,
                      renderWhitespace: settings.renderWhitespace,
                      renderControlCharacters: true,
                      renderLineHighlight: settings.renderLineHighlight,
                      scrollbar: { vertical: "visible", horizontal: "visible", verticalScrollbarSize: 12, horizontalScrollbarSize: 12 },
                      autoClosingBrackets: "always",
                      autoClosingQuotes: "always",
                      autoSurround: "languageDefined",
                      acceptSuggestionOnCommitCharacter: true,
                      acceptSuggestionOnEnter: "on",
                      quickSuggestions: settings.quickSuggestions ? { other: true, comments: true, strings: true } : false,
                      suggestOnTriggerCharacters: true,
                      snippetSuggestions: "top",
                      bracketPairColorization: { enabled: settings.bracketPairColorization },
                      smoothScrolling: settings.smoothScrolling,
                      mouseWheelZoom: settings.mouseWheelZoom,
                      links: true,
                      contextmenu: true,
                      multiCursorModifier: "alt",
                      automaticLayout: true,
                      scrollBeyondLastLine: false,
                      fixedOverflowWidgets: true,
                      stickyScroll: { enabled: settings.stickyScroll },
                      parameterHints: { enabled: settings.parameterHints },
                      inlayHints: { enabled: settings.inlayHints ? "on" : "off" },
                      codeLens: settings.codeLens,
                      matchBrackets: settings.matchBrackets,
                      rulers: settings.rulers,
                      linkedEditing: settings.linkedEditing,
                    }}
                    loading={
                      <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
                        Loading editor...
                      </div>
                    }
                  />
                </div>
              )}
              {/* Status Bar */}
              <StatusBar />
            </div>

            {/* AI Panel */}
            <AnimatePresence>
              {isAIPanelOpen && (
                <AIPanel isOpen={isAIPanelOpen} onClose={() => setIsAIPanelOpen(false)} />
              )}
            </AnimatePresence>
          </div>

          {/* Terminal Panel */}
          <AnimatePresence>
            {isTerminalOpen && (
              <TerminalPanel isOpen={isTerminalOpen} onClose={() => setIsTerminalOpen(false)} />
            )}
          </AnimatePresence>
        </div>
      </TooltipProvider>
    </EditorContext.Provider>
  );
};

export default MonacoEditor;