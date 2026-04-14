// src/app/api/ai/projects/[projectId]/route.ts
//
// ROOT CAUSE OF 400 ERROR: This file did not exist.
// Next.js returned 400 for every GET /api/ai/projects/:id because there
// was no handler — AIWorkspace saw 400, logged "not found — new project",
// reset the store, and LivePreview lost the previous session on every load.
//
// Fix: DB-first load with files included. No RAM dependency (AIOrchestrator
// is not always populated on cold starts / serverless).

import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import type { AIFileNode } from "@/lib/ai/types/ai-project.types";

export async function GET(
  _req: NextRequest,
  { params }: { params: { projectId: string } }
) {
  try {
    const clerkUser = await currentUser();
    if (!clerkUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { projectId } = params;
    if (!projectId) {
      return NextResponse.json({ error: "Missing projectId" }, { status: 400 });
    }

    const dbProject = await db.aIProject.findUnique({
      where: { id: projectId },
      include: {
        files: {
          select: { path: true, content: true },
          orderBy: { path: "asc" },
        },
      },
    });

    if (!dbProject) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const files: AIFileNode[] = dbProject.files.map(
      (f): AIFileNode => ({ path: f.path, content: f.content, type: "file" })
    );

    console.log(`[GET /api/ai/projects/${projectId}] Loaded ${files.length} files from DB:`);
    files.forEach((f) => console.log(`  - ${f.path}`));

    return NextResponse.json({
      project: {
        id:          dbProject.id,
        name:        dbProject.name,
        description: dbProject.description,
        createdAt:   dbProject.createdAt,
        updatedAt:   dbProject.updatedAt,
        files,
      },
    });
  } catch (err) {
    console.error("❌ [GET /api/ai/projects/[projectId]]", err);
    return NextResponse.json({ error: "Failed to load project" }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { projectId: string } }
) {
  try {
    const clerkUser = await currentUser();
    if (!clerkUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { name, description } = body as { name?: string; description?: string };

    const updated = await db.aIProject.update({
      where: { id: params.projectId },
      data: {
        ...(name !== undefined        && { name: name.trim() }),
        ...(description !== undefined && { description }),
      },
      select: { id: true, name: true, description: true, updatedAt: true },
    });

    return NextResponse.json({ success: true, project: updated });
  } catch (err) {
    console.error("❌ [PATCH /api/ai/projects/[projectId]]", err);
    return NextResponse.json({ error: "Failed to update project" }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { projectId: string } }
) {
  try {
    const clerkUser = await currentUser();
    if (!clerkUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await db.aIProject.delete({ where: { id: params.projectId } });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("❌ [DELETE /api/ai/projects/[projectId]]", err);
    return NextResponse.json({ error: "Failed to delete project" }, { status: 500 });
  }
}