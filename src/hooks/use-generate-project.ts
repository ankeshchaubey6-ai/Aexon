"use client";

// src/hooks/use-generate-project.ts
//
// Replaces the old fetch() call to /api/ai/generate.
//
// OLD: fetch → wait for entire response → JSON.parse → set all files at once
//      Problem: browser kills connection after 45-60s with no response bytes
//
// NEW: SSE (EventSource/fetch with ReadableStream reader) → each file arrives
//      as it's generated → UI updates immediately, no timeout possible because
//      bytes are flowing continuously.
//
// Usage:
//   const { generate, isGenerating, progress } = useGenerateProject();
//   await generate({ subaccountId, prompt, name });

import { useCallback, useRef, useState } from "react";
import { useAIBuilderStore } from "@/components/modules/ai-builder/state/ai-builder.store";
import type { AIFileNode } from "@/lib/ai/types/ai-project.types";

interface GenerateOptions {
  subaccountId: string;
  prompt: string;
  name?: string;
  onProjectInit?: (projectId: string) => void;
  onFilesReady?: (files: AIFileNode[]) => void;
  onDone?: (fileCount: number) => void;
  onError?: (message: string) => void;
}

interface GenerateProgress {
  phase: "idle" | "planning" | "generating" | "fixing" | "done" | "error";
  filesReceived: number;
  totalEstimated: number;
  lastLog: string;
  projectId: string | null;
}

export function useGenerateProject() {
  const { setFiles, setProject } = useAIBuilderStore();
  const abortRef = useRef<AbortController | null>(null);

  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState<GenerateProgress>({
    phase: "idle",
    filesReceived: 0,
    totalEstimated: 12,
    lastLog: "",
    projectId: null,
  });

  const generate = useCallback(
    async (opts: GenerateOptions) => {
      const {
        subaccountId,
        prompt,
        name,
        onProjectInit,
        onFilesReady,
        onDone,
        onError,
      } = opts;

      // Cancel any in-flight generation
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setIsGenerating(true);
      setProgress({
        phase: "planning",
        filesReceived: 0,
        totalEstimated: 12,
        lastLog: "Planning project…",
        projectId: null,
      });

      // Accumulate files as they stream in
      const fileMap = new Map<string, AIFileNode>();

      const applyFiles = (provisional = false) => {
        const files = Array.from(fileMap.values());
        // Only push non-provisional to store during generation so WebContainer
        // isn't constantly restarted with half-built files
        if (!provisional) {
          setFiles(files, "Generated");
          onFilesReady?.(files);
        }
      };

      try {
        const res = await fetch("/api/ai/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ subaccountId, prompt, name }),
          signal: controller.signal,
        });

        if (!res.ok || !res.body) {
          const err = await res.text().catch(() => "Request failed");
          throw new Error(err);
        }

        // Read the SSE stream line by line
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });

          // SSE lines are separated by \n\n
          const parts = buffer.split("\n\n");
          buffer = parts.pop() ?? ""; // keep incomplete chunk

          for (const part of parts) {
            const line = part.trim();

            // SSE comment (heartbeat) — ignore
            if (line.startsWith(":")) continue;

            // SSE data line
            if (line.startsWith("data: ")) {
              const json = line.slice(6).trim();
              if (!json) continue;

              let event: Record<string, unknown>;
              try {
                event = JSON.parse(json);
              } catch {
                continue;
              }

              switch (event.type) {
                case "project_init": {
                  const pid = (event.projectId as string) ?? null;
                  if (pid) {
                    setProject(pid);
                    onProjectInit?.(pid);
                  }
                  setProgress((p) => ({
                    ...p,
                    projectId: pid,
                    lastLog: "Project created",
                  }));
                  break;
                }

                case "file": {
                  const path = event.path as string;
                  const content = event.content as string;
                  const provisional = (event.provisional as boolean) ?? false;

                  fileMap.set(path, { path, content, type: "file" });

                  // Push ALL files (incl provisional boilerplate) to store
                  // so WebContainer can boot immediately
                  setFiles(Array.from(fileMap.values()), "Streaming");

                  setProgress((p) => ({
                    ...p,
                    phase: provisional ? "generating" : "generating",
                    filesReceived: fileMap.size,
                    lastLog: `${provisional ? "⚡ boilerplate" : "📄"} ${path}`,
                  }));
                  break;
                }

                case "log": {
                  const msg = event.message as string;
                  // Infer phase from log messages
                  const phase =
                    msg.includes("[S1]") || msg.includes("Planning")
                      ? "planning"
                      : msg.includes("[S3") || msg.includes("fix")
                      ? "fixing"
                      : "generating";

                  setProgress((p) => ({
                    ...p,
                    phase,
                    lastLog: msg.replace(/^[🚀📦🧠📝✅⚡📄🔧⏳⏸️]\s*/, ""),
                  }));
                  break;
                }

                case "error": {
                  const msg = event.message as string;
                  setProgress((p) => ({ ...p, phase: "error", lastLog: msg }));
                  onError?.(msg);
                  break;
                }

                case "done": {
                  const finalFiles = Array.from(fileMap.values());
                  setFiles(finalFiles, "Generated");
                  applyFiles(false);
                  setProgress((p) => ({
                    ...p,
                    phase: "done",
                    filesReceived: fileMap.size,
                    lastLog: `Done — ${event.fileCount} files`,
                  }));
                  onDone?.(event.fileCount as number);
                  break;
                }
              }
            }
          }
        }

        // Stream ended — ensure store has final state
        const finalFiles = Array.from(fileMap.values());
        if (finalFiles.length) {
          setFiles(finalFiles, "Generated");
          onDone?.(finalFiles.length);
        }
      } catch (err: unknown) {
        if ((err as Error)?.name === "AbortError") {
          setProgress((p) => ({ ...p, phase: "idle", lastLog: "Cancelled" }));
        } else {
          const msg = (err as Error)?.message ?? "Generation failed";
          setProgress((p) => ({ ...p, phase: "error", lastLog: msg }));
          onError?.(msg);
        }
      } finally {
        setIsGenerating(false);
      }
    },
    [setFiles, setProject]
  );

  const cancel = useCallback(() => {
    abortRef.current?.abort();
    setIsGenerating(false);
    setProgress((p) => ({ ...p, phase: "idle" }));
  }, []);

  return { generate, cancel, isGenerating, progress };
}