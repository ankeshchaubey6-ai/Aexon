// src/lib/ai/validation/syntax-checker.ts
import { AIFileNode } from "../types/ai-project.types";

export const checkSyntax = (files: AIFileNode[]) => {
  const errors: { path: string; message: string }[] = [];

  files.forEach((file) => {
    if (file.type === "file" && !file.content) {
      errors.push({
        path: file.path,
        message: "File content is empty",
      });
    }
  });

  return errors;
};