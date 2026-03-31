"use client";

// src/components/modules/ai-builder/chat/ChatPanel.tsx

import { useEffect, useRef, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { Sparkles, Bot } from "lucide-react";

import { useAIBuilderStore } from "../state/ai-builder.store";
import { useWebContainer } from "../state/use-webcontainer";
import ChatInput from "./ChatInput";
import ChatMessage, { type AIMessage } from "./ChatMessage";

const STARTERS = [
  "SaaS landing page with pricing table and hero",
  "Kanban board with drag and drop",
  "E-commerce store with cart and checkout",
  "Analytics dashboard with charts",
  "Blog with markdown support",
  "Portfolio with dark mode",
];

const ChatPanel = () => {
  const params = useParams();
  const subaccountId = params?.subaccountId as string;

  // ✅ FIXED: use individual selectors to avoid infinite re-render
  const projectId = useAIBuilderStore((s) => s.projectId);
  const storeFiles = useAIBuilderStore((s) => s.files);
  const setProject = useAIBuilderStore((s) => s.setProject);
  const setFiles = useAIBuilderStore((s) => s.setFiles);

  const { remount, mountAndRun, isRunning } = useWebContainer();

  const [messages, setMessages] = useState<AIMessage[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);
  // ✅ Keep a ref to the latest files so addFileToState doesn't go stale
  const filesRef = useRef(storeFiles);
  useEffect(() => { filesRef.current = storeFiles; }, [storeFiles]);

  // Auto scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  // ✅ FIXED: setFiles takes an array, not a callback
  const addFileToState = useCallback(
    (file: { path: string; content: string }) => {
      const prev = filesRef.current;
      const exists = prev.find((f) => f.path === file.path);
      if (exists) return;

      const updated = [...prev, { ...file, type: "file" as const }];
      setFiles(updated); // ✅ pass array directly

      // Mount/remount preview
      if (isRunning) {
        remount(updated);
      } else {
        mountAndRun(updated);
      }
    },
    [setFiles, isRunning, remount, mountAndRun]
  );

  const handleSend = useCallback(
    async (prompt: string) => {
      if (!prompt.trim() || isGenerating) return;

      setIsGenerating(true);

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
          content: "Generating your project...",
          status: "PENDING",
          createdAt: new Date().toISOString(),
        } as AIMessage,
      ]);

      try {
        const res = await fetch("/api/ai/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt, subAccountId: subaccountId }),
        });

        if (!res.ok) {
          throw new Error(`API error: ${res.status} ${res.statusText}`);
        }

        // ✅ Grab projectId from header before streaming
        const newProjectId = res.headers.get("x-project-id");
        if (newProjectId) {
          setProject(newProjectId);
        }

        const reader = res.body?.getReader();
        if (!reader) throw new Error("No stream body");

        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });

          // Split on double newline (SSE separator)
          const parts = buffer.split("\n\n");
          buffer = parts.pop() ?? ""; // keep incomplete chunk

          for (const part of parts) {
            const line = part.trim();
            if (!line.startsWith("data:")) continue;

            try {
              const json = line.slice(5).trim(); // strip "data: "
              const data = JSON.parse(json);

              if (data.type === "project") {
                setProject(data.projectId);
              }

              if (data.type === "file") {
                addFileToState(data.file);
              }

              if (data.type === "done") {
                setIsGenerating(false);
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === optAsstId
                      ? { ...m, content: "✅ Project generated! Preview is ready.", status: "DONE" }
                      : m
                  )
                );
              }

              if (data.type === "error") {
                throw new Error(data.message || "Generation failed");
              }
            } catch (parseErr) {
              console.warn("[ChatPanel] Failed to parse SSE chunk:", part, parseErr);
            }
          }
        }
      } catch (err) {
        console.error("[ChatPanel] Error:", err);
        setIsGenerating(false);
        setMessages((prev) =>
          prev.map((m) =>
            m.id === optAsstId
              ? { ...m, content: "❌ Generation failed. Please try again.", status: "ERROR" }
              : m
          )
        );
      }
    },
    [isGenerating, subaccountId, addFileToState, setProject]
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
          subAccountId={subaccountId}
          addFileToState={addFileToState}
        />
      </div>
    </div>
  );
};

export default ChatPanel;

// ── Empty State ────────────────────────────────────────────────────
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
            className="rounded-lg border bg-muted/30 px-3 py-2 text-left text-xs text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50"
          >
            {prompt}
          </button>
        ))}
      </div>
    </div>
  );
}