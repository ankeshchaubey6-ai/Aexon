// src/lib/ai/types/ai-project.types.ts

export interface AIFileNode {
  path: string;
  content: string;
  type?: "file" | "folder";  // Made optional for backward compatibility
  children?: AIFileNode[];    // For folder support
}

export interface AIProject {
  id: string;
  name: string;
  subaccountId: string;
  files: AIFileNode[];
  createdAt: string;
  updatedAt?: string;         // Optional for projects that haven't been updated
}

export interface AIGeneratePayload {
  subaccountId: string;
  prompt: string;
  model?: string;             // Optional, defaults to configured model
  name?: string;              // Optional project name
}

export interface AIEditPayload {
  subaccountId: string;
  projectId: string;
  instructions: string;
  model?: string;             // Optional model override
}

export interface AIPreviewPayload {
  subaccountId: string;
  projectId: string;
}

// Project planning types
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

// Generation response types
export interface AIGenerationResponse {
  success: boolean;
  projectId?: string;
  files?: AIFileNode[];
  error?: string;
  fileCount?: number;
}

// Edit response types
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

// Preview response types
export interface AIPreviewResponse {
  success: boolean;
  url?: string;
  error?: string;
}

// Database types (for Prisma compatibility)
export interface DBAIProject {
  id: string;
  name: string;
  subaccountId: string;
  files: any; // JSON stored in database
  createdAt: Date;
  updatedAt: Date;
}

// Utility types
export type AIFileMap = Map<string, AIFileNode>;
export type AIProjectMap = Map<string, AIProject>;

// Error types
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

// Validation types
export interface AIFileValidation {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

// Constants
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