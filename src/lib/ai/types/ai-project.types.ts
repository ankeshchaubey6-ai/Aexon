// src/lib/ai/types/ai-project.types.ts
export interface AIFileNode {
  path: string;
  content: string;
  type: "file" | "folder";
}

export interface AIProject {
  id: string;
  name: string;
  subaccountId: string;
  files: AIFileNode[];
  createdAt: string;
  updatedAt?: string;
}

export interface AIGeneratePayload {
  subaccountId: string;
  prompt: string;
  model?: string;
}

export interface AIEditPayload {
  subaccountId: string;
  projectId: string;
  instructions: string;
}

export interface AIPreviewPayload {
  subaccountId: string;
  projectId: string;
}
// src/lib/ai/types/ai-project.types.ts
export interface AIFileNode {
  path: string;
  content: string;
}

export interface AIProject {
  id: string;
  name: string;
  subaccountId: string;
  files: AIFileNode[];
  createdAt: string;
}