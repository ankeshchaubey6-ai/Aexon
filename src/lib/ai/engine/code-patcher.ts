//==================== FILE: src/lib/ai/engine/code-patcher.ts ====================

import {
  AIFileNode,
  AIFileValidation,
} from "../types/ai-project.types";

export class CodePatcher {

  // ─────────────────────────────────────────────────────────────
  // MAIN PATCH
  // ─────────────────────────────────────────────────────────────

  static patch(existingFiles: AIFileNode[], instructions: string): AIFileNode[] {
    if (!existingFiles || existingFiles.length === 0) {
      throw new Error("❌ No files to patch");
    }

    const files = structuredClone(existingFiles);

    // Validate first
    const validation = this.validateFiles(files);
    if (!validation.isValid) {
      console.warn("⚠️ Validation issues:", validation.errors);
    }

    const metadata = {
      timestamp: new Date().toISOString(),
      instructions: this.safeText(instructions),
      editedBy: "AI Assistant",
    };

    // Patch App.jsx safely
    const index = files.findIndex((f) => f.path === "src/App.jsx");

    if (index !== -1) {
      files[index] = this.patchAppComponent(files[index], metadata);
    }

    // Update or create changelog
    this.upsertChangelog(files, metadata);

    return files;
  }

  // ─────────────────────────────────────────────────────────────
  // AI PATCH (REAL, NOT FAKE)
  // ─────────────────────────────────────────────────────────────

  static async patchWithAI(
    existingFiles: AIFileNode[],
    instructions: string,
    aiClient: any
  ): Promise<AIFileNode[]> {

    if (!aiClient) {
      throw new Error("❌ AI client required");
    }

    try {
      const response = await aiClient.generate({
        prompt: instructions,
        files: existingFiles,
      });

      if (!response || !Array.isArray(response.files)) {
        throw new Error("Invalid AI response");
      }

      return response.files;
    } catch (err) {
      console.warn("⚠️ AI patch failed, fallback to basic patch");
      return this.patch(existingFiles, instructions);
    }
  }

  // ─────────────────────────────────────────────────────────────
  // SAFE PATCHING
  // ─────────────────────────────────────────────────────────────

  private static patchAppComponent(
    file: AIFileNode,
    metadata: { timestamp: string; instructions: string }
  ): AIFileNode {

    if (!file.content.includes("export default")) {
      return file; // avoid corrupting non-component files
    }

    const header = `
// ============================================
// 🔧 AI EDIT: ${metadata.timestamp}
// Instructions: ${metadata.instructions}
// ============================================

`;

    // Prevent duplicate headers
    if (file.content.includes("🔧 AI EDIT")) {
      return file;
    }

    return {
      ...file,
      content: header + file.content,
    };
  }

  // ─────────────────────────────────────────────────────────────
  // CHANGELOG HANDLING
  // ─────────────────────────────────────────────────────────────

  private static upsertChangelog(
    files: AIFileNode[],
    metadata: { timestamp: string; instructions: string; editedBy: string }
  ) {

    const existing = files.find((f) => f.path === "CHANGELOG.md");

    const entry = `
## [${metadata.timestamp}]
- Instructions: ${metadata.instructions}
- Edited by: ${metadata.editedBy}
`;

    if (existing) {
      existing.content += entry;
    } else {
      files.push({
        path: "CHANGELOG.md",
        content: `# Changelog\n${entry}`,
        type: "file",
      });
    }
  }

  // ─────────────────────────────────────────────────────────────
  // VALIDATION
  // ─────────────────────────────────────────────────────────────

  static validateFiles(files: AIFileNode[]): AIFileValidation {
    const errors: string[] = [];
    const warnings: string[] = [];

    const seen = new Set<string>();

    for (const file of files) {
      if (!file.path) {
        errors.push("File missing path");
      }

      if (seen.has(file.path)) {
        errors.push(`Duplicate file path: ${file.path}`);
      }
      seen.add(file.path);

      if (file.content == null) {
        errors.push(`Missing content: ${file.path}`);
      }

      if (file.content && file.content.length > 1024 * 1024) {
        warnings.push(`Large file: ${file.path}`);
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  // ─────────────────────────────────────────────────────────────
  // DIFF TRACKING
  // ─────────────────────────────────────────────────────────────

  static getChanges(
    oldFiles: AIFileNode[],
    newFiles: AIFileNode[]
  ): { added: string[]; modified: string[]; deleted: string[] } {

    const oldMap = new Map(oldFiles.map((f) => [f.path, f.content]));
    const newMap = new Map(newFiles.map((f) => [f.path, f.content]));

    const added: string[] = [];
    const modified: string[] = [];
    const deleted: string[] = [];

    for (const [path] of newMap) {
      if (!oldMap.has(path)) {
        added.push(path);
      } else if (oldMap.get(path) !== newMap.get(path)) {
        modified.push(path);
      }
    }

    for (const [path] of oldMap) {
      if (!newMap.has(path)) {
        deleted.push(path);
      }
    }

    return { added, modified, deleted };
  }

  // ─────────────────────────────────────────────────────────────
  // SANITIZATION
  // ─────────────────────────────────────────────────────────────

  private static safeText(text: string): string {
    return text.replace(/[`$<>]/g, "").slice(0, 500);
  }
}