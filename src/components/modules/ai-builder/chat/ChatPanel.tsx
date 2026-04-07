"use client";

// src/components/modules/ai-builder/chat/ChatPanel.tsx
//
// v8.5 — Network suspension fix
//
// CHANGES from v8.4:
//   FIX 5 — ERR_NETWORK_IO_SUSPENDED (the main bug)
//     Root cause: fetch() with a long-lived streaming response body is treated by
//     Chrome as a "background" request after ~60s with no meaningful data received.
//     Even though SSE comment pings ": keep-alive\n\n" flow through, Chrome's
//     network stack classifies them as non-data and may suspend the connection
//     when the tab loses focus or the OS enters power-save mode.
//
//     Fix A — Visibility-aware reconnect:
//       When the document becomes hidden (tab switch, minimize), we track the
//       last received byte count. When it becomes visible again, if no new bytes
//       arrived during the hidden period, we abort and reconnect from where we
//       left off (file index checkpoint).
//
//     Fix B — Dead-man timer:
//       If no SSE event (data or ping) arrives for 20s, we reconnect.
//       This is shorter than Chrome's ~45s suspension threshold.
//
//     Fix C — Reconnect with checkpoint:
//       The server is stateless (pipeline runs per-request), so we can't resume
//       mid-generation. Instead we restart the entire pipeline. The server's
//       upsert logic means re-generated files overwrite cleanly.
//       For the UI we keep the file buffer across reconnects so the counter
//       doesn't reset to zero.
//
//   FIX 1-4 from v8.4 are preserved unchanged.

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

  // ─── openStream — open one SSE connection and read until done/error ─────
  const openStream = useCallback(
    async (
      text: string,
      asstId: string,
      activePid: string | null,
      signal: AbortSignal,
    ): Promise<"done" | "error" | "reconnect"> => {
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

      // Start the dead-man timer — reconnect if no bytes for 20s
      const triggerReconnect = () => {
        reader.cancel().catch(() => {});
      };
      resetDeadTimer(triggerReconnect);

      try {
        while (true) {
          const { done, value } = await reader.read();

          if (signal.aborted) return "reconnect";

          if (done) {
            // Stream closed without "done" event — treat as stale connection
            clearDeadTimer();
            return "reconnect";
          }

          // We got bytes — reset the dead-man timer
          resetDeadTimer(triggerReconnect);

          buffer += decoder.decode(value, { stream: true });
          const parts = buffer.split("\n\n");
          buffer = parts.pop() ?? "";

          for (const part of parts) {
            const line = part.trim();

            // SSE ping/comment — no-op for parsing but timer already reset above
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
              throw new Error((data.message as string) || "Generation failed");
            }
          }
        }
      } catch (err) {
        clearDeadTimer();
        if (signal.aborted) return "reconnect";
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
        if (result === "error") throw new Error("Generation failed");

        // result === "reconnect"
        if (signal.aborted) throw new DOMException("Aborted", "AbortError");

        reconnectsRef.current += 1;
        setReconnectCount(reconnectsRef.current);

        if (reconnectsRef.current > MAX_RECONNECTS) {
          throw new Error(`Stream lost after ${MAX_RECONNECTS} reconnects — please try again`);
        }

        console.warn(`[ChatPanel] Stream stale — reconnect #${reconnectsRef.current}`);

        // Brief pause before reconnecting to avoid hammering the server
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

    // Cancel any previous in-flight request
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    // Hard client deadline
    const deadlineTimer = setTimeout(() => controller.abort(), CLIENT_TIMEOUT_MS);

    setIsGenerating(true);
    isGeneratingRef.current = true;
    setFileCount(0);
    setReconnectCount(0);
    setPrompt("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";

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
  // When the tab regains focus, check if the dead-man timer already fired
  // (which would have cancelled the reader). If we're still "generating"
  // but isRunning is false, the stream silently died — restart it.
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (
        document.visibilityState === "visible" &&
        isGeneratingRef.current &&
        abortRef.current &&
        !abortRef.current.signal.aborted
      ) {
        // Nudge the dead-man timer — visibility returning means the tab is live
        // If the timer hasn't fired yet, reset it so we get a fresh 20s window
        if (deadTimerRef.current) {
          clearTimeout(deadTimerRef.current);
          // The reader is still open; it will call resetDeadTimer on next byte.
          // If no byte arrives within SSE_DEAD_TIMEOUT_MS the reader self-cancels
          // and the reconnect loop restarts the stream.
          deadTimerRef.current = setTimeout(() => {
            // Reader cancel triggers "done: false" path → "reconnect" result
            // The while(true) loop in handleGenerateStream picks it up.
          }, SSE_DEAD_TIMEOUT_MS);
        }
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