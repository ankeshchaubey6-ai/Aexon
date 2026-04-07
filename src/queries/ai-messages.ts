"use server";

// src/queries/ai-messages.ts
//
// FIX: Previous version used an in-memory global Map that was wiped on every
// serverless cold start (Vercel/Next.js functions have no persistent memory).
// Now fully DB-backed via Prisma — messages survive restarts and deploys.

import { db } from "@/lib/db";

export type AIMessage = {
  id: string;
  projectId: string;
  role: "USER" | "ASSISTANT";
  content: string;
  status: "PENDING" | "DONE" | "ERROR";
  filesGenerated?: number | null;
  createdAt: string;
};

// ── ADD MESSAGE ────────────────────────────────────────────────────────────────

export const addMessage = async (
  message: Omit<AIMessage, "id" | "createdAt">
): Promise<AIMessage> => {
  const created = await db.aIMessage.create({
    data: {
      projectId:      message.projectId,
      role:           message.role,
      content:        message.content,
      status:         message.status,
      filesGenerated: message.filesGenerated ?? null,
    },
  });

  return {
    id:             created.id,
    projectId:      created.projectId,
    role:           created.role as "USER" | "ASSISTANT",
    content:        created.content,
    status:         created.status as "PENDING" | "DONE" | "ERROR",
    filesGenerated: created.filesGenerated,
    createdAt:      created.createdAt.toISOString(),
  };
};

// ── GET MESSAGES ───────────────────────────────────────────────────────────────

export const getMessages = async (projectId: string): Promise<AIMessage[]> => {
  const rows = await db.aIMessage.findMany({
    where:   { projectId },
    orderBy: { createdAt: "asc" },
  });

  return rows.map((row) => ({
    id:             row.id,
    projectId:      row.projectId,
    role:           row.role as "USER" | "ASSISTANT",
    content:        row.content,
    status:         row.status as "PENDING" | "DONE" | "ERROR",
    filesGenerated: row.filesGenerated,
    createdAt:      row.createdAt.toISOString(),
  }));
};

// ── UPDATE MESSAGE STATUS ──────────────────────────────────────────────────────

export const updateMessageStatus = async (
  messageId: string,
  status: "PENDING" | "DONE" | "ERROR",
  content?: string,
  filesGenerated?: number
): Promise<void> => {
  await db.aIMessage.update({
    where: { id: messageId },
    data: {
      status,
      ...(content        !== undefined ? { content }        : {}),
      ...(filesGenerated !== undefined ? { filesGenerated } : {}),
    },
  });
};

// ── DELETE MESSAGES FOR PROJECT ────────────────────────────────────────────────

export const deleteProjectMessages = async (projectId: string): Promise<void> => {
  await db.aIMessage.deleteMany({ where: { projectId } });
};