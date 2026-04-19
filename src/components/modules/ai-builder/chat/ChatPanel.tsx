"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import {
  Sparkles,
  Bot,
  Pencil,
  CheckCircle2,
  XCircle,
  Loader2,
  Send,
  CornerDownLeft,
  WifiOff,
  RefreshCw,
  StopCircle,
  Trash2,
  Copy,
  ThumbsUp,
  ThumbsDown,
  MoreHorizontal,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";

import { useAIBuilderStore } from "../state/ai-builder.store";
import { useWebContainer } from "../state/use-webcontainer";
import ChatMessage, { type AIMessage } from "./ChatMessage";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
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
} from "@/components/ui/dropdown-menu";

// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------
const CLIENT_TIMEOUT_MS = 31 * 60 * 1000;      // 31 minutes (route timeout is 30m)
const SSE_DEAD_TIMEOUT_MS = 20_000;            // 20s – reconnect if no data
const MAX_RECONNECTS = 8;
const RECONNECT_BASE_DELAY = 1500;

const STARTERS = [
  "SaaS landing page with pricing and hero",
  "Kanban board with drag and drop",
  "E‑commerce store with cart and checkout",
  "Analytics dashboard with charts",
  "Blog with markdown support",
  "Portfolio with dark mode",
];

// -----------------------------------------------------------------------------
// Helper Components
// -----------------------------------------------------------------------------
function ActionCard({
  status,
  label,
  fileCount,
  reconnectCount,
  onCancel,
}: {
  status: "pending" | "done" | "error";
  label: string;
  fileCount?: number;
  reconnectCount?: number;
  onCancel?: () => void;
}) {
  if (status === "pending") {
    return (
      <div className="flex flex-col gap-1 px-3 py-2 rounded-xl bg-yellow-500/10 border border-yellow-500/20 text-xs text-yellow-400">
        <div className="flex items-center gap-2">
          <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
          <span>{label}</span>
          {onCancel && (
            <button
              onClick={onCancel}
              className="ml-auto p-0.5 rounded hover:bg-yellow-500/20 transition"
            >
              <StopCircle className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        {reconnectCount && reconnectCount > 0 ? (
          <div className="flex items-center gap-1.5 pl-5 text-yellow-500/60">
            <WifiOff className="w-3 h-3" />
            <span>Reconnected {reconnectCount}× to keep going…</span>
          </div>
        ) : null}
      </div>
    );
  }
  if (status === "done") {
    return (
      <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-green-500/10 border border-green-500/20 text-xs text-green-400">
        <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
        <span>
          {label}
          {fileCount ? (
            <span className="ml-1 opacity-60">
              · {fileCount} file{fileCount !== 1 ? "s" : ""} written
            </span>
          ) : null}
        </span>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-red-500/10 border border-red-500/20 text-xs text-red-400">
      <XCircle className="w-3.5 h-3.5 shrink-0" />
      <span>{label}</span>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Empty State
// -----------------------------------------------------------------------------
function EmptyState({
  onSelect,
  disabled,
}: {
  onSelect: (p: string) => void;
  disabled: boolean;
}) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 px-4 py-8 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10">
        <Sparkles className="h-6 w-6 text-primary" />
      </div>
      <div>
        <p className="text-sm font-medium">What would you like to build?</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Describe your app and AI will generate the full code
        </p>
      </div>
      <div className="flex w-full max-w-xs flex-col gap-1.5">
        {STARTERS.map((p) => (
          <button
            key={p}
            onClick={() => onSelect(p)}
            disabled={disabled}
            className="rounded-lg border bg-muted/30 px-3 py-2 text-left text-xs text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50 transition-colors"
          >
            {p}
          </button>
        ))}
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Main ChatPanel Component
// -----------------------------------------------------------------------------
const ChatPanel = () => {
  const params = useParams();
  const subaccountId = params?.subaccountId as string;

  const projectId = useAIBuilderStore((s) => s.projectId);
  const storeFiles = useAIBuilderStore((s) => s.files);
  const setProject = useAIBuilderStore((s) => s.setProject);
  const setFiles = useAIBuilderStore((s) => s.setFiles);
  const addMessage = useAIBuilderStore((s) => s.addMessage);
  const setMessages = useAIBuilderStore((s) => s.setMessages);
  const messages = useAIBuilderStore((s) => s.messages);
  const clearMessages = useAIBuilderStore((s) => s.clearMessages);

  const { remount, mountAndRun, isRunning } = useWebContainer();

  const [isGenerating, setIsGenerating] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [fileCount, setFileCount] = useState(0);
  const [reconnectCount, setReconnectCount] = useState(0);
  const [isStreaming, setIsStreaming] = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Refs for stream management
  const abortRef = useRef<AbortController | null>(null);
  const isGeneratingRef = useRef(false);
  const reconnectsRef = useRef(0);
  const bufferedFilesRef = useRef<{ path: string; content: string }[]>([]);
  const activePromptRef = useRef<string>("");
  const activeAsstIdRef = useRef<string>("");
  const activeProjectRef = useRef<string | null>(null);
  const deadTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancelReaderRef = useRef<(() => void) | null>(null);
  const streamCompletedRef = useRef(false);
  const filesRef = useRef(storeFiles);

  useEffect(() => {
    filesRef.current = storeFiles;
  }, [storeFiles]);

  const isEditMode = !!(projectId && storeFiles.length > 0);

  // Auto-scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, isGenerating]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      if (deadTimerRef.current) clearTimeout(deadTimerRef.current);
    };
  }, []);

  // ---------------------------------------------------------------------------
  // File commit – triggers WebContainer update
  // ---------------------------------------------------------------------------
  const commitFiles = useCallback(
    (
      incoming: { path: string; content: string }[],
      promptLabel: string,
      activePid: string | null
    ) => {
      const prev = filesRef.current;
      const merged = [...prev];
      for (const file of incoming) {
        const idx = merged.findIndex((f) => f.path === file.path);
        if (idx >= 0) {
          merged[idx] = { ...merged[idx], content: file.content };
        } else {
          merged.push({ path: file.path, content: file.content, type: "file" as const });
        }
      }
      setFiles(merged, promptLabel);
      if (activePid && isRunning) {
        remount(merged, activePid);
      } else {
        mountAndRun(merged, activePid);
      }
    },
    [setFiles, isRunning, remount, mountAndRun]
  );

  // ---------------------------------------------------------------------------
  // Dead‑man timer (for detecting stale connections)
  // ---------------------------------------------------------------------------
  const resetDeadTimer = useCallback((onDead: () => void) => {
    if (deadTimerRef.current) clearTimeout(deadTimerRef.current);
    deadTimerRef.current = setTimeout(onDead, SSE_DEAD_TIMEOUT_MS);
  }, []);

  const clearDeadTimer = useCallback(() => {
    if (deadTimerRef.current) {
      clearTimeout(deadTimerRef.current);
      deadTimerRef.current = null;
    }
  }, []);

  // ---------------------------------------------------------------------------
  // Open SSE stream (with retry‑able errors)
  // ---------------------------------------------------------------------------
  const openStream = useCallback(
    async (
      text: string,
      asstId: string,
      activePid: string | null,
      signal: AbortSignal
    ): Promise<"done" | "reconnect"> => {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: text,
          subAccountId: subaccountId,
          ...(activePid ? { projectId: activePid } : {}),
        }),
        signal,
      });

      if (!res.ok) throw new Error(`API error: ${res.status}`);

      const headerPid = res.headers.get("x-project-id");
      if (headerPid) {
        activeProjectRef.current = headerPid;
        setProject(headerPid);
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error("No stream body");

      const decoder = new TextDecoder();
      let buffer = "";

      const triggerReconnect = () => reader.cancel().catch(() => {});
      cancelReaderRef.current = triggerReconnect;
      resetDeadTimer(triggerReconnect);

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (signal.aborted) {
            cancelReaderRef.current = null;
            return "reconnect";
          }
          if (done) {
            clearDeadTimer();
            cancelReaderRef.current = null;
            return "reconnect";
          }

          resetDeadTimer(triggerReconnect);
          buffer += decoder.decode(value, { stream: true });
          const parts = buffer.split("\n\n");
          buffer = parts.pop() ?? "";

          for (const part of parts) {
            const line = part.trim();
            if (line.startsWith(":")) continue;
            if (!line.startsWith("data:")) continue;

            let data: Record<string, unknown>;
            try {
              data = JSON.parse(line.slice(5).trim());
            } catch {
              continue;
            }

            if (data.type === "project") {
              const pid = data.projectId as string;
              activeProjectRef.current = pid;
              setProject(pid);
            }

            if (data.type === "file") {
              const file = data.file as { path: string; content: string };
              bufferedFilesRef.current.push(file);
              setFileCount(bufferedFilesRef.current.length);
            }

            if (data.type === "done") {
              clearDeadTimer();
              cancelReaderRef.current = null;
              streamCompletedRef.current = true;
              abortRef.current?.abort();
              await new Promise((r) => setTimeout(r, 200));

              const finalPid = activeProjectRef.current ?? activePid;
              commitFiles(bufferedFilesRef.current, `Generated: ${text.slice(0, 40)}`, finalPid);

              setIsGenerating(false);
              isGeneratingRef.current = false;
              setIsStreaming(false);
              setMessages((prev: AIMessage[]) =>
                prev.map((m: AIMessage) =>
                  m.id === asstId
                    ? { ...m, content: "__action:done__", status: "DONE" as const }
                    : m
                )
              );
              return "done";
            }

            if (data.type === "error") {
              clearDeadTimer();
              cancelReaderRef.current = null;
              throw new Error((data.message as string) || "Generation failed");
            }
          }
        }
      } catch (err) {
        clearDeadTimer();
        cancelReaderRef.current = null;
        if (signal.aborted) return "reconnect";
        if (
          err instanceof TypeError ||
          (err instanceof DOMException && err.name === "AbortError")
        ) {
          console.warn("[ChatPanel] Network stream error, will reconnect:", err);
          return "reconnect";
        }
        throw err;
      }
    },
    [subaccountId, setProject, commitFiles, resetDeadTimer, clearDeadTimer, setMessages]
  );

  // ---------------------------------------------------------------------------
  // Retry loop
  // ---------------------------------------------------------------------------
  const handleGenerateStream = useCallback(
    async (text: string, asstId: string, signal: AbortSignal) => {
      reconnectsRef.current = 0;
      bufferedFilesRef.current = [];
      activeProjectRef.current = projectId ?? null;
      activePromptRef.current = text;
      activeAsstIdRef.current = asstId;
      streamCompletedRef.current = false;

      while (true) {
        const result = await openStream(text, asstId, activeProjectRef.current, signal);
        if (result === "done") return;
        if (streamCompletedRef.current) return;
        if (signal.aborted) throw new DOMException("Aborted", "AbortError");

        reconnectsRef.current += 1;
        setReconnectCount(reconnectsRef.current);

        if (reconnectsRef.current > MAX_RECONNECTS) {
          throw new Error(`Stream lost after ${MAX_RECONNECTS} reconnects`);
        }

        console.warn(`[ChatPanel] Reconnect #${reconnectsRef.current}`);
        await new Promise((r) => setTimeout(r, RECONNECT_BASE_DELAY * reconnectsRef.current));
        if (signal.aborted) throw new DOMException("Aborted", "AbortError");
      }
    },
    [projectId, openStream]
  );

  // ---------------------------------------------------------------------------
  // Edit mode (non‑streaming)
  // ---------------------------------------------------------------------------
  const handleEditRequest = useCallback(
    async (text: string, asstId: string, signal: AbortSignal) => {
      const res = await fetch("/api/ai/edit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subaccountId, projectId, instructions: text }),
        signal,
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData?.error ?? `Edit API error: ${res.status}`);
      }

      const data = await res.json();
      if (!data?.files?.length) throw new Error("Edit returned no files");

      setFileCount(data.files.length);
      commitFiles(data.files, `Edit: ${text.slice(0, 40)}`, projectId);

      setIsGenerating(false);
      isGeneratingRef.current = false;
      setIsStreaming(false);
      setMessages((prev) =>
        prev.map((m) =>
          m.id === asstId
            ? { ...m, content: "__action:done__", status: "DONE" as const }
            : m
        )
      );
    },
    [subaccountId, projectId, commitFiles, setMessages]
  );

  // ---------------------------------------------------------------------------
  // Send handler
  // ---------------------------------------------------------------------------
  const handleSend = useCallback(async () => {
    const text = prompt.trim();
    if (!text || isGenerating) return;

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const deadlineTimer = setTimeout(() => controller.abort(), CLIENT_TIMEOUT_MS);

    setIsGenerating(true);
    isGeneratingRef.current = true;
    setIsStreaming(true);
    setFileCount(0);
    setReconnectCount(0);
    setPrompt("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";

    const userId = `u-${Date.now()}`;
    const asstId = `a-${Date.now()}`;

    // Add user message
    addMessage({
      id: userId,
      role: "USER",
      content: text,
      status: "DONE",
      createdAt: new Date().toISOString(),
    });

    // Add pending assistant message
    addMessage({
      id: asstId,
      role: "ASSISTANT",
      content: "__action:pending__",
      status: "PENDING",
      createdAt: new Date().toISOString(),
    });

    try {
      if (isEditMode) {
        await handleEditRequest(text, asstId, controller.signal);
      } else {
        await handleGenerateStream(text, asstId, controller.signal);
      }
    } catch (err: unknown) {
      const isAbort = err instanceof DOMException && err.name === "AbortError";
      if (!isAbort) console.error("[ChatPanel] Error:", err);

      clearDeadTimer();
      cancelReaderRef.current = null;
      setIsGenerating(false);
      isGeneratingRef.current = false;
      setIsStreaming(false);
      setMessages((prev) =>
        prev.map((m) =>
          m.id === asstId
            ? { ...m, content: "__action:error__", status: "ERROR" as const }
            : m
        )
      );
    } finally {
      clearTimeout(deadlineTimer);
    }
  }, [prompt, isGenerating, isEditMode, handleEditRequest, handleGenerateStream, clearDeadTimer, addMessage, setMessages]);

  // ---------------------------------------------------------------------------
  // Cancel generation
  // ---------------------------------------------------------------------------
  const handleCancel = useCallback(() => {
    abortRef.current?.abort();
    setIsGenerating(false);
    isGeneratingRef.current = false;
    setIsStreaming(false);
    toast.info("Generation cancelled");
  }, []);

  // ---------------------------------------------------------------------------
  // Clear conversation
  // ---------------------------------------------------------------------------
  const handleClear = useCallback(() => {
    if (isGenerating) {
      toast.error("Please wait for generation to finish");
      return;
    }
    clearMessages();
    toast.success("Conversation cleared");
  }, [clearMessages, isGenerating]);

  // ---------------------------------------------------------------------------
  // Retry last message
  // ---------------------------------------------------------------------------
  const handleRetry = useCallback(() => {
    const lastUserMsg = [...messages].reverse().find((m) => m.role === "USER");
    if (lastUserMsg && !isGenerating) {
      setPrompt(lastUserMsg.content);
      setTimeout(() => handleSend(), 50);
    }
  }, [messages, isGenerating, handleSend]);

  // ---------------------------------------------------------------------------
  // Keyboard handling
  // ---------------------------------------------------------------------------
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handlePromptChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setPrompt(e.target.value);
    e.target.style.height = "auto";
    e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px";
  };

  // ---------------------------------------------------------------------------
  // Visibility change handler (reconnect on tab focus)
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (
        document.visibilityState === "visible" &&
        isGeneratingRef.current &&
        abortRef.current &&
        !abortRef.current.signal.aborted
      ) {
        if (deadTimerRef.current) clearTimeout(deadTimerRef.current);
        deadTimerRef.current = setTimeout(() => {
          cancelReaderRef.current?.();
        }, SSE_DEAD_TIMEOUT_MS);
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, []);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  const displayMessages = messages.filter((m) => m.role !== "SYSTEM");

  return (
    <TooltipProvider>
      <div className="flex h-full flex-col overflow-hidden bg-background">
        {/* Header */}
        <div className="flex items-center justify-between border-b px-4 py-2.5 shrink-0">
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10">
              <Bot className="h-3.5 w-3.5 text-primary" />
            </div>
            <span className="text-sm font-medium">AI Builder</span>
            {isEditMode && (
              <Badge variant="outline" className="ml-1 text-[10px] py-0 h-5 border-fuchsia-500/30 text-fuchsia-400">
                <Pencil className="w-2.5 h-2.5 mr-0.5" />
                Edit mode
              </Badge>
            )}
          </div>

          <div className="flex items-center gap-1">
            {isGenerating && (
              <Badge variant="secondary" className="gap-1 text-[10px]">
                <Loader2 className="h-3 w-3 animate-spin" />
                {fileCount > 0 ? `${fileCount} files` : "Generating"}
                {reconnectCount > 0 && (
                  <span className="flex items-center gap-0.5 ml-1 text-yellow-600">
                    <WifiOff className="w-2.5 h-2.5" />
                    {reconnectCount}
                  </span>
                )}
              </Badge>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="text-xs">
                <DropdownMenuItem onClick={handleClear} disabled={isGenerating}>
                  <Trash2 className="mr-2 h-3.5 w-3.5" />
                  Clear conversation
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleRetry} disabled={isGenerating || displayMessages.length === 0}>
                  <RefreshCw className="mr-2 h-3.5 w-3.5" />
                  Retry last message
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Messages area */}
        <ScrollArea className="flex-1 min-h-0">
          {displayMessages.length === 0 ? (
            <EmptyState onSelect={setPrompt} disabled={isGenerating} />
          ) : (
            <div className="py-3 px-3 flex flex-col gap-2">
              <AnimatePresence initial={false}>
                {displayMessages.map((msg) => {
                  if (msg.content === "__action:pending__") {
                    return (
                      <ActionCard
                        key={msg.id}
                        status="pending"
                        label={isEditMode ? "Applying your changes…" : "Generating project…"}
                        reconnectCount={reconnectCount}
                        onCancel={isGenerating ? handleCancel : undefined}
                      />
                    );
                  }
                  if (msg.content === "__action:done__") {
                    return (
                      <ActionCard
                        key={msg.id}
                        status="done"
                        label={isEditMode ? "Changes applied" : "Project ready"}
                        fileCount={fileCount}
                      />
                    );
                  }
                  if (msg.content === "__action:error__") {
                    return (
                      <ActionCard
                        key={msg.id}
                        status="error"
                        label="Generation failed — please try again"
                      />
                    );
                  }
                  return (
                    <motion.div
                      key={msg.id}
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -5 }}
                      transition={{ duration: 0.15 }}
                    >
                      <ChatMessage message={msg} />
                    </motion.div>
                  );
                })}
              </AnimatePresence>
              <div ref={bottomRef} className="h-1" />
            </div>
          )}
        </ScrollArea>

        {/* Input area */}
        <div className="shrink-0 border-t p-3">
          <div className="flex items-end gap-2 rounded-xl border border-border bg-background px-3 py-2 focus-within:ring-1 focus-within:ring-ring transition-all">
            <Textarea
              ref={textareaRef}
              rows={1}
              value={prompt}
              onChange={handlePromptChange}
              onKeyDown={handleKeyDown}
              disabled={isGenerating}
              placeholder={
                isEditMode
                  ? "Describe the changes you want…"
                  : "Describe your app…"
              }
              className="flex-1 resize-none text-sm bg-transparent outline-none placeholder:text-muted-foreground disabled:opacity-50 min-h-[24px] max-h-[120px] p-0 border-0 focus-visible:ring-0"
            />
            {isGenerating ? (
              <Button
                variant="ghost"
                size="icon"
                className="shrink-0 h-7 w-7"
                onClick={handleCancel}
              >
                <StopCircle className="h-4 w-4" />
              </Button>
            ) : (
              <Button
                size="icon"
                className={cn(
                  "shrink-0 h-7 w-7 rounded-lg transition-all",
                  prompt.trim()
                    ? "bg-primary text-primary-foreground hover:opacity-90"
                    : "bg-muted text-muted-foreground opacity-50 cursor-not-allowed"
                )}
                onClick={handleSend}
                disabled={!prompt.trim()}
              >
                <Send className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
          <p className="mt-1.5 text-[10px] text-muted-foreground/50 text-center">
            <CornerDownLeft className="w-2.5 h-2.5 inline mr-0.5" />
            Enter to send · Shift+Enter for new line
          </p>
        </div>
      </div>
    </TooltipProvider>
  );
};

export default ChatPanel;
