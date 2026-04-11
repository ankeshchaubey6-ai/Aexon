"use client";

// src/components/modules/ai-builder/chat/ChatPanel.tsx
//
// v8.7 — Strict stream/execution phase separation
//
// CHANGES from v8.6:
//   - Added streamCompletedRef to prevent reconnect after stream finishes
//   - In "done" event: set streamCompletedRef = true, abort reader, wait 200ms,
//     then call commitFiles
//   - Reconnect loop now returns early if streamCompletedRef is true
//   - Reset streamCompletedRef on new send

import { useEffect, useRef, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import {
  Sparkles, Bot, Pencil, CheckCircle2, XCircle,
  Loader2, Send, CornerDownLeft, WifiOff,
} from "lucide-react";
import { cn } from "@/lib/utils";

import { useAIBuilderStore } from "../state/ai-builder.store";
import { useWebContainer } from "../state/use-webcontainer";
import ChatMessage, { type AIMessage } from "./ChatMessage";

// Must be >= route GENERATION_TIMEOUT_MS (1 800 000 ms = 30 min)
const CLIENT_TIMEOUT_MS = 31 * 60 * 1000;

// If no SSE event arrives within this window, reconnect.
// Must be < Chrome's ~45s network-suspension threshold.
const SSE_DEAD_TIMEOUT_MS = 20_000;

// Max reconnect attempts before giving up and showing an error.
const MAX_RECONNECTS = 8;

const STARTERS = [
  "SaaS landing page with pricing table and hero",
  "Kanban board with drag and drop",
  "E-commerce store with cart and checkout",
  "Analytics dashboard with charts",
  "Blog with markdown support",
  "Portfolio with dark mode",
];

// ─── Action Card ───────────────────────────────────────────────────────────────
function ActionCard({
  status,
  label,
  fileCount,
  reconnectCount,
}: {
  status: "pending" | "done" | "error";
  label: string;
  fileCount?: number;
  reconnectCount?: number;
}) {
  if (status === "pending") {
    return (
      <div className="flex flex-col gap-1 px-3 py-2 rounded-xl bg-yellow-500/10 border border-yellow-500/20 text-xs text-yellow-400">
        <div className="flex items-center gap-2">
          <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
          <span>{label}</span>
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

// ─── Main ChatPanel ────────────────────────────────────────────────────────────
const ChatPanel = () => {
  const params = useParams();
  const subaccountId = params?.subaccountId as string;

  const projectId  = useAIBuilderStore((s) => s.projectId);
  const storeFiles = useAIBuilderStore((s) => s.files);
  const setProject = useAIBuilderStore((s) => s.setProject);
  const setFiles   = useAIBuilderStore((s) => s.setFiles);

  const { remount, mountAndRun, isRunning } = useWebContainer();

  const [messages, setMessages]             = useState<AIMessage[]>([]);
  const [isGenerating, setIsGenerating]     = useState(false);
  const [prompt, setPrompt]                 = useState("");
  const [fileCount, setFileCount]           = useState(0);
  const [reconnectCount, setReconnectCount] = useState(0);

  const bottomRef   = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Stable ref so callbacks always read current files without stale closure.
  const filesRef = useRef(storeFiles);
  useEffect(() => { filesRef.current = storeFiles; }, [storeFiles]);

  // Active AbortController for the current in-flight SSE request.
  const abortRef = useRef<AbortController | null>(null);

  // Cancel on unmount.
  useEffect(() => {
    return () => { abortRef.current?.abort(); };
  }, []);

  // Refs shared between the stream loop and reconnect logic.
  const isGeneratingRef  = useRef(false);
  const reconnectsRef    = useRef(0);
  const bufferedFilesRef = useRef<{ path: string; content: string }[]>([]);
  const activePromptRef  = useRef<string>("");
  const activeAsstIdRef  = useRef<string>("");
  const activeProjectRef = useRef<string | null>(null);
  const deadTimerRef     = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ─── FIX 2: cancelReaderRef ────────────────────────────────────────────────
  // Holds a reference to the current reader's cancel function so the
  // visibilitychange handler can trigger a reconnect by cancelling the reader,
  // which causes reader.read() to resolve with done:true → "reconnect" return.
  const cancelReaderRef = useRef<(() => void) | null>(null);

  // v8.7: Stream completion flag to prevent reconnect after done.
  const streamCompletedRef = useRef(false);

  const isEditMode = !!(projectId && storeFiles.length > 0);

  // Auto-scroll to latest message.
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  const handlePromptChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setPrompt(e.target.value);
    e.target.style.height = "auto";
    e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px";
  };

  // ─── commitFiles — single owner of WebContainer trigger ─────────────────
  const commitFiles = useCallback(
    (
      incoming: { path: string; content: string }[],
      promptLabel: string,
      activePid: string | null,
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
        remount(merged);
      } else {
        mountAndRun(merged);
      }
    },
    [setFiles, isRunning, remount, mountAndRun],
  );

  // ─── resetDeadTimer — restart the 20s watchdog ──────────────────────────
  // Called on every SSE byte (data or ping). If it fires, the connection is
  // considered stale and we reconnect.
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

  // ─── openStream — open one SSE connection and read until done/reconnect ──
  //
  // FIX 3: Return type is "done" | "reconnect" only. Errors that should be
  // fatal are thrown; errors that indicate a stale/suspended connection
  // return "reconnect" so the retry loop handles them gracefully.
  const openStream = useCallback(
    async (
      text: string,
      asstId: string,
      activePid: string | null,
      signal: AbortSignal,
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
      signal.addEventListener("abort", () => { reader.cancel().catch(() => {}); });

      const decoder = new TextDecoder();
      let buffer = "";

      // triggerReconnect cancels the reader, which causes the next
      // reader.read() call to resolve with { done: true } → "reconnect".
      const triggerReconnect = () => {
        reader.cancel().catch(() => {});
      };

      // ─── FIX 2: expose triggerReconnect to the visibilitychange handler ──
      cancelReaderRef.current = triggerReconnect;

      // Start the dead-man timer.
      resetDeadTimer(triggerReconnect);

      try {
        while (true) {
          const { done, value } = await reader.read();

          if (signal.aborted) {
            cancelReaderRef.current = null;
            return "reconnect";
          }

          if (done) {
            // Stream closed without a "done" SSE event — stale connection.
            clearDeadTimer();
            cancelReaderRef.current = null;
            return "reconnect";
          }

          // Got bytes — reset the dead-man timer.
          resetDeadTimer(triggerReconnect);

          buffer += decoder.decode(value, { stream: true });
          const parts = buffer.split("\n\n");
          buffer = parts.pop() ?? "";

          for (const part of parts) {
            const line = part.trim();

            // SSE ping/comment — timer already reset above, nothing to parse.
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

              // v8.7: Mark stream completed, abort reader, and wait before execution.
              streamCompletedRef.current = true;
              abortRef.current?.abort();
              await new Promise((r) => setTimeout(r, 200));

              const activePidFinal = activeProjectRef.current ?? activePid;
              commitFiles(bufferedFilesRef.current, `Generated: ${text.slice(0, 40)}`, activePidFinal);
              setIsGenerating(false);
              isGeneratingRef.current = false;
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === asstId
                    ? { ...m, content: "__action:done__", status: "DONE" as const }
                    : m,
                ),
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

        // ─── FIX 1: treat network-level errors as reconnectable ────────────
        //
        // Chrome's ERR_NETWORK_IO_SUSPENDED surfaces as:
        //   TypeError: "network error"          (fetch/stream kill)
        //   DOMException name="AbortError"      (reader.cancel() resolving)
        //
        // Neither is a true application error. Return "reconnect" so the
        // retry loop restarts the pipeline instead of surfacing a fatal error.
        if (
          err instanceof TypeError ||
          (err instanceof DOMException && err.name === "AbortError")
        ) {
          console.warn("[ChatPanel] Network-level stream error — will reconnect:", err);
          return "reconnect";
        }

        // Any other error (e.g. JSON parse of an error payload, API 500) is
        // genuinely fatal and should propagate to handleGenerateStream.
        throw err;
      }
    },
    [subaccountId, setProject, commitFiles, resetDeadTimer, clearDeadTimer],
  );

  // ─── handleGenerateStream — retry loop with reconnect logic ─────────────
  const handleGenerateStream = useCallback(
    async (text: string, asstId: string, signal: AbortSignal) => {
      reconnectsRef.current = 0;
      bufferedFilesRef.current = [];
      activeProjectRef.current = projectId ?? null;
      activePromptRef.current  = text;
      activeAsstIdRef.current  = asstId;

      while (true) {
        const result = await openStream(text, asstId, activeProjectRef.current, signal);

        if (result === "done") return;

        // v8.7: If stream already completed, stop reconnect loop.
        if (streamCompletedRef.current) {
          console.log("[ChatPanel] Stream already completed — stopping reconnect");
          return;
        }

        // result === "reconnect"
        if (signal.aborted) throw new DOMException("Aborted", "AbortError");

        reconnectsRef.current += 1;
        setReconnectCount(reconnectsRef.current);

        if (reconnectsRef.current > MAX_RECONNECTS) {
          throw new Error(`Stream lost after ${MAX_RECONNECTS} reconnects — please try again`);
        }

        console.warn(`[ChatPanel] Stream stale — reconnect #${reconnectsRef.current}`);

        // Brief back-off before reconnecting to avoid hammering the server.
        await new Promise((r) => setTimeout(r, 1500 * reconnectsRef.current));

        if (signal.aborted) throw new DOMException("Aborted", "AbortError");
      }
    },
    [projectId, openStream],
  );

  // ─── handleEditRequest ────────────────────────────────────────────────────
  const handleEditRequest = useCallback(
    async (text: string, optAsstId: string, signal: AbortSignal) => {
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

      const count: number = data.files.length;
      setFileCount(count);
      commitFiles(data.files, `Edit: ${text.slice(0, 40)}`, projectId);

      setIsGenerating(false);
      isGeneratingRef.current = false;
      setMessages((prev) =>
        prev.map((m) =>
          m.id === optAsstId
            ? { ...m, content: "__action:done__", status: "DONE" as const }
            : m,
        ),
      );
    },
    [subaccountId, projectId, commitFiles],
  );

  // ─── handleSend ───────────────────────────────────────────────────────────
  const handleSend = useCallback(async () => {
    const text = prompt.trim();
    if (!text || isGenerating) return;

    // Cancel any previous in-flight request.
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    // Hard client deadline.
    const deadlineTimer = setTimeout(() => controller.abort(), CLIENT_TIMEOUT_MS);

    setIsGenerating(true);
    isGeneratingRef.current = true;
    setFileCount(0);
    setReconnectCount(0);
    setPrompt("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";

    // v8.7: Reset stream completion flag for new request.
    streamCompletedRef.current = false;

    const optUserId = `u-${Date.now()}`;
    const optAsstId = `a-${Date.now()}`;

    setMessages((prev) => [
      ...prev,
      {
        id: optUserId,
        role: "USER",
        content: text,
        status: "DONE",
        createdAt: new Date().toISOString(),
      } as AIMessage,
      {
        id: optAsstId,
        role: "ASSISTANT",
        content: "__action:pending__",
        status: "PENDING",
        createdAt: new Date().toISOString(),
      } as AIMessage,
    ]);

    try {
      if (isEditMode) {
        await handleEditRequest(text, optAsstId, controller.signal);
      } else {
        await handleGenerateStream(text, optAsstId, controller.signal);
      }
    } catch (err: unknown) {
      const isAbort = err instanceof DOMException && err.name === "AbortError";
      if (!isAbort) console.error("[ChatPanel] Error:", err);

      clearDeadTimer();
      cancelReaderRef.current = null;
      setIsGenerating(false);
      isGeneratingRef.current = false;
      setMessages((prev) =>
        prev.map((m) =>
          m.id === optAsstId
            ? { ...m, content: "__action:error__", status: "ERROR" as const }
            : m,
        ),
      );
    } finally {
      clearTimeout(deadlineTimer);
    }
  }, [prompt, isGenerating, isEditMode, handleEditRequest, handleGenerateStream, clearDeadTimer]);

  // ─── Visibility-based reconnect ───────────────────────────────────────────
  //
  // FIX 2 (continued): When the tab becomes visible again after being hidden,
  // schedule a dead-man timeout that actually calls cancelReaderRef.current()
  // if no bytes arrive. reader.cancel() causes reader.read() to resolve with
  // { done: true }, which openStream returns as "reconnect", which
  // handleGenerateStream picks up and restarts the pipeline.
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (
        document.visibilityState === "visible" &&
        isGeneratingRef.current &&
        abortRef.current &&
        !abortRef.current.signal.aborted
      ) {
        // Clear any existing dead-man timer and set a fresh one.
        // If no SSE bytes arrive within SSE_DEAD_TIMEOUT_MS, cancel the reader
        // to trigger the reconnect path.
        if (deadTimerRef.current) clearTimeout(deadTimerRef.current);

        // ─── FIX 2: was () => {} (empty) — now actually cancels the reader ──
        deadTimerRef.current = setTimeout(() => {
          cancelReaderRef.current?.();
        }, SSE_DEAD_TIMEOUT_MS);
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const isEmpty = messages.length === 0;

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 border-b px-4 py-2.5 shrink-0">
        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10">
          <Bot className="h-3.5 w-3.5 text-primary" />
        </div>
        <span className="text-sm font-medium">AI Builder</span>

        {isEditMode && (
          <span className="ml-1 flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-fuchsia-500/15 border border-fuchsia-500/25 text-fuchsia-400">
            <Pencil className="w-2.5 h-2.5" />
            Edit mode
          </span>
        )}

        {isGenerating && (
          <span className="ml-auto flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="h-1.5 w-1.5 rounded-full bg-yellow-500 animate-pulse" />
            {fileCount > 0 ? `${fileCount} files…` : "Generating…"}
            {reconnectCount > 0 && (
              <span className="text-yellow-600/70 flex items-center gap-0.5">
                <WifiOff className="w-3 h-3" />
                {reconnectCount}
              </span>
            )}
          </span>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {isEmpty ? (
          <EmptyState
            onSelect={(s) => {
              setPrompt(s);
              textareaRef.current?.focus();
            }}
            disabled={isGenerating}
          />
        ) : (
          <div className="py-2 px-3 flex flex-col gap-2">
            {messages.map((msg) => {
              if (msg.content === "__action:pending__") {
                return (
                  <ActionCard
                    key={msg.id}
                    status="pending"
                    label={isEditMode ? "Applying your changes…" : "Generating project…"}
                    reconnectCount={reconnectCount}
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
              return <ChatMessage key={msg.id} message={msg} />;
            })}
            <div ref={bottomRef} className="h-1" />
          </div>
        )}
      </div>

      {/* Input */}
      <div className="shrink-0 border-t p-3">
        <div className="flex items-end gap-2 rounded-xl border border-border bg-background px-3 py-2 focus-within:ring-1 focus-within:ring-ring transition-all">
          <textarea
            ref={textareaRef}
            rows={1}
            value={prompt}
            onChange={handlePromptChange}
            onKeyDown={handleKeyDown}
            disabled={isGenerating}
            placeholder={
              isEditMode ? "Describe the changes you want…" : "Describe your app…"
            }
            className="flex-1 resize-none text-sm bg-transparent outline-none placeholder:text-muted-foreground disabled:opacity-50 min-h-[24px] max-h-[120px]"
          />
          <button
            onClick={handleSend}
            disabled={!prompt.trim() || isGenerating}
            className={cn(
              "shrink-0 w-7 h-7 flex items-center justify-center rounded-lg transition-all",
              prompt.trim() && !isGenerating
                ? "bg-primary text-primary-foreground hover:opacity-90"
                : "bg-muted text-muted-foreground opacity-50 cursor-not-allowed",
            )}
          >
            {isGenerating
              ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
              : <Send className="w-3.5 h-3.5" />}
          </button>
        </div>
        <p className="mt-1.5 text-[10px] text-muted-foreground/50 text-center">
          <CornerDownLeft className="w-2.5 h-2.5 inline mr-0.5" />
          Enter to send · Shift+Enter for new line
        </p>
      </div>
    </div>
  );
};

export default ChatPanel;

// ── Empty State ────────────────────────────────────────────────────────────────
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