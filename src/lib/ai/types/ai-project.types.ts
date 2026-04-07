// src/lib/ai/types/ai-project.types.ts

// ─────────────────────────────────────────────────────────────────────────────
// 🔥 CORE FILE TYPE (THIS WAS MISSING — REQUIRED BY ENGINE)
// ─────────────────────────────────────────────────────────────────────────────

export type AIFile = {
  path: string;
  content: string;
};

// ─────────────────────────────────────────────────────────────────────────────
// 📁 FILE TREE STRUCTURE
// ─────────────────────────────────────────────────────────────────────────────

export interface AIFileNode {
  path: string;
  content: string;
  type?: "file" | "folder";
  children?: AIFileNode[];
}

// ─────────────────────────────────────────────────────────────────────────────
// 🧠 PROJECT TYPES
// ─────────────────────────────────────────────────────────────────────────────

export interface AIProject {
  id: string;
  name: string;
  subaccountId: string;
  files: AIFileNode[];
  createdAt: string;
  updatedAt?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// 📦 REQUEST PAYLOADS
// ─────────────────────────────────────────────────────────────────────────────

export interface AIGeneratePayload {
  subaccountId: string;
  prompt: string;
  model?: string;
  name?: string;
}

export interface AIEditPayload {
  subaccountId: string;
  projectId: string;
  instructions: string;
  model?: string;
}

export interface AIPreviewPayload {
  subaccountId: string;
  projectId: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// 🧠 PROJECT PLANNING
// ─────────────────────────────────────────────────────────────────────────────

export interface AIProjectPlan {
  projectName: string;
  description: string;
  pages: string[];
  components: string[];
  features: string[];
  uiRequirements: string[];
  styling: string;
  functionality: string[];
  interactivity?: string[];
  complexity?: "simple" | "medium" | "complex";
  dependencies?: string[];
}

// ─────────────────────────────────────────────────────────────────────────────
// 📤 RESPONSES
// ─────────────────────────────────────────────────────────────────────────────

export interface AIGenerationResponse {
  success: boolean;
  projectId?: string;
  files?: AIFileNode[];
  error?: string;
  fileCount?: number;
}

export interface AIEditResponse {
  success: boolean;
  projectId?: string;
  files?: AIFileNode[];
  error?: string;
  changes?: {
    added: string[];
    modified: string[];
    deleted: string[];
  };
}

export interface AIPreviewResponse {
  success: boolean;
  url?: string;
  error?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// 🗄️ DATABASE TYPES
// ─────────────────────────────────────────────────────────────────────────────

export interface DBAIProject {
  id: string;
  name: string;
  subaccountId: string;
  files: any;
  createdAt: Date;
  updatedAt: Date;
}

// ─────────────────────────────────────────────────────────────────────────────
// 🧰 UTILITY TYPES
// ─────────────────────────────────────────────────────────────────────────────

export type AIFileMap = Map<string, AIFileNode>;
export type AIProjectMap = Map<string, AIProject>;

// ─────────────────────────────────────────────────────────────────────────────
// ❌ ERROR HANDLING
// ─────────────────────────────────────────────────────────────────────────────

export class AIProjectError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 500
  ) {
    super(message);
    this.name = "AIProjectError";
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// ✅ VALIDATION TYPES
// ─────────────────────────────────────────────────────────────────────────────

export interface AIFileValidation {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

// ─────────────────────────────────────────────────────────────────────────────
// ⚙️ CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

export const ALLOWED_FILE_EXTENSIONS = [
  ".js",
  ".jsx",
  ".ts",
  ".tsx",
  ".css",
  ".scss",
  ".html",
  ".json",
  ".md",
] as const;

export const MAX_FILE_SIZE = 1024 * 1024; // 1MB
export const MAX_FILES_PER_PROJECT = 100;
export const MAX_PROJECT_NAME_LENGTH = 100;