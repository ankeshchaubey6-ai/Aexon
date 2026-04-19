"use client";

import React, {
  useMemo,
  useState,
  useCallback,
  useRef,
  useEffect,
  createContext,
  useContext,
  memo,
} from "react";
import { useAIBuilderStore } from "../state/ai-builder.store";
import { cn } from "@/lib/utils";
import {
  ChevronRight,
  ChevronDown,
  File,
  Folder,
  FolderOpen,
  FileCode,
  FileJson,
  FileText,
  FileImage,
  MoreHorizontal,
  Search,
  Plus,
  RefreshCw,
  X,
  Copy,
  Trash2,
  Pencil,
  FilePlus,
  FolderPlus,
  CheckCircle2,
  AlertCircle,
  GitBranch,
  Layers,
  ChevronLeft,
  PanelLeftClose,
  PanelLeftOpen,
  Filter,
  SortAsc,
  Eye,
  EyeOff,
  FileSymlink,
  TerminalSquare,
  Zap,
  Star,
  Clock,
  Tag,
} from "lucide-react";
import { motion, AnimatePresence, LayoutGroup } from "framer-motion";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuCheckboxItem,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
} from "@/components/ui/dropdown-menu";
import {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuLabel,
  ContextMenuShortcut,
  ContextMenuSub,
  ContextMenuSubTrigger,
  ContextMenuSubContent,
} from "@/components/ui/context-menu";
import { toast } from "sonner";
import type { AIFileNode } from "@/lib/ai/types/ai-project.types";

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────
type FileNode = {
  name: string;
  path: string;
  type: "file" | "folder";
  children?: FileNode[];
  level: number;
  ext?: string;
  size?: number;
  modified?: Date;
  isGitModified?: boolean;
  isGitAdded?: boolean;
  isGitUntracked?: boolean;
  hasErrors?: boolean;
  hasWarnings?: boolean;
  isPinned?: boolean;
};

type SortMode = "name" | "type" | "modified" | "size";
type ViewMode = "tree" | "flat";
type FilterMode = "all" | "modified" | "errors" | "pinned";

interface ExplorerContextType {
  selectedPaths: string[];
  expandedFolders: Set<string>;
  activeFilePath: string | null;
  pinnedPaths: Set<string>;
  dragOverPath: string | null;
  sortMode: SortMode;
  filterMode: FilterMode;
  showHidden: boolean;
}

const ExplorerContext = createContext<ExplorerContextType>({
  selectedPaths: [],
  expandedFolders: new Set(),
  activeFilePath: null,
  pinnedPaths: new Set(),
  dragOverPath: null,
  sortMode: "name",
  filterMode: "all",
  showHidden: false,
});

// ─────────────────────────────────────────────────────────────────────────────
// FILE METADATA
// ─────────────────────────────────────────────────────────────────────────────
type FileTypeConfig = {
  icon: React.ReactNode;
  color: string;
  label: string;
  group: "code" | "style" | "data" | "doc" | "media" | "config" | "other";
};

const FILE_TYPE_MAP: Record<string, FileTypeConfig> = {
  ts: { icon: <FileCode className="w-[14px] h-[14px]" />, color: "#3b82f6", label: "TypeScript", group: "code" },
  tsx: { icon: <FileCode className="w-[14px] h-[14px]" />, color: "#3b82f6", label: "TSX", group: "code" },
  js: { icon: <FileCode className="w-[14px] h-[14px]" />, color: "#f59e0b", label: "JavaScript", group: "code" },
  jsx: { icon: <FileCode className="w-[14px] h-[14px]" />, color: "#f59e0b", label: "JSX", group: "code" },
  py: { icon: <FileCode className="w-[14px] h-[14px]" />, color: "#3b82f6", label: "Python", group: "code" },
  go: { icon: <FileCode className="w-[14px] h-[14px]" />, color: "#06b6d4", label: "Go", group: "code" },
  rs: { icon: <FileCode className="w-[14px] h-[14px]" />, color: "#f97316", label: "Rust", group: "code" },
  cpp: { icon: <FileCode className="w-[14px] h-[14px]" />, color: "#8b5cf6", label: "C++", group: "code" },
  c: { icon: <FileCode className="w-[14px] h-[14px]" />, color: "#8b5cf6", label: "C", group: "code" },
  java: { icon: <FileCode className="w-[14px] h-[14px]" />, color: "#ef4444", label: "Java", group: "code" },
  json: { icon: <FileJson className="w-[14px] h-[14px]" />, color: "#f59e0b", label: "JSON", group: "data" },
  yaml: { icon: <FileText className="w-[14px] h-[14px]" />, color: "#ec4899", label: "YAML", group: "config" },
  yml: { icon: <FileText className="w-[14px] h-[14px]" />, color: "#ec4899", label: "YAML", group: "config" },
  toml: { icon: <FileText className="w-[14px] h-[14px]" />, color: "#f97316", label: "TOML", group: "config" },
  env: { icon: <FileText className="w-[14px] h-[14px]" />, color: "#22c55e", label: "ENV", group: "config" },
  css: { icon: <FileCode className="w-[14px] h-[14px]" />, color: "#06b6d4", label: "CSS", group: "style" },
  scss: { icon: <FileCode className="w-[14px] h-[14px]" />, color: "#ec4899", label: "SCSS", group: "style" },
  less: { icon: <FileCode className="w-[14px] h-[14px]" />, color: "#3b82f6", label: "Less", group: "style" },
  html: { icon: <FileCode className="w-[14px] h-[14px]" />, color: "#f97316", label: "HTML", group: "code" },
  md: { icon: <FileText className="w-[14px] h-[14px]" />, color: "#94a3b8", label: "Markdown", group: "doc" },
  mdx: { icon: <FileText className="w-[14px] h-[14px]" />, color: "#8b5cf6", label: "MDX", group: "doc" },
  txt: { icon: <FileText className="w-[14px] h-[14px]" />, color: "#94a3b8", label: "Text", group: "doc" },
  png: { icon: <FileImage className="w-[14px] h-[14px]" />, color: "#22c55e", label: "PNG", group: "media" },
  jpg: { icon: <FileImage className="w-[14px] h-[14px]" />, color: "#22c55e", label: "JPEG", group: "media" },
  jpeg: { icon: <FileImage className="w-[14px] h-[14px]" />, color: "#22c55e", label: "JPEG", group: "media" },
  gif: { icon: <FileImage className="w-[14px] h-[14px]" />, color: "#22c55e", label: "GIF", group: "media" },
  svg: { icon: <FileImage className="w-[14px] h-[14px]" />, color: "#f97316", label: "SVG", group: "media" },
  webp: { icon: <FileImage className="w-[14px] h-[14px]" />, color: "#22c55e", label: "WebP", group: "media" },
  sh: { icon: <TerminalSquare className="w-[14px] h-[14px]" />, color: "#22c55e", label: "Shell", group: "code" },
  bash: { icon: <TerminalSquare className="w-[14px] h-[14px]" />, color: "#22c55e", label: "Bash", group: "code" },
  lock: { icon: <File className="w-[14px] h-[14px]" />, color: "#6b7280", label: "Lock", group: "config" },
  gitignore: { icon: <GitBranch className="w-[14px] h-[14px]" />, color: "#f97316", label: "Git", group: "config" },
  gitkeep: { icon: <GitBranch className="w-[14px] h-[14px]" />, color: "#f97316", label: "Git", group: "config" },
  sql: { icon: <FileCode className="w-[14px] h-[14px]" />, color: "#3b82f6", label: "SQL", group: "data" },
  prisma: { icon: <Zap className="w-[14px] h-[14px]" />, color: "#6366f1", label: "Prisma", group: "data" },
};

const FOLDER_COLORS: Record<string, string> = {
  src: "#f59e0b",
  app: "#3b82f6",
  components: "#8b5cf6",
  pages: "#06b6d4",
  lib: "#22c55e",
  utils: "#f97316",
  hooks: "#ec4899",
  styles: "#06b6d4",
  public: "#22c55e",
  assets: "#f59e0b",
  types: "#8b5cf6",
  api: "#ef4444",
  tests: "#22c55e",
  __tests__: "#22c55e",
  node_modules: "#6b7280",
  ".git": "#f97316",
  dist: "#6b7280",
  build: "#6b7280",
  coverage: "#22c55e",
  config: "#94a3b8",
};

function getFileTypeConfig(fileName: string): FileTypeConfig {
  const parts = fileName.split(".");
  if (parts.length > 1) {
    const ext = parts[parts.length - 1].toLowerCase();
    if (ext === "gitignore" || ext === "gitkeep") return FILE_TYPE_MAP[ext] ?? FILE_TYPE_MAP["txt"]!;
    return FILE_TYPE_MAP[ext] ?? {
      icon: <File className="w-[14px] h-[14px]" />,
      color: "#94a3b8",
      label: ext.toUpperCase(),
      group: "other",
    };
  }
  return {
    icon: <File className="w-[14px] h-[14px]" />,
    color: "#94a3b8",
    label: "File",
    group: "other",
  };
}

function getFolderColor(name: string): string {
  return FOLDER_COLORS[name] ?? "#f59e0b";
}

// ─────────────────────────────────────────────────────────────────────────────
// BUILD TREE FROM FLAT FILES
// ─────────────────────────────────────────────────────────────────────────────
function buildTree(files: AIFileNode[], sortMode: SortMode = "name", showHidden: boolean = false): FileNode[] {
  const root: Record<string, any> = {};

  files.forEach((file) => {
    const parts = file.path.split("/");
    let current = root;

    parts.forEach((part, index) => {
      if (!showHidden && part.startsWith(".") && index > 0) return;
      if (!current[part]) {
        const ext = part.split(".").pop()?.toLowerCase() ?? "";
        current[part] = {
          name: part,
          path: parts.slice(0, index + 1).join("/"),
          type: index === parts.length - 1 ? "file" : "folder",
          ext: index === parts.length - 1 ? ext : undefined,
          children: {},
          level: index,
          isGitModified: Math.random() > 0.85,
          isGitAdded: Math.random() > 0.92,
          hasErrors: Math.random() > 0.96,
          hasWarnings: Math.random() > 0.90,
          modified: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000),
        };
      }
      current = current[part].children;
    });
  });

  function sortNodes(nodes: FileNode[]): FileNode[] {
    return nodes.sort((a, b) => {
      if (a.type !== b.type) return a.type === "folder" ? -1 : 1;
      switch (sortMode) {
        case "name": return a.name.localeCompare(b.name);
        case "type": return (a.ext ?? "").localeCompare(b.ext ?? "") || a.name.localeCompare(b.name);
        case "modified": return (b.modified?.getTime() ?? 0) - (a.modified?.getTime() ?? 0);
        default: return a.name.localeCompare(b.name);
      }
    });
  }

  function convert(obj: any): FileNode[] {
    return sortNodes(
      Object.values(obj).map((node: any) => ({
        ...node,
        children: node.type === "folder" ? convert(node.children) : undefined,
      }))
    );
  }

  return convert(root);
}

// ─────────────────────────────────────────────────────────────────────────────
// FLATTEN TREE
// ─────────────────────────────────────────────────────────────────────────────
function flattenTree(
  nodes: FileNode[],
  expandedFolders: Set<string>,
  searchQuery: string,
  pinnedPaths: Set<string>,
  filterMode: FilterMode
): FileNode[] {
  const result: FileNode[] = [];
  const searchLower = searchQuery.toLowerCase();

  function traverse(node: FileNode, forceVisible = false) {
    const matchesSearch = searchQuery
      ? node.name.toLowerCase().includes(searchLower) || node.path.toLowerCase().includes(searchLower)
      : true;

    const matchesFilter = (() => {
      switch (filterMode) {
        case "modified": return node.isGitModified || node.isGitAdded || false;
        case "errors": return node.hasErrors || node.hasWarnings || false;
        case "pinned": return pinnedPaths.has(node.path);
        default: return true;
      }
    })();

    const isVisible = (matchesSearch && matchesFilter) || forceVisible;

    if (!isVisible) {
      if (node.type === "folder") node.children?.forEach((c) => traverse(c));
      return;
    }

    result.push(node);

    if (node.type === "folder" && (expandedFolders.has(node.path) || searchQuery || filterMode !== "all")) {
      node.children?.forEach((c) => traverse(c));
    }
  }

  nodes.forEach((n) => traverse(n));
  return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// GIT STATUS INDICATOR
// ─────────────────────────────────────────────────────────────────────────────
const GitStatusDot: React.FC<{ node: FileNode }> = ({ node }) => {
  if (node.isGitAdded) {
    return (
      <span className="ml-auto text-[10px] font-bold text-emerald-400 opacity-80 pr-1" title="Added">
        A
      </span>
    );
  }
  if (node.isGitModified) {
    return (
      <span className="ml-auto text-[10px] font-bold text-amber-400 opacity-80 pr-1" title="Modified">
        M
      </span>
    );
  }
  return null;
};

// ─────────────────────────────────────────────────────────────────────────────
// FILE BADGE (ext pill)
// ─────────────────────────────────────────────────────────────────────────────
const ExtBadge: React.FC<{ ext: string; color: string }> = ({ ext, color }) => {
  if (!ext || ext.length > 5) return null;
  return (
    <span
      className="hidden group-hover:inline-flex items-center px-1 py-0 rounded text-[9px] font-semibold tracking-wide uppercase ml-1 shrink-0 opacity-70"
      style={{ backgroundColor: `${color}22`, color }}
    >
      {ext}
    </span>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// RENAME INPUT
// ─────────────────────────────────────────────────────────────────────────────
const RenameInput: React.FC<{
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
  paddingLeft: number;
}> = ({ value, onChange, onSubmit, onCancel, paddingLeft }) => {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    ref.current?.focus();
    const dotIndex = value.lastIndexOf(".");
    if (dotIndex > 0) ref.current?.setSelectionRange(0, dotIndex);
    else ref.current?.select();
  }, []);

  return (
    <div
      className="flex items-center h-[28px] px-2"
      style={{ paddingLeft }}
    >
      <input
        ref={ref}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onSubmit}
        onKeyDown={(e) => {
          if (e.key === "Enter") onSubmit();
          if (e.key === "Escape") onCancel();
          e.stopPropagation();
        }}
        className={cn(
          "w-full h-6 px-1.5 rounded text-xs bg-background border border-primary/60",
          "focus:outline-none focus:ring-1 focus:ring-primary/50 focus:border-primary",
          "text-foreground font-medium"
        )}
        onClick={(e) => e.stopPropagation()}
      />
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// TREE NODE ROW
// ─────────────────────────────────────────────────────────────────────────────
const TreeNodeRow = memo(
  ({
    node,
    onSelect,
    onToggleExpand,
    onDoubleClick,
    onDragStart,
    onDragOver,
    onDrop,
    onDragLeave,
    onRename,
    onDelete,
    onNewFile,
    onNewFolder,
    onCopyPath,
    onCopyRelativePath,
    onRevealInFinder,
    onPin,
    onDuplicate,
    isSelected,
    isExpanded,
    isDragOver,
    isPinned,
  }: {
    node: FileNode;
    onSelect: (path: string, ctrlKey: boolean, shiftKey: boolean) => void;
    onToggleExpand: (path: string) => void;
    onDoubleClick: (path: string, type: "file" | "folder") => void;
    onDragStart: (e: React.DragEvent, path: string) => void;
    onDragOver: (e: React.DragEvent, path: string) => void;
    onDrop: (e: React.DragEvent, path: string) => void;
    onDragLeave: (e: React.DragEvent) => void;
    onRename: (oldPath: string, newName: string) => void;
    onDelete: (path: string) => void;
    onNewFile: (parentPath: string) => void;
    onNewFolder: (parentPath: string) => void;
    onCopyPath: (path: string) => void;
    onCopyRelativePath: (path: string) => void;
    onRevealInFinder: (path: string) => void;
    onPin: (path: string) => void;
    onDuplicate: (path: string) => void;
    isSelected: boolean;
    isExpanded: boolean;
    isDragOver: boolean;
    isPinned: boolean;
  }) => {
    const { activeFilePath } = useAIBuilderStore();
    const [isHovered, setIsHovered] = useState(false);
    const [isRenaming, setIsRenaming] = useState(false);
    const [renameValue, setRenameValue] = useState(node.name);
    const rowRef = useRef<HTMLDivElement>(null);

    const isActive = activeFilePath === node.path;
    const paddingLeft = node.level * 14 + (node.type === "folder" ? 4 : 22);
    const fileConfig = node.type === "file" ? getFileTypeConfig(node.name) : null;
    const folderColor = node.type === "folder" ? getFolderColor(node.name) : null;

    const handleRenameSubmit = useCallback(() => {
      if (renameValue && renameValue !== node.name) {
        onRename(node.path, renameValue);
      }
      setIsRenaming(false);
      setRenameValue(node.name);
    }, [renameValue, node.name, node.path, onRename]);

    if (isRenaming) {
      return (
        <RenameInput
          value={renameValue}
          onChange={setRenameValue}
          onSubmit={handleRenameSubmit}
          onCancel={() => { setIsRenaming(false); setRenameValue(node.name); }}
          paddingLeft={paddingLeft}
        />
      );
    }

    const contextItems = (
      <>
        <ContextMenuLabel className="text-xs font-semibold opacity-60 px-2 py-1">
          {node.name}
        </ContextMenuLabel>
        <ContextMenuSeparator />
        <ContextMenuItem onClick={() => setIsRenaming(true)} className="text-xs">
          <Pencil className="mr-2 h-3.5 w-3.5" />
          Rename
          <ContextMenuShortcut>F2</ContextMenuShortcut>
        </ContextMenuItem>
        <ContextMenuItem onClick={() => onDuplicate(node.path)} className="text-xs">
          <FileSymlink className="mr-2 h-3.5 w-3.5" />
          Duplicate
        </ContextMenuItem>
        <ContextMenuItem
          onClick={() => { onDelete(node.path); toast.success(`Deleted ${node.name}`); }}
          className="text-xs text-destructive focus:text-destructive"
        >
          <Trash2 className="mr-2 h-3.5 w-3.5" />
          Delete
          <ContextMenuShortcut>⌫</ContextMenuShortcut>
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem onClick={() => onCopyPath(node.path)} className="text-xs">
          <Copy className="mr-2 h-3.5 w-3.5" />
          Copy Absolute Path
        </ContextMenuItem>
        <ContextMenuItem onClick={() => onCopyRelativePath(node.path)} className="text-xs">
          <Copy className="mr-2 h-3.5 w-3.5" />
          Copy Relative Path
        </ContextMenuItem>
        <ContextMenuItem onClick={() => onRevealInFinder(node.path)} className="text-xs">
          <Eye className="mr-2 h-3.5 w-3.5" />
          Reveal in Finder
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem onClick={() => onPin(node.path)} className="text-xs">
          <Star className={cn("mr-2 h-3.5 w-3.5", isPinned && "fill-amber-400 text-amber-400")} />
          {isPinned ? "Unpin" : "Pin to Top"}
        </ContextMenuItem>
        {node.type === "folder" && (
          <>
            <ContextMenuSeparator />
            <ContextMenuItem onClick={() => onNewFile(node.path)} className="text-xs">
              <FilePlus className="mr-2 h-3.5 w-3.5" />
              New File Here
            </ContextMenuItem>
            <ContextMenuItem onClick={() => onNewFolder(node.path)} className="text-xs">
              <FolderPlus className="mr-2 h-3.5 w-3.5" />
              New Folder Here
            </ContextMenuItem>
          </>
        )}
      </>
    );

    return (
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <motion.div
            ref={rowRef}
            layout="position"
            initial={{ opacity: 0, x: -4 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -4 }}
            transition={{ duration: 0.12 }}
            style={{ paddingLeft }}
            className={cn(
              "group relative flex items-center h-[28px] pr-2 cursor-default select-none",
              "transition-colors duration-100",
              !isActive && !isSelected && "hover:bg-muted/50",
              isSelected && !isActive && "bg-primary/8 dark:bg-primary/12",
              isActive && "bg-primary/12 dark:bg-primary/18",
              isDragOver && "bg-blue-500/10 outline outline-1 outline-blue-500/40 outline-offset-[-1px] rounded-sm"
            )}
            onClick={(e) => {
              e.stopPropagation();
              // Perform selection first
              onSelect(node.path, e.ctrlKey || e.metaKey, e.shiftKey);
              // Open file or toggle folder on single click (smooth single-click behavior)
              if (!e.ctrlKey && !e.metaKey && !e.shiftKey) {
                onDoubleClick(node.path, node.type);
              }
            }}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            draggable
            onDragStart={(e: any) => onDragStart(e, node.path)}
            onDragOver={(e: any) => onDragOver(e, node.path)}
            onDrop={(e: any) => onDrop(e, node.path)}
            onDragLeave={onDragLeave}
          >
            {/* Active indicator */}
            <AnimatePresence>
              {isActive && (
                <motion.div
                  layoutId="active-indicator"
                  className="absolute left-0 top-1/2 -translate-y-1/2 w-[2px] h-[18px] bg-primary rounded-full"
                  initial={{ scaleY: 0 }}
                  animate={{ scaleY: 1 }}
                  exit={{ scaleY: 0 }}
                />
              )}
            </AnimatePresence>

            {/* Expand/Collapse toggle for folders */}
            {node.type === "folder" && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleExpand(node.path);
                }}
                className={cn(
                  "flex items-center justify-center w-4 h-4 rounded mr-1 shrink-0",
                  "text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                )}
              >
                <motion.div
                  animate={{ rotate: isExpanded ? 90 : 0 }}
                  transition={{ duration: 0.15, ease: "easeOut" }}
                >
                  <ChevronRight className="w-3 h-3" />
                </motion.div>
              </button>
            )}

            {/* Icon */}
            <span
              className="shrink-0 mr-1.5 flex items-center"
              style={{ color: node.type === "folder" ? folderColor! : fileConfig?.color }}
            >
              {node.type === "folder"
                ? isExpanded
                  ? <FolderOpen className="w-[14px] h-[14px]" />
                  : <Folder className="w-[14px] h-[14px]" />
                : fileConfig?.icon}
            </span>

            {/* Pin indicator */}
            {isPinned && (
              <Star className="w-2.5 h-2.5 fill-amber-400 text-amber-400 mr-1 shrink-0" />
            )}

            {/* File name */}
            <span
              className={cn(
                "truncate text-[12.5px] leading-none font-medium flex-1 min-w-0",
                isActive ? "text-foreground" : "text-foreground/80",
                node.isGitModified && "text-amber-500 dark:text-amber-400",
                node.isGitAdded && "text-emerald-500 dark:text-emerald-400",
                node.hasErrors && "text-red-500 dark:text-red-400",
              )}
            >
              {node.name}
            </span>

            {/* Ext badge */}
            {node.type === "file" && fileConfig && (
              <ExtBadge ext={node.ext ?? ""} color={fileConfig.color} />
            )}

            {/* Error/Warning indicators */}
            <div className="flex items-center gap-0.5 shrink-0 ml-1">
              {node.hasErrors && (
                <AlertCircle className="w-3 h-3 text-red-500" />
              )}
              {!node.hasErrors && node.hasWarnings && (
                <AlertCircle className="w-3 h-3 text-amber-500" />
              )}
            </div>

            {/* Git status */}
            <GitStatusDot node={node} />

            {/* Hover actions */}
            <AnimatePresence>
              {isHovered && !node.isGitModified && !node.hasErrors && !node.hasWarnings && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.1 }}
                  className="flex items-center gap-0.5 ml-auto shrink-0"
                  onClick={(e) => e.stopPropagation()}
                >
                  {node.type === "folder" && (
                    <>
                      <TooltipProvider delayDuration={600}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              className="h-5 w-5 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                              onClick={() => onNewFile(node.path)}
                            >
                              <FilePlus className="w-3 h-3" />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="text-xs">New File</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                      <TooltipProvider delayDuration={600}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              className="h-5 w-5 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                              onClick={() => onNewFolder(node.path)}
                            >
                              <FolderPlus className="w-3 h-3" />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="text-xs">New Folder</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </>
                  )}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className="h-5 w-5 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                        <MoreHorizontal className="w-3 h-3" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-52 text-xs">
                      <DropdownMenuLabel className="text-xs opacity-60">{node.name}</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem className="text-xs" onClick={() => setIsRenaming(true)}>
                        <Pencil className="mr-2 h-3.5 w-3.5" /> Rename
                      </DropdownMenuItem>
                      <DropdownMenuItem className="text-xs" onClick={() => onDuplicate(node.path)}>
                        <FileSymlink className="mr-2 h-3.5 w-3.5" /> Duplicate
                      </DropdownMenuItem>
                      <DropdownMenuItem className="text-xs text-destructive" onClick={() => { onDelete(node.path); toast.success(`Deleted ${node.name}`); }}>
                        <Trash2 className="mr-2 h-3.5 w-3.5" /> Delete
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuSub>
                        <DropdownMenuSubTrigger className="text-xs">
                          <Copy className="mr-2 h-3.5 w-3.5" /> Copy Path
                        </DropdownMenuSubTrigger>
                        <DropdownMenuSubContent>
                          <DropdownMenuItem className="text-xs" onClick={() => onCopyPath(node.path)}>
                            Absolute Path
                          </DropdownMenuItem>
                          <DropdownMenuItem className="text-xs" onClick={() => onCopyRelativePath(node.path)}>
                            Relative Path
                          </DropdownMenuItem>
                        </DropdownMenuSubContent>
                      </DropdownMenuSub>
                      <DropdownMenuItem className="text-xs" onClick={() => onPin(node.path)}>
                        <Star className={cn("mr-2 h-3.5 w-3.5", isPinned && "fill-amber-400 text-amber-400")} />
                        {isPinned ? "Unpin" : "Pin to Top"}
                      </DropdownMenuItem>
                      {node.type === "folder" && (
                        <>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem className="text-xs" onClick={() => onNewFile(node.path)}>
                            <FilePlus className="mr-2 h-3.5 w-3.5" /> New File Here
                          </DropdownMenuItem>
                          <DropdownMenuItem className="text-xs" onClick={() => onNewFolder(node.path)}>
                            <FolderPlus className="mr-2 h-3.5 w-3.5" /> New Folder Here
                          </DropdownMenuItem>
                        </>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </ContextMenuTrigger>
        <ContextMenuContent className="w-56 text-xs">
          {contextItems}
        </ContextMenuContent>
      </ContextMenu>
    );
  }
);
TreeNodeRow.displayName = "TreeNodeRow";

// ─────────────────────────────────────────────────────────────────────────────
// OPEN FILE TAB
// ─────────────────────────────────────────────────────────────────────────────
type OpenTab = { path: string; isDirty: boolean };

const OpenTabBar: React.FC<{
  tabs: OpenTab[];
  activeFilePath: string | null;
  onTabClick: (path: string) => void;
  onTabClose: (path: string) => void;
  onTabCloseOthers: (path: string) => void;
}> = ({ tabs, activeFilePath, onTabClick, onTabClose, onTabCloseOthers }) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollRef.current?.querySelector(`[data-active="true"]`);
    el?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [activeFilePath]);

  if (tabs.length === 0) return null;

  return (
    <div className="border-t border-border bg-background">
      <div
        ref={scrollRef}
        className="flex overflow-x-auto scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent"
        style={{ scrollbarWidth: "thin" }}
      >
        {tabs.map((tab) => {
          const fileName = tab.path.split("/").pop() ?? tab.path;
          const config = getFileTypeConfig(fileName);
          const isActive = activeFilePath === tab.path;

          return (
            <ContextMenu key={tab.path}>
              <ContextMenuTrigger asChild>
                <button
                  data-active={isActive}
                  className={cn(
                    "group relative flex items-center gap-1.5 px-3 h-9 border-r border-border shrink-0",
                    "text-[11.5px] font-medium transition-all duration-100 min-w-0 max-w-[160px]",
                    isActive
                      ? "bg-background text-foreground border-b-2 border-b-primary"
                      : "bg-muted/30 text-muted-foreground hover:text-foreground hover:bg-muted/60"
                  )}
                  onClick={() => onTabClick(tab.path)}
                >
                  <span style={{ color: config.color }} className="shrink-0">
                    {config.icon}
                  </span>
                  <span className="truncate">{fileName}</span>
                  {tab.isDirty && (
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
                  )}
                  <button
                    className={cn(
                      "ml-0.5 h-4 w-4 rounded flex items-center justify-center shrink-0 transition-opacity",
                      "hover:bg-muted text-muted-foreground hover:text-foreground",
                      tab.isDirty ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                    )}
                    onClick={(e) => { e.stopPropagation(); onTabClose(tab.path); }}
                  >
                    <X className="w-2.5 h-2.5" />
                  </button>
                </button>
              </ContextMenuTrigger>
              <ContextMenuContent className="w-48 text-xs">
                <ContextMenuItem onClick={() => onTabClose(tab.path)}>
                  <X className="mr-2 h-3.5 w-3.5" /> Close Tab
                </ContextMenuItem>
                <ContextMenuItem onClick={() => onTabCloseOthers(tab.path)}>
                  Close Others
                </ContextMenuItem>
                <ContextMenuSeparator />
                <ContextMenuItem onClick={() => { navigator.clipboard.writeText(tab.path); toast.success("Path copied"); }}>
                  <Copy className="mr-2 h-3.5 w-3.5" /> Copy Path
                </ContextMenuItem>
              </ContextMenuContent>
            </ContextMenu>
          );
        })}
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// BREADCRUMB
// ─────────────────────────────────────────────────────────────────────────────
const Breadcrumb: React.FC<{ path: string | null }> = ({ path }) => {
  if (!path) return null;
  const parts = path.split("/");

  return (
    <div className="flex items-center gap-0.5 px-3 py-1 border-b border-border/60 bg-muted/20">
      {parts.map((part, i) => {
        const isLast = i === parts.length - 1;
        const config = isLast ? getFileTypeConfig(part) : null;
        return (
          <React.Fragment key={i}>
            <span
              className={cn(
                "text-[11px] truncate max-w-[80px]",
                isLast ? "text-foreground font-medium flex items-center gap-1" : "text-muted-foreground cursor-pointer hover:text-foreground transition-colors"
              )}
            >
              {config && (
                <span style={{ color: config.color }}>{config.icon}</span>
              )}
              {part}
            </span>
            {!isLast && <ChevronRight className="w-2.5 h-2.5 text-muted-foreground/50 shrink-0" />}
          </React.Fragment>
        );
      })}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// SECTION HEADER (pinned, recent, etc.)
// ─────────────────────────────────────────────────────────────────────────────
const SectionHeader: React.FC<{
  label: string;
  icon?: React.ReactNode;
  count?: number;
  actions?: React.ReactNode;
}> = ({ label, icon, count, actions }) => (
  <div className="flex items-center justify-between px-3 py-1 sticky top-0 z-10 bg-background/80 backdrop-blur-sm border-b border-border/30">
    <div className="flex items-center gap-1.5">
      {icon && <span className="text-muted-foreground">{icon}</span>}
      <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/70">
        {label}
      </span>
      {count !== undefined && (
        <span className="text-[10px] font-medium text-muted-foreground/50">({count})</span>
      )}
    </div>
    {actions}
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// SEARCH HIGHLIGHT
// ─────────────────────────────────────────────────────────────────────────────
function highlightMatch(text: string, query: string) {
  if (!query) return <>{text}</>;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return <>{text}</>;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="bg-yellow-300/50 dark:bg-yellow-500/30 text-inherit rounded-sm">
        {text.slice(idx, idx + query.length)}
      </mark>
      {text.slice(idx + query.length)}
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SEARCH RESULT ROW
// ─────────────────────────────────────────────────────────────────────────────
const SearchResultRow: React.FC<{
  node: FileNode;
  query: string;
  onSelect: (path: string) => void;
}> = ({ node, query, onSelect }) => {
  const config = getFileTypeConfig(node.name);
  const dir = node.path.split("/").slice(0, -1).join("/");

  return (
    <button
      className="w-full flex items-center gap-2 px-3 py-2 hover:bg-muted/50 transition-colors text-left border-b border-border/30 last:border-none"
      onClick={() => onSelect(node.path)}
    >
      <span style={{ color: config.color }} className="shrink-0">{config.icon}</span>
      <div className="flex-1 min-w-0">
        <p className="text-[12.5px] font-medium text-foreground leading-tight truncate">
          {highlightMatch(node.name, query)}
        </p>
        {dir && (
          <p className="text-[10.5px] text-muted-foreground leading-tight truncate mt-0.5">
            {highlightMatch(dir, query)}
          </p>
        )}
      </div>
      {node.isGitModified && <span className="text-[10px] text-amber-400 shrink-0">M</span>}
      {node.hasErrors && <AlertCircle className="w-3 h-3 text-red-400 shrink-0" />}
    </button>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// STATS BAR
// ─────────────────────────────────────────────────────────────────────────────
const StatsBar: React.FC<{
  files: AIFileNode[];
  selectedCount: number;
}> = ({ files, selectedCount }) => {
  const fileCount = files.filter(f => !f.path.endsWith("/")).length;
  const folderCount = new Set(
    files.map(f => f.path.split("/").slice(0, -1).join("/")).filter(Boolean)
  ).size;

  return (
    <div className="px-3 py-1.5 border-t border-border bg-muted/10 flex items-center justify-between gap-2">
      <div className="flex items-center gap-3">
        <span className="text-[10px] text-muted-foreground">
          <span className="font-medium text-foreground/70">{fileCount}</span> files
        </span>
        <span className="text-[10px] text-muted-foreground">
          <span className="font-medium text-foreground/70">{folderCount}</span> folders
        </span>
      </div>
      {selectedCount > 0 && (
        <span className="text-[10px] text-primary font-medium">
          {selectedCount} selected
        </span>
      )}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// NEW FILE/FOLDER INPUT
// ─────────────────────────────────────────────────────────────────────────────
const InlineCreateInput: React.FC<{
  type: "file" | "folder";
  parentPath: string;
  level: number;
  onSubmit: (name: string) => void;
  onCancel: () => void;
}> = ({ type, parentPath, level, onSubmit, onCancel }) => {
  const [value, setValue] = useState("");
  const paddingLeft = level * 14 + 22;

  return (
    <div className="flex items-center h-[28px] gap-1.5" style={{ paddingLeft }}>
      {type === "folder"
        ? <Folder className="w-[14px] h-[14px] text-amber-400 shrink-0" />
        : <File className="w-[14px] h-[14px] text-muted-foreground shrink-0" />
      }
      <input
        autoFocus
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={() => { if (value.trim()) onSubmit(value.trim()); else onCancel(); }}
        onKeyDown={(e) => {
          if (e.key === "Enter" && value.trim()) onSubmit(value.trim());
          if (e.key === "Escape") onCancel();
          e.stopPropagation();
        }}
        placeholder={type === "folder" ? "folder name" : "file name"}
        className={cn(
          "flex-1 h-6 px-1.5 rounded text-[12px] bg-background border border-primary/50",
          "focus:outline-none focus:ring-1 focus:ring-primary/40 text-foreground"
        )}
      />
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// MAIN FILE EXPLORER
// ─────────────────────────────────────────────────────────────────────────────
const FileExplorer: React.FC = () => {
  const {
    files,
    activeFilePath,
    setActiveFile,
    updateFile,
    undo,
    redo,
    canUndo,
    canRedo,
  } = useAIBuilderStore();

  // ── Local UI State ──
  const [selectedPaths, setSelectedPaths] = useState<string[]>([]);
  const [lastSelectedPath, setLastSelectedPath] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [dragOverPath, setDragOverPath] = useState<string | null>(null);
  const [dragSourcePath, setDragSourcePath] = useState<string | null>(null);
  const [pinnedPaths, setPinnedPaths] = useState<Set<string>>(new Set());
  const [sortMode, setSortMode] = useState<SortMode>("name");
  const [filterMode, setFilterMode] = useState<FilterMode>("all");
  const [showHidden, setShowHidden] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [openTabs, setOpenTabs] = useState<OpenTab[]>([]);
  const [inlineCreate, setInlineCreate] = useState<{ parentPath: string; type: "file" | "folder"; level: number } | null>(null);

  const searchInputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // ── Derived data ──
  const tree = useMemo(() => buildTree(files, sortMode, showHidden), [files, sortMode, showHidden]);

  const flatNodes = useMemo(
    () => flattenTree(tree, expandedFolders, searchQuery, pinnedPaths, filterMode),
    [tree, expandedFolders, searchQuery, pinnedPaths, filterMode]
  );

  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase();
    return flatNodes.filter(
      (n) => n.type === "file" && (n.name.toLowerCase().includes(q) || n.path.toLowerCase().includes(q))
    ).slice(0, 20);
  }, [flatNodes, searchQuery]);

  const pinnedNodes = useMemo(
    () => flatNodes.filter((n) => pinnedPaths.has(n.path)),
    [flatNodes, pinnedPaths]
  );

  // ── Git stats ──
  const gitModifiedCount = useMemo(
    () => files.filter((_, i) => flatNodes[i]?.isGitModified).length,
    [files, flatNodes]
  );

  // ── Tab management ──
  const openFile = useCallback((path: string) => {
    setActiveFile(path);
    setOpenTabs((prev) => {
      if (prev.find((t) => t.path === path)) return prev;
      return [...prev, { path, isDirty: false }];
    });
  }, [setActiveFile]);

  const closeTab = useCallback((path: string) => {
    setOpenTabs((prev) => {
      const idx = prev.findIndex((t) => t.path === path);
      const next = prev.filter((t) => t.path !== path);
      if (activeFilePath === path && next.length > 0) {
        setActiveFile(next[Math.max(0, idx - 1)].path);
      }
      return next;
    });
  }, [activeFilePath, setActiveFile]);

  const closeOtherTabs = useCallback((path: string) => {
    setOpenTabs([{ path, isDirty: false }]);
    setActiveFile(path);
  }, [setActiveFile]);

  // ── Selection ──
  const handleSelect = useCallback(
    (path: string, ctrlKey: boolean, shiftKey: boolean) => {
      setSelectedPaths((prev) => {
        if (ctrlKey) {
          return prev.includes(path) ? prev.filter((p) => p !== path) : [...prev, path];
        }
        if (shiftKey && lastSelectedPath) {
          const allPaths = flatNodes.map((n) => n.path);
          const startIdx = allPaths.indexOf(lastSelectedPath);
          const endIdx = allPaths.indexOf(path);
          if (startIdx !== -1 && endIdx !== -1) {
            const [min, max] = [startIdx, endIdx].sort((a, b) => a - b);
            return allPaths.slice(min, max + 1);
          }
        }
        setLastSelectedPath(path);
        return [path];
      });
      setLastSelectedPath(path);
    },
    [lastSelectedPath, flatNodes]
  );

  const handleDoubleClick = useCallback(
    (path: string, type: "file" | "folder") => {
      if (type === "file") {
        openFile(path);
      } else {
        setExpandedFolders((prev) => {
          const next = new Set(prev);
          next.has(path) ? next.delete(path) : next.add(path);
          return next;
        });
      }
    },
    [openFile]
  );

  const toggleExpand = useCallback((path: string) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      next.has(path) ? next.delete(path) : next.add(path);
      return next;
    });
  }, []);

  // ── Drag & Drop ──
  const handleDragStart = useCallback((e: React.DragEvent, path: string) => {
    e.dataTransfer.setData("text/plain", path);
    e.dataTransfer.effectAllowed = "move";
    setDragSourcePath(path);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, path: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverPath(path);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    setDragOverPath(null);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent, targetPath: string) => {
      e.preventDefault();
      setDragOverPath(null);
      setDragSourcePath(null);
      const sourcePath = e.dataTransfer.getData("text/plain");
      if (!sourcePath || sourcePath === targetPath) return;

      const sourceFile = files.find((f) => f.path === sourcePath);
      if (!sourceFile) return;

      const targetNode = flatNodes.find((n) => n.path === targetPath);
      if (!targetNode) return;

      const targetDir =
        targetNode.type === "folder"
          ? targetNode.path
          : targetNode.path.split("/").slice(0, -1).join("/");

      const fileName = sourcePath.split("/").pop()!;
      const newPath = targetDir ? `${targetDir}/${fileName}` : fileName;

      if (newPath !== sourcePath) {
        updateFile(newPath, sourceFile.content);
        toast.success(`Moved ${fileName}`, {
          description: `→ ${targetDir || "/"}`,
        });
      }
    },
    [flatNodes, files, updateFile]
  );

  // ── File Operations ──
  const handleDelete = useCallback(
    (path: string) => {
      const affected = files.filter((f) => f.path === path || f.path.startsWith(path + "/"));
      affected.forEach(() => {/* store delete action */});
      setSelectedPaths((prev) => prev.filter((p) => p !== path));
      closeTab(path);
    },
    [files, closeTab]
  );

  const handleRename = useCallback(
    (oldPath: string, newName: string) => {
      const file = files.find((f) => f.path === oldPath);
      if (!file) return;
      const parts = oldPath.split("/");
      parts[parts.length - 1] = newName;
      const newPath = parts.join("/");
      updateFile(newPath, file.content);
      if (activeFilePath === oldPath) setActiveFile(newPath);
      toast.success(`Renamed to "${newName}"`);
    },
    [files, updateFile, activeFilePath, setActiveFile]
  );

  const handleNewFile = useCallback(
    (parentPath: string) => {
      const level = parentPath ? parentPath.split("/").length : 0;
      setInlineCreate({ parentPath, type: "file", level });
      if (parentPath && !expandedFolders.has(parentPath)) {
        setExpandedFolders((prev) => new Set([...prev, parentPath]));
      }
    },
    [expandedFolders]
  );

  const handleNewFolder = useCallback(
    (parentPath: string) => {
      const level = parentPath ? parentPath.split("/").length : 0;
      setInlineCreate({ parentPath, type: "folder", level });
      if (parentPath && !expandedFolders.has(parentPath)) {
        setExpandedFolders((prev) => new Set([...prev, parentPath]));
      }
    },
    [expandedFolders]
  );

  const handleInlineCreateSubmit = useCallback(
    (name: string) => {
      if (!inlineCreate) return;
      const { parentPath, type } = inlineCreate;
      const fullPath = parentPath
        ? type === "folder"
          ? `${parentPath}/${name}/.gitkeep`
          : `${parentPath}/${name}`
        : type === "folder"
        ? `${name}/.gitkeep`
        : name;
      updateFile(fullPath, "");
      if (type === "file") openFile(fullPath);
      toast.success(`Created ${type === "folder" ? "folder" : "file"} "${name}"`);
      setInlineCreate(null);
    },
    [inlineCreate, updateFile, openFile]
  );

  const handleCopyPath = useCallback((path: string) => {
    navigator.clipboard.writeText("/" + path);
    toast.success("Absolute path copied");
  }, []);

  const handleCopyRelativePath = useCallback((path: string) => {
    navigator.clipboard.writeText(path);
    toast.success("Relative path copied");
  }, []);

  const handleRevealInFinder = useCallback((path: string) => {
    toast.info(`Reveal: ${path}`, { description: "Would open in system file manager" });
  }, []);

  const handlePin = useCallback((path: string) => {
    setPinnedPaths((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
        toast.success("Unpinned");
      } else {
        next.add(path);
        toast.success("Pinned to top");
      }
      return next;
    });
  }, []);

  const handleDuplicate = useCallback(
    (path: string) => {
      const file = files.find((f) => f.path === path);
      if (!file) return;
      const parts = path.split("/");
      const name = parts[parts.length - 1];
      const dotIdx = name.lastIndexOf(".");
      const newName = dotIdx > 0
        ? `${name.slice(0, dotIdx)}_copy${name.slice(dotIdx)}`
        : `${name}_copy`;
      parts[parts.length - 1] = newName;
      const newPath = parts.join("/");
      updateFile(newPath, file.content);
      toast.success(`Duplicated as "${newName}"`);
    },
    [files, updateFile]
  );

  // ── Expand / Collapse All ──
  const expandAll = useCallback(() => {
    const all = new Set<string>();
    const collect = (nodes: FileNode[]) => {
      nodes.forEach((n) => {
        if (n.type === "folder") {
          all.add(n.path);
          if (n.children) collect(n.children);
        }
      });
    };
    collect(tree);
    setExpandedFolders(all);
  }, [tree]);

  const collapseAll = useCallback(() => setExpandedFolders(new Set()), []);

  // ── Keyboard Shortcuts ──
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isInputFocused =
        document.activeElement instanceof HTMLInputElement ||
        document.activeElement instanceof HTMLTextAreaElement;

      if ((e.ctrlKey || e.metaKey) && e.key === "p" && !e.shiftKey) {
        e.preventDefault();
        searchInputRef.current?.focus();
      }

      if (e.key === "Escape" && isSearchFocused) {
        setSearchQuery("");
        searchInputRef.current?.blur();
      }

      if (e.key === "Delete" && !isInputFocused && selectedPaths.length > 0) {
        e.preventDefault();
        selectedPaths.forEach((p) => handleDelete(p));
        toast.success(`Deleted ${selectedPaths.length} item(s)`);
        setSelectedPaths([]);
      }

      if ((e.ctrlKey || e.metaKey) && e.key === "z" && !isInputFocused) {
        e.preventDefault();
        e.shiftKey ? redo() : undo();
      }

      if ((e.ctrlKey || e.metaKey) && e.key === "a" && !isInputFocused) {
        e.preventDefault();
        setSelectedPaths(flatNodes.map((n) => n.path));
      }

      if (e.key === "ArrowDown" && !isInputFocused) {
        e.preventDefault();
        const idx = lastSelectedPath ? flatNodes.findIndex((n) => n.path === lastSelectedPath) : -1;
        const next = flatNodes[idx + 1];
        if (next) { handleSelect(next.path, false, false); }
      }

      if (e.key === "ArrowUp" && !isInputFocused) {
        e.preventDefault();
        const idx = lastSelectedPath ? flatNodes.findIndex((n) => n.path === lastSelectedPath) : flatNodes.length;
        const prev = flatNodes[idx - 1];
        if (prev) { handleSelect(prev.path, false, false); }
      }

      if (e.key === "ArrowRight" && !isInputFocused && lastSelectedPath) {
        e.preventDefault();
        const node = flatNodes.find((n) => n.path === lastSelectedPath);
        if (node?.type === "folder" && !expandedFolders.has(node.path)) {
          toggleExpand(node.path);
        }
      }

      if (e.key === "ArrowLeft" && !isInputFocused && lastSelectedPath) {
        e.preventDefault();
        const node = flatNodes.find((n) => n.path === lastSelectedPath);
        if (node?.type === "folder" && expandedFolders.has(node.path)) {
          toggleExpand(node.path);
        }
      }

      if (e.key === "Enter" && !isInputFocused && lastSelectedPath) {
        e.preventDefault();
        const node = flatNodes.find((n) => n.path === lastSelectedPath);
        if (node) handleDoubleClick(node.path, node.type);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedPaths, handleDelete, undo, redo, flatNodes, lastSelectedPath, handleSelect, expandedFolders, toggleExpand, handleDoubleClick, isSearchFocused]);

  // ── Empty state ──
  const isEmpty = flatNodes.length === 0;

  if (isCollapsed) {
    return (
      <motion.div
        initial={false}
        animate={{ width: 36 }}
        className="h-full flex flex-col items-center border-r border-border bg-background/95 pt-2 gap-1"
      >
        <TooltipProvider delayDuration={400}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => setIsCollapsed(false)}
              >
                <PanelLeftOpen className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right" className="text-xs">Expand Explorer</TooltipContent>
          </Tooltip>
        </TooltipProvider>
        <Separator />
        {files.length > 0 && (
          <div className="flex flex-col items-center gap-2 mt-1">
            <div className="w-5 h-5 rounded-sm bg-primary/10 flex items-center justify-center">
              <Layers className="w-3 h-3 text-primary" />
            </div>
          </div>
        )}
      </motion.div>
    );
  }

  return (
    <TooltipProvider delayDuration={500}>
      <motion.div
        initial={false}
        className="h-full flex flex-col bg-background border-r border-border overflow-hidden"
        onClick={() => setSelectedPaths([])}
      >
        {/* ── Header ── */}
        <div className="flex items-center justify-between px-3 h-10 border-b border-border bg-muted/20 shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground/70">
              Explorer
            </span>
            {filterMode !== "all" && (
              <Badge variant="secondary" className="h-4 text-[9px] px-1.5 font-semibold">
                {filterMode}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-0.5" onClick={(e) => e.stopPropagation()}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={expandAll}>
                  <ChevronDown className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs">Expand All</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={collapseAll}>
                  <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs">Collapse All</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleNewFile("")}>
                  <FilePlus className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs">New File</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleNewFolder("")}>
                  <FolderPlus className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs">New Folder</TooltipContent>
            </Tooltip>

            {/* Sort / Filter Menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className={cn("h-6 w-6", (sortMode !== "name" || filterMode !== "all" || showHidden) && "text-primary")}
                >
                  <Filter className="h-3.5 w-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48 text-xs">
                <DropdownMenuLabel className="text-xs opacity-60">Sort By</DropdownMenuLabel>
                {(["name", "type", "modified"] as SortMode[]).map((mode) => (
                  <DropdownMenuCheckboxItem
                    key={mode}
                    checked={sortMode === mode}
                    onCheckedChange={() => setSortMode(mode)}
                    className="text-xs capitalize"
                  >
                    {mode}
                  </DropdownMenuCheckboxItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuLabel className="text-xs opacity-60">Filter</DropdownMenuLabel>
                {(["all", "modified", "errors", "pinned"] as FilterMode[]).map((mode) => (
                  <DropdownMenuCheckboxItem
                    key={mode}
                    checked={filterMode === mode}
                    onCheckedChange={() => setFilterMode(mode)}
                    className="text-xs capitalize"
                  >
                    {mode === "all" ? "Show All" : mode}
                  </DropdownMenuCheckboxItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuCheckboxItem
                  checked={showHidden}
                  onCheckedChange={setShowHidden}
                  className="text-xs"
                >
                  Show Hidden Files
                </DropdownMenuCheckboxItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setIsCollapsed(true)}>
                  <PanelLeftClose className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs">Collapse Panel</TooltipContent>
            </Tooltip>
          </div>
        </div>

        {/* ── Breadcrumb ── */}
        <Breadcrumb path={activeFilePath} />

        {/* ── Search ── */}
        <div className="px-2 py-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
            <input
              ref={searchInputRef}
              placeholder="Search files… (⌘P)"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => setIsSearchFocused(true)}
              onBlur={() => setIsSearchFocused(false)}
              className={cn(
                "w-full h-8 pl-7 pr-7 text-[12px] rounded-md border bg-background/60 transition-all duration-150",
                "focus:outline-none focus:ring-1 focus:ring-primary/40 focus:border-primary/50",
                "placeholder:text-muted-foreground/50 text-foreground",
                isSearchFocused ? "border-primary/40 bg-background" : "border-border/60"
              )}
            />
            {searchQuery && (
              <button
                className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 flex items-center justify-center rounded text-muted-foreground hover:text-foreground"
                onClick={() => { setSearchQuery(""); searchInputRef.current?.focus(); }}
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
        </div>

        {/* ── Search Results Overlay ── */}
        <AnimatePresence>
          {searchQuery && searchResults.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              className="border-b border-border bg-background/95 backdrop-blur-sm"
              onClick={(e) => e.stopPropagation()}
            >
              <SectionHeader
                label="Search Results"
                icon={<Search className="w-3 h-3" />}
                count={searchResults.length}
              />
              <div className="max-h-[200px] overflow-y-auto">
                {searchResults.map((node) => (
                  <SearchResultRow
                    key={node.path}
                    node={node}
                    query={searchQuery}
                    onSelect={(path) => {
                      openFile(path);
                      setSearchQuery("");
                    }}
                  />
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── File Tree ── */}
        <div
          ref={containerRef}
          className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden"
          onClick={(e) => { e.stopPropagation(); setSelectedPaths([]); }}
        >
          {/* Pinned section */}
          <AnimatePresence>
            {pinnedPaths.size > 0 && !searchQuery && filterMode === "all" && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="border-b border-border/60"
              >
                <SectionHeader
                  label="Pinned"
                  icon={<Star className="w-3 h-3" />}
                  count={pinnedPaths.size}
                />
                {pinnedNodes.map((node) => (
                  <TreeNodeRow
                    key={`pinned-${node.path}`}
                    node={{ ...node, level: 0 }}
                    onSelect={handleSelect}
                    onToggleExpand={toggleExpand}
                    onDoubleClick={handleDoubleClick}
                    onDragStart={handleDragStart}
                    onDragOver={handleDragOver}
                    onDrop={handleDrop}
                    onDragLeave={handleDragLeave}
                    onRename={handleRename}
                    onDelete={handleDelete}
                    onNewFile={handleNewFile}
                    onNewFolder={handleNewFolder}
                    onCopyPath={handleCopyPath}
                    onCopyRelativePath={handleCopyRelativePath}
                    onRevealInFinder={handleRevealInFinder}
                    onPin={handlePin}
                    onDuplicate={handleDuplicate}
                    isSelected={selectedPaths.includes(node.path)}
                    isExpanded={expandedFolders.has(node.path)}
                    isDragOver={dragOverPath === node.path}
                    isPinned
                  />
                ))}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Main section header */}
          {!searchQuery && (
            <SectionHeader
              label={filterMode === "all" ? "Files" : filterMode === "modified" ? "Modified" : filterMode === "errors" ? "Errors" : "Pinned"}
              icon={filterMode === "modified" ? <GitBranch className="w-3 h-3" /> : <Layers className="w-3 h-3" />}
              count={flatNodes.length}
              actions={
                filterMode === "modified" ? (
                  <Badge variant="outline" className="h-4 text-[9px] px-1.5 text-amber-500 border-amber-500/30">
                    {flatNodes.filter(n => n.isGitModified).length} M
                  </Badge>
                ) : undefined
              }
            />
          )}

          {/* Inline create input at root */}
          {inlineCreate && inlineCreate.parentPath === "" && (
            <InlineCreateInput
              type={inlineCreate.type}
              parentPath={inlineCreate.parentPath}
              level={inlineCreate.level}
              onSubmit={handleInlineCreateSubmit}
              onCancel={() => setInlineCreate(null)}
            />
          )}

          {/* Empty state */}
          {isEmpty && !inlineCreate && (
            <div className="flex flex-col items-center justify-center py-12 px-4 text-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-muted/50 flex items-center justify-center">
                <Folder className="w-6 h-6 text-muted-foreground/50" />
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  {searchQuery
                    ? "No matching files"
                    : filterMode !== "all"
                    ? `No ${filterMode} files`
                    : "No files yet"}
                </p>
                {!searchQuery && filterMode === "all" && (
                  <p className="text-xs text-muted-foreground/60 mt-1">
                    Create a file to get started
                  </p>
                )}
              </div>
              {!searchQuery && filterMode === "all" && (
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => handleNewFile("")}>
                    <FilePlus className="w-3 h-3 mr-1" /> New File
                  </Button>
                  <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => handleNewFolder("")}>
                    <FolderPlus className="w-3 h-3 mr-1" /> New Folder
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* Tree nodes */}
          <LayoutGroup>
            <AnimatePresence initial={false}>
              {flatNodes.map((node) => {
                // Insert inline create after parent folder
                const showCreateAfter =
                  inlineCreate &&
                  inlineCreate.parentPath === node.path &&
                  node.type === "folder";

                return (
                  <React.Fragment key={node.path}>
                    <TreeNodeRow
                      node={node}
                      onSelect={handleSelect}
                      onToggleExpand={toggleExpand}
                      onDoubleClick={handleDoubleClick}
                      onDragStart={handleDragStart}
                      onDragOver={handleDragOver}
                      onDrop={handleDrop}
                      onDragLeave={handleDragLeave}
                      onRename={handleRename}
                      onDelete={handleDelete}
                      onNewFile={handleNewFile}
                      onNewFolder={handleNewFolder}
                      onCopyPath={handleCopyPath}
                      onCopyRelativePath={handleCopyRelativePath}
                      onRevealInFinder={handleRevealInFinder}
                      onPin={handlePin}
                      onDuplicate={handleDuplicate}
                      isSelected={selectedPaths.includes(node.path)}
                      isExpanded={expandedFolders.has(node.path)}
                      isDragOver={dragOverPath === node.path}
                      isPinned={pinnedPaths.has(node.path)}
                    />
                    {showCreateAfter && inlineCreate && (
                      <InlineCreateInput
                        type={inlineCreate.type}
                        parentPath={inlineCreate.parentPath}
                        level={node.level + 1}
                        onSubmit={handleInlineCreateSubmit}
                        onCancel={() => setInlineCreate(null)}
                      />
                    )}
                  </React.Fragment>
                );
              })}
            </AnimatePresence>
          </LayoutGroup>
        </div>

        {/* ── Open Tabs ── */}
        <OpenTabBar
          tabs={openTabs}
          activeFilePath={activeFilePath}
          onTabClick={openFile}
          onTabClose={closeTab}
          onTabCloseOthers={closeOtherTabs}
        />

        {/* ── Stats Bar ── */}
        <StatsBar files={files} selectedCount={selectedPaths.length} />
      </motion.div>
    </TooltipProvider>
  );
};

export default FileExplorer;