// src/app/api/ai/projects/[projectId]/route.ts

import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { db } from "@/lib/db";

// GET /api/ai/projects/:projectId
// Called by ChatPanel after generation completes — loads saved files into the store
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

    const project = await db.aIProject.findUnique({
      where: { id: projectId },
      include: {
        files: {
          select: { path: true, content: true },
          orderBy: { path: "asc" },
        },
      },
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      project: {
        id: project.id,
        name: project.name,
        description: project.description,
        createdAt: project.createdAt,
        updatedAt: project.updatedAt,
        // Normalize to { path, content } — same shape as AIFileNode
        files: project.files.map((f) => ({ path: f.path, content: f.content })),
      },
    });
  } catch (err) {
    console.error("[GET /api/ai/projects/:projectId]", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

// PATCH /api/ai/projects/:projectId
// Optional: rename or update description
export async function PATCH(
  req: NextRequest,
  { params }: { params: { projectId: string } }
) {
  try {
    const clerkUser = await currentUser();
    if (!clerkUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { projectId } = params;
    const body = await req.json();
    const { name, description } = body as { name?: string; description?: string };

    const updated = await db.aIProject.update({
      where: { id: projectId },
      data: {
        ...(name ? { name: name.trim() } : {}),
        ...(description !== undefined ? { description } : {}),
        updatedAt: new Date(),
      },
      select: { id: true, name: true, description: true, updatedAt: true },
    });

    return NextResponse.json({ success: true, project: updated });
  } catch (err) {
    console.error("[PATCH /api/ai/projects/:projectId]", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

// DELETE /api/ai/projects/:projectId
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { projectId: string } }
) {
  try {
    const clerkUser = await currentUser();
    if (!clerkUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { projectId } = params;
    await db.aIProject.delete({ where: { id: projectId } });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[DELETE /api/ai/projects/:projectId]", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}