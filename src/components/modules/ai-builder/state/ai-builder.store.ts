"use client";

// src/components/modules/ai-builder/state/ai-builder.store.ts
// UPGRADED: undo/redo history stack, session messages separate from archived history

import { create } from "zustand";
import { AIFileNode } from "@/lib/ai/types/ai-project.types";

type Message = {
  role: "user" | "assistant";
  content: string;
};

// A saved snapshot for undo/redo
type Snapshot = {
  files: AIFileNode[];
  label: string; // e.g. "Applied: dark mode"
};

interface AIBuilderState {
  // Project
  projectId: string | null;
  files: AIFileNode[];
  activeFilePath: string | null;

  // Current session messages (cleared when session archived)
  messages: Message[];

  // Undo / Redo stacks
  undoStack: Snapshot[];
  redoStack: Snapshot[];
  canUndo: boolean;
  canRedo: boolean;

  // Actions
  setProject: (id: string) => void;

  /**
   * setFiles — replaces all files and pushes a snapshot onto the undo stack.
   * @param files - new file array
   * @param label - human-readable label for the undo entry (e.g. prompt summary)
   */
  setFiles: (files: AIFileNode[], label?: string) => void;

  setActiveFile: (path: string) => void;

  /**
   * updateFile — patch a single file's content in-place, also undo-able.
   */
  updateFile: (path: string, content: string) => void;

  addMessage: (msg: Message) => void;
  clearMessages: () => void;

  undo: () => void;
  redo: () => void;

  reset: () => void;
}

const MAX_HISTORY = 30;

export const useAIBuilderStore = create<AIBuilderState>((set, get) => ({
  projectId: null,
  files: [],
  activeFilePath: null,
  messages: [],
  undoStack: [],
  redoStack: [],
  canUndo: false,
  canRedo: false,

  setProject: (id) => set({ projectId: id }),

  setFiles: (files, label = "Updated files") => {
    const { files: prev, undoStack } = get();

    // Push current state onto undo stack (cap at MAX_HISTORY)
    const newUndo: Snapshot[] = [
      ...undoStack.slice(-(MAX_HISTORY - 1)),
      { files: prev, label },
    ];

    set({
      files,
      activeFilePath: files.length ? files[0].path : null,
      undoStack: newUndo,
      redoStack: [], // new change clears redo
      canUndo: newUndo.length > 0,
      canRedo: false,
    });
  },

  setActiveFile: (path) => set({ activeFilePath: path }),

  updateFile: (path, content) => {
    const { files, undoStack } = get();
    const newUndo: Snapshot[] = [
      ...undoStack.slice(-(MAX_HISTORY - 1)),
      { files, label: `Edited ${path.split("/").pop()}` },
    ];
    const updated = files.map((f) => (f.path === path ? { ...f, content } : f));
    set({
      files: updated,
      undoStack: newUndo,
      redoStack: [],
      canUndo: true,
      canRedo: false,
    });
  },

  addMessage: (msg) =>
    set((state) => ({ messages: [...state.messages, msg] })),

  clearMessages: () => set({ messages: [] }),

  undo: () => {
    const { undoStack, redoStack, files } = get();
    if (!undoStack.length) return;

    const snapshot = undoStack[undoStack.length - 1];
    const newUndo = undoStack.slice(0, -1);
    const newRedo: Snapshot[] = [...redoStack, { files, label: snapshot.label }];

    set({
      files: snapshot.files,
      activeFilePath: snapshot.files.length ? snapshot.files[0].path : null,
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
    const newUndo: Snapshot[] = [...undoStack, { files, label: snapshot.label }];

    set({
      files: snapshot.files,
      activeFilePath: snapshot.files.length ? snapshot.files[0].path : null,
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
      messages: [],
      undoStack: [],
      redoStack: [],
      canUndo: false,
      canRedo: false,
    }),
}));