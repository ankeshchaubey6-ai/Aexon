// src/lib/ai/validation/build-simulator.ts
import { AIFileNode } from "../types/ai-project.types";

export const simulateBuild = (files: AIFileNode[]) => {
  if (!files.length) {
    return {
      success: false,
      logs: ["No files to build"],
    };
  }

  return {
    success: true,
    logs: ["Build simulated successfully"],
  };
};