// src/app/api/ai/projects/[projectId]/route.ts
// ✅ FIXED: Reads from DB with RAM re-hydration. Explicit types on callbacks.

import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { AIOrchestrator } from "@/lib/ai/engine/ai-orchestrator";
import { getAIProjectById } from "@/queries/ai-projects";
import { AIFileNode } from "@/lib/ai/types/ai-project.types";

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

    // Try RAM first
    try {
      const files = AIOrchestrator.getProjectFiles(projectId);
      return NextResponse.json({ project: { id: projectId, files } });
    } catch {
      // Fall back to DB
      const dbProject = await getAIProjectById(projectId);

      if (!dbProject) {
        return NextResponse.json({ error: "Project not found" }, { status: 404 });
      }

      const files: AIFileNode[] = dbProject.files.map(
        (f: { path: string; content: string }): AIFileNode => ({
          path: f.path,
          content: f.content,
          type: "file",
        })
      );

      // Re-hydrate RAM
      if (files.length) {
        AIOrchestrator.setProjectFiles(projectId, files);
      }

      return NextResponse.json({
        project: { id: dbProject.id, name: dbProject.name, files },
      });
    }
  } catch (err) {
    console.error("❌ GET /api/ai/projects/[projectId] error:", err);
    return NextResponse.json({ error: "Failed to load project" }, { status: 500 });
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

    AIOrchestrator.deleteProject(params.projectId);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("❌ DELETE /api/ai/projects/[projectId] error:", err);
    return NextResponse.json({ error: "Failed to delete project" }, { status: 500 });
  }
}