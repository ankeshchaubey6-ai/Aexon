"use client";

import {
  useEffect,
  useRef,
  useState,
  useCallback,
  useTransition,
} from "react";
import { useParams, useRouter } from "next/navigation";
import { Sparkles, Bot } from "lucide-react";

import { useAIBuilderStore } from "../state/ai-builder.store";
import { useWebContainer } from "../state/use-webcontainer";
import ChatInput from "./ChatInput";
import ChatMessage, { type AIMessage } from "./ChatMessage";

// ─────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────
const POLL_INTERVAL_MS = 2500;

const STARTERS = [
  "SaaS landing page with pricing table and hero",
  "Kanban board with drag and drop",
  "E-commerce store with cart and checkout",
  "Analytics dashboard with charts",
  "Blog with markdown support",
  "Portfolio with dark mode",
];

// ─────────────────────────────────────────────────────────────
// CHAT PANEL
// ─────────────────────────────────────────────────────────────
const ChatPanel = () => {
  const params = useParams();
  const router = useRouter();
  const subaccountId = params?.subaccountId as string;

  const { projectId, setProject, setFiles } = useAIBuilderStore();
  const { remount, mountAndRun, isRunning } = useWebContainer();

  const [messages, setMessages] = useState<AIMessage[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [, startTransition] = useTransition();

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const hasPendingRef = useRef(false);
  const prevFileCountRef = useRef(0);
  const bottomRef = useRef<HTMLDivElement>(null);

  const routeProjectId = params?.projectId as string | undefined;
  const effectiveProjectId =
    projectId ||
    (routeProjectId && routeProjectId !== "new" ? routeProjectId : null);

  // ── Auto-scroll ──────────────────────────────────────────
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  // ── Load project files from DB ───────────────────────────
  const loadProjectFiles = useCallback(
    async (pid: string) => {
      try {
        const res = await fetch(`/api/ai/projects/${pid}`);
        if (!res.ok) return;
        const data = await res.json();
        const newFiles = data?.project?.files ?? [];
        if (!newFiles.length) return;
        if (newFiles.length === prevFileCountRef.current) return;
        prevFileCountRef.current = newFiles.length;
        setFiles(newFiles);
        if (isRunning) {
          remount(newFiles);
        } else {
          mountAndRun(newFiles);
        }
      } catch (err) {
        console.error("File load error:", err);
      }
    },
    [isRunning, remount, mountAndRun, setFiles]
  );

  // ── Poll messages ────────────────────────────────────────
  const pollMessages = useCallback(async () => {
    if (!effectiveProjectId) return;
    try {
      const res = await fetch(
        `/api/ai/messages?projectId=${effectiveProjectId}`
      );
      if (!res.ok) return;
      const data = await res.json();
      const fetched: AIMessage[] = data.messages ?? [];

      startTransition(() => setMessages(fetched));

      const hasPending = fetched.some((m) => m.status === "PENDING");

      if (hasPendingRef.current && !hasPending) {
        hasPendingRef.current = false;
        setIsGenerating(false);
        await loadProjectFiles(effectiveProjectId);
      }

      hasPendingRef.current = hasPending;
    } catch (err) {
      console.error("Poll error:", err);
    }
  }, [effectiveProjectId, loadProjectFiles]);

  useEffect(() => {
    if (!effectiveProjectId) return;
    pollMessages();
    pollRef.current = setInterval(pollMessages, POLL_INTERVAL_MS);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [effectiveProjectId, pollMessages]);

  // ── Send message ─────────────────────────────────────────
  const handleSend = useCallback(
    async (prompt: string) => {
      if (!prompt.trim() || isGenerating) return;

      setIsGenerating(true);
      hasPendingRef.current = true;

      const optUserId = `opt-user-${Date.now()}`;
      const optAsstId = `opt-asst-${Date.now()}`;

      setMessages((prev) => [
        ...prev,
        {
          id: optUserId,
          role: "USER",
          content: prompt,
          status: "DONE",
          createdAt: new Date().toISOString(),
        } as AIMessage,
        {
          id: optAsstId,
          role: "ASSISTANT",
          content: "Planning and generating your project...",
          status: "PENDING",
          createdAt: new Date().toISOString(),
        } as AIMessage,
      ]);

      try {
        const res = await fetch("/api/ai/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt: prompt.trim(),
            projectId: effectiveProjectId || "new",
            subaccountId,
          }),
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err?.error || `HTTP ${res.status}`);
        }

        const data = await res.json();

        if (data.isNewProject && data.projectId) {
          setProject(data.projectId);
          router.replace(
            `/subaccount/${subaccountId}/ai-builder/${data.projectId}`
          );
        }
        // Polling picks up the result — nothing else needed here

      } catch (err) {
        setIsGenerating(false);
        hasPendingRef.current = false;
        setMessages((prev) =>
          prev.map((m) =>
            m.id === optAsstId
              ? {
                  ...m,
                  content: `Failed: ${err instanceof Error ? err.message : "Unknown error"}`,
                  status: "ERROR" as const,
                }
              : m
          )
        );
      }
    },
    [effectiveProjectId, subaccountId, isGenerating, setProject, router]
  );

  const isEmpty = messages.length === 0;

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 border-b px-4 py-2.5 shrink-0">
        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10">
          <Bot className="h-3.5 w-3.5 text-primary" />
        </div>
        <span className="text-sm font-medium">AI Builder</span>
        {isGenerating && (
          <span className="ml-auto flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="h-1.5 w-1.5 rounded-full bg-yellow-500 animate-pulse" />
            Generating...
          </span>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {isEmpty ? (
          <EmptyState onSelect={handleSend} disabled={isGenerating} />
        ) : (
          <div className="py-2">
            {messages.map((msg) => (
              <ChatMessage key={msg.id} message={msg} />
            ))}
            <div ref={bottomRef} className="h-1" />
          </div>
        )}
      </div>

      {/* Input */}
      <div className="shrink-0 border-t p-3">
        <ChatInput
          onSend={handleSend}
          isLoading={isGenerating}
          disabled={!subaccountId}
          placeholder={
            effectiveProjectId ? "Request a change..." : "Describe your app..."
          }
        />
      </div>
    </div>
  );
};

export default ChatPanel;

// ─────────────────────────────────────────────────────────────
// EMPTY STATE
// ─────────────────────────────────────────────────────────────
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
        {STARTERS.map((prompt) => (
          <button
            key={prompt}
            onClick={() => onSelect(prompt)}
            disabled={disabled}
            className="rounded-lg border bg-muted/30 px-3 py-2 text-left text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
          >
            {prompt}
          </button>
        ))}
      </div>
    </div>
  );
}