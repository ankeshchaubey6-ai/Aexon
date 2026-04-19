"use client";

// src/components/modules/ai-builder/state/ai-builder.store.ts
// Enhanced store with full message support (AIMessage), undo/redo, and project persistence.

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { AIFileNode } from "@/lib/ai/types/ai-project.types";

// -----------------------------------------------------------------------------
// Message type (compatible with ChatMessage component)
// -----------------------------------------------------------------------------
export type AIMessage = {
  id: string;
  role: "USER" | "ASSISTANT" | "SYSTEM";
  content: string;
  status: "PENDING" | "DONE" | "ERROR";
  createdAt: string;
};

// A saved snapshot for undo/redo
type Snapshot = {
  files: AIFileNode[];
  label: string;
};

interface AIBuilderState {
  // Project
  projectId: string | null;
  files: AIFileNode[];
  activeFilePath: string | null;

  // Tracks the label of the last setFiles() call so LivePreview
  // can distinguish "Loaded from DB" (it should boot) from
  // "Generated / Edit" (ChatPanel already called mountAndRun — skip).
  lastCommitLabel: string;

  // Chat messages (full AIMessage objects)
  messages: AIMessage[];

  // Undo / Redo stacks
  undoStack: Snapshot[];
  redoStack: Snapshot[];
  canUndo: boolean;
  canRedo: boolean;

  // Actions
  setProject: (id: string) => void;
  setFiles: (files: AIFileNode[], label?: string) => void;
  setActiveFile: (path: string | null) => void;
  updateFile: (path: string, content: string) => void;
  
  // Message actions (support both partial and full AIMessage)
  addMessage: (msg: Partial<AIMessage> & { role: AIMessage["role"]; content: string }) => void;
  updateMessage: (id: string, updates: Partial<AIMessage>) => void;
  setMessages: (messages: AIMessage[] | ((prev: AIMessage[]) => AIMessage[])) => void;
  clearMessages: () => void;
  
  // History actions
  undo: () => void;
  redo: () => void;
  reset: () => void;
}

const MAX_HISTORY = 30;
const MAX_STORED_MESSAGES = 50; // Keep last 50 messages in localStorage

// Helper to generate unique IDs
const generateId = () => `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

export const useAIBuilderStore = create<AIBuilderState>()(
  persist(
    (set, get) => ({
      projectId: null,
      files: [],
      activeFilePath: null,
      lastCommitLabel: "",
      messages: [],
      undoStack: [],
      redoStack: [],
      canUndo: false,
      canRedo: false,

      setProject: (id) => set({ projectId: id }),

      setFiles: (files, label = "Updated files") => {
        const { files: prev, undoStack } = get();
        const newUndo: Snapshot[] = [
          ...undoStack.slice(-(MAX_HISTORY - 1)),
          { files: prev, label },
        ];
        set({
          files,
          lastCommitLabel: label,
          activeFilePath: files.length > 0 ? files[0].path : null,
          undoStack: newUndo,
          redoStack: [],
          canUndo: newUndo.length > 0,
          canRedo: false,
        });
      },

      setActiveFile: (path) => set({ activeFilePath: path }),

      updateFile: (path, content) => {
        const { files, undoStack } = get();
        const editLabel = `Edited ${path.split("/").pop()}`;
        const newUndo: Snapshot[] = [
          ...undoStack.slice(-(MAX_HISTORY - 1)),
          { files, label: editLabel },
        ];
        const updated = files.map((f) =>
          f.path === path ? { ...f, content } : f
        );
        set({
          files: updated,
          lastCommitLabel: editLabel,
          undoStack: newUndo,
          redoStack: [],
          canUndo: true,
          canRedo: false,
        });
      },

      addMessage: (msg) => {
        const fullMessage: AIMessage = {
          id: msg.id || generateId(),
          role: msg.role,
          content: msg.content,
          status: msg.status || "DONE",
          createdAt: msg.createdAt || new Date().toISOString(),
        };
        set((state) => ({
          messages: [...state.messages, fullMessage],
        }));
      },

      updateMessage: (id, updates) => {
        set((state) => ({
          messages: state.messages.map((m) =>
            m.id === id ? { ...m, ...updates } : m
          ),
        }));
      },

      setMessages: (messages) => {
        set((state) => ({
          messages:
            typeof messages === "function"
              ? messages(state.messages)
              : messages,
        }));
      },

      clearMessages: () => set({ messages: [] }),

      undo: () => {
        const { undoStack, redoStack, files } = get();
        if (!undoStack.length) return;
        const snapshot = undoStack[undoStack.length - 1];
        const newUndo = undoStack.slice(0, -1);
        const newRedo: Snapshot[] = [
          ...redoStack,
          { files, label: snapshot.label },
        ];
        set({
          files: snapshot.files,
          lastCommitLabel: `Undo: ${snapshot.label}`,
          activeFilePath:
            snapshot.files.length > 0 ? snapshot.files[0].path : null,
          undoStack: newUndo,
          redoStack: newRedo,
          canUndo: newUndo.length > 0,
          canRedo: true,
        });
      },

      redo: () => {
        const { undoStack, redoStack, files } = get();
        if (!redoStack.length) return;
        const snapshot = redoStack[redoStack.length - 1];
        const newRedo = redoStack.slice(0, -1);
        const newUndo: Snapshot[] = [
          ...undoStack,
          { files, label: snapshot.label },
        ];
        set({
          files: snapshot.files,
          lastCommitLabel: `Redo: ${snapshot.label}`,
          activeFilePath:
            snapshot.files.length > 0 ? snapshot.files[0].path : null,
          undoStack: newUndo,
          redoStack: newRedo,
          canUndo: true,
          canRedo: newRedo.length > 0,
        });
      },

      reset: () =>
        set({
          projectId: null,
          files: [],
          activeFilePath: null,
          lastCommitLabel: "",
          messages: [],
          undoStack: [],
          redoStack: [],
          canUndo: false,
          canRedo: false,
        }),
    }),
    {
      name: "ai-builder-storage",
      partialize: (state) => ({
        projectId: state.projectId,
        files: state.files,
        messages: state.messages.slice(-MAX_STORED_MESSAGES),
        // We don't persist undo/redo stacks across sessions (they're ephemeral)
      }),
    }
  )
);