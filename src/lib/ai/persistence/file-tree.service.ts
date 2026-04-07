// src/lib/ai/persistence/file-tree.service.ts
//
// FIX: Previous version used a module-level Map (in-memory).
// On serverless (Vercel/Next.js), each invocation may get a fresh module
// context — the map is empty. Now DB-backed via Prisma.

import { db } from "@/lib/db";
import type { AIFileNode } from "@/lib/ai/types/ai-project.types";

export class FileTreeService {
  // ── Save (replace all files) ───────────────────────────────────────────
  static async save(projectId: string, files: AIFileNode[]): Promise<void> {
    // Delete existing files then bulk-create
    await db.aIProjectFile.deleteMany({ where: { projectId } });
    if (files.length === 0) return;

    await db.aIProjectFile.createMany({
      data: files.map((f) => ({
        projectId,
        path:    f.path,
        content: f.content,
      })),
    });

    await db.aIProject.update({
      where: { id: projectId },
      data:  { updatedAt: new Date() },
    });
  }

  // ── Load ───────────────────────────────────────────────────────────────
  static async load(projectId: string): Promise<AIFileNode[]> {
    const rows = await db.aIProjectFile.findMany({
      where:   { projectId },
      orderBy: { path: "asc" },
      select:  { path: true, content: true },
    });

    return rows.map((r) => ({ path: r.path, content: r.content, type: "file" as const }));
  }

  // ── Upsert (update or create individual files) ─────────────────────────
  static async update(projectId: string, files: AIFileNode[]): Promise<void> {
    if (files.length === 0) return;

    await db.$transaction(
      files.map((f) =>
        db.aIProjectFile.upsert({
          where:  { projectId_path: { projectId, path: f.path } },
          update: { content: f.content },
          create: { projectId, path: f.path, content: f.content },
        })
      )
    );

    await db.aIProject.update({
      where: { id: projectId },
      data:  { updatedAt: new Date() },
    });
  }

  // ── Check existence ────────────────────────────────────────────────────
  static async exists(projectId: string): Promise<boolean> {
    const count = await db.aIProjectFile.count({ where: { projectId } });
    return count > 0;
  }

  // ── Delete a project's file tree ───────────────────────────────────────
  static async clear(projectId: string): Promise<void> {
    await db.aIProjectFile.deleteMany({ where: { projectId } });
  }
}