"use client";

import { create } from "zustand";
import { AIFileNode } from "@/lib/ai/types/ai-project.types";

type Message = {
  role: "user" | "assistant";
  content: string;
};

interface AIBuilderState {
  projectId: string | null;
  files: AIFileNode[];
  activeFilePath: string | null;
  messages: Message[];

  setProject: (id: string) => void;
  setFiles: (files: AIFileNode[]) => void;
  setActiveFile: (path: string) => void;
  updateFile: (path: string, content: string) => void;

  addMessage: (msg: Message) => void;
  reset: () => void;
}

export const useAIBuilderStore = create<AIBuilderState>((set, get) => ({
  projectId: null,
  files: [],
  activeFilePath: null,
  messages: [],

  setProject: (id) =>
    set({
      projectId: id,
    }),

  setFiles: (files) =>
    set({
      files,
      activeFilePath: files.length ? files[0].path : null,
    }),

  setActiveFile: (path) =>
    set({
      activeFilePath: path,
    }),

  updateFile: (path, content) => {
    const { files } = get();

    const updated = files.map((file) =>
      file.path === path ? { ...file, content } : file
    );

    set({ files: updated });
  },

  addMessage: (msg) =>
    set((state) => ({
      messages: [...state.messages, msg],
    })),

  reset: () =>
    set({
      projectId: null,
      files: [],
      activeFilePath: null,
      messages: [],
    }),
}));