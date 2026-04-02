"use client";

// src/components/modules/ai-builder/chat/ChatPanel.tsx

import { useEffect, useRef, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import {
  Sparkles, Bot, Pencil, CheckCircle2, XCircle,
  Loader2, Send, CornerDownLeft,
} from "lucide-react";
import { cn } from "@/lib/utils";

import { useAIBuilderStore } from "../state/ai-builder.store";
import { useWebContainer } from "../state/use-webcontainer";
import ChatMessage, { type AIMessage } from "./ChatMessage";

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
}: {
  status: "pending" | "done" | "error";
  label: string;
  fileCount?: number;
}) {
  if (status === "pending") {
    return (
      <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-yellow-500/10 border border-yellow-500/20 text-xs text-yellow-400">
        <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
        <span>{label}</span>
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
            <span className="ml-1 opacity-60">· {fileCount} file{fileCount !== 1 ? "s" : ""} written</span>
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

  const projectId   = useAIBuilderStore((s) => s.projectId);
  const storeFiles  = useAIBuilderStore((s) => s.files);
  const setProject  = useAIBuilderStore((s) => s.setProject);
  const setFiles    = useAIBuilderStore((s) => s.setFiles);

  const { remount, mountAndRun, isRunning } = useWebContainer();

  const [messages, setMessages]         = useState<AIMessage[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [prompt, setPrompt]             = useState("");
  const [fileCount, setFileCount]       = useState(0);

  const bottomRef   = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Keep a stable ref to storeFiles so callbacks don't go stale.
  const filesRef = useRef(storeFiles);
  useEffect(() => { filesRef.current = storeFiles; }, [storeFiles]);

  const isEditMode = !!(projectId && storeFiles.length > 0);

  // Auto scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  // Auto-grow textarea
  const handlePromptChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setPrompt(e.target.value);
    e.target.style.height = "auto";
    e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px";
  };

  // ─── Commit all buffered files to the store + preview in ONE update ─────────
  // Called only after all files have arrived (onDone / edit response).
  // This prevents LivePreview from seeing partial file sets and avoids
  // the Vite "cannot resolve import X" race condition.
  const commitFiles = useCallback(
    (incoming: { path: string; content: string }[], promptLabel: string) => {
      const prev = filesRef.current;

      // Merge incoming into previous file list (upsert by path)
      let updated = [...prev];
      for (const file of incoming) {
        const idx = updated.findIndex((f) => f.path === file.path);
        if (idx >= 0) {
          updated[idx] = { ...updated[idx], content: file.content };
        } else {
          updated.push({ path: file.path, content: file.content, type: "file" as const });
        }
      }

      setFiles(updated, promptLabel);

      // Trigger preview with the complete merged file set
      if (isRunning) {
        remount(updated);
      } else {
        mountAndRun(updated);
      }
    },
    [setFiles, isRunning, remount, mountAndRun]
  );

  // ─── Handle Send ───────────────────────────────────────────────────────────
  const handleSend = useCallback(async () => {
    const text = prompt.trim();
    if (!text || isGenerating) return;

    setIsGenerating(true);
    setFileCount(0);
    setPrompt("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }

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
        // ── Edit mode: plain JSON response ─────────────────────────────
        await handleEditRequest(text, optAsstId);
      } else {
        // ── Generate mode: SSE stream ──────────────────────────────────
        await handleGenerateStream(text, optAsstId);
      }
    } catch (err) {
      console.error("[ChatPanel] Error:", err);
      setIsGenerating(false);
      setMessages((prev) =>
        prev.map((m) =>
          m.id === optAsstId
            ? { ...m, content: "__action:error__", status: "ERROR" }
            : m
        )
      );
    }
  }, [prompt, isGenerating, isEditMode, subaccountId, projectId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Edit request (JSON) ───────────────────────────────────────────────────
  const handleEditRequest = useCallback(
    async (text: string, optAsstId: string) => {
      const res = await fetch("/api/ai/edit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subaccountId,
          projectId,
          instructions: text,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData?.error ?? `Edit API error: ${res.status}`);
      }

      const data = await res.json();

      if (!data?.files?.length) {
        throw new Error("Edit returned no files");
      }

      const count: number = data.files.length;
      setFileCount(count);

      // Commit all files at once — no partial preview
      commitFiles(data.files, `Edit: ${text.slice(0, 40)}`);

      setIsGenerating(false);
      setMessages((prev) =>
        prev.map((m) =>
          m.id === optAsstId
            ? { ...m, content: "__action:done__", status: "DONE" }
            : m
        )
      );
    },
    [subaccountId, projectId, commitFiles]
  );

  // ─── Generate stream (SSE) ─────────────────────────────────────────────────
  const handleGenerateStream = useCallback(
    async (text: string, optAsstId: string) => {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: text, subAccountId: subaccountId }),
      });

      if (!res.ok) throw new Error(`API error: ${res.status}`);

      const newProjectId = res.headers.get("x-project-id");
      if (newProjectId) setProject(newProjectId);

      const reader = res.body?.getReader();
      if (!reader) throw new Error("No stream body");

      const decoder = new TextDecoder();
      let buffer = "";

      // Buffer all files locally — only commit to store/preview after "done"
      const bufferedFiles: { path: string; content: string }[] = [];
      let count = 0;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split("\n\n");
        buffer = parts.pop() ?? "";

        for (const part of parts) {
          const line = part.trim();
          if (!line.startsWith("data:")) continue;

          try {
            const data = JSON.parse(line.slice(5).trim());

            if (data.type === "project") {
              setProject(data.projectId);
            }

            if (data.type === "file") {
              // Accumulate into local buffer, NOT into the store yet.
              // This way LivePreview never sees a partial file set.
              count++;
              setFileCount(count); // update the "X files..." counter in the header
              bufferedFiles.push(data.file);
            }

            if (data.type === "done") {
              // All files have arrived — commit everything at once
              commitFiles(bufferedFiles, `Generated: ${text.slice(0, 40)}`);
              setIsGenerating(false);
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === optAsstId
                    ? { ...m, content: "__action:done__", status: "DONE" }
                    : m
                )
              );
            }

            if (data.type === "error") {
              throw new Error(data.message || "Generation failed");
            }
          } catch (parseErr) {
            console.warn("[ChatPanel] SSE parse error:", parseErr);
          }
        }
      }
    },
    [subaccountId, setProject, commitFiles]
  );

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
          </span>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {isEmpty ? (
          <EmptyState
            onSelect={(s) => { setPrompt(s); textareaRef.current?.focus(); }}
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
            placeholder={isEditMode ? "Describe the changes you want…" : "Describe your app…"}
            className="flex-1 resize-none text-sm bg-transparent outline-none placeholder:text-muted-foreground disabled:opacity-50 min-h-[24px] max-h-[120px]"
          />
          <button
            onClick={handleSend}
            disabled={!prompt.trim() || isGenerating}
            className={cn(
              "shrink-0 w-7 h-7 flex items-center justify-center rounded-lg transition-all",
              prompt.trim() && !isGenerating
                ? "bg-primary text-primary-foreground hover:opacity-90"
                : "bg-muted text-muted-foreground opacity-50 cursor-not-allowed"
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