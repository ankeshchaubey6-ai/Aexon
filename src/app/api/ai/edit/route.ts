//==================== FILE: src/app/api/ai/edit/route.ts ====================

// src/app/api/ai/edit/route.ts
// ✅ FIXED: DB fallback when RAM store is empty after restart/cold start.
// Files are persisted to DB after every edit so they survive restarts.

import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { Role } from "@prisma/client";

import { getAuthUserDetails } from "@/queries/auth";
import { AIOrchestrator } from "@/lib/ai/engine/ai-orchestrator";
import { editProjectWithPipeline } from "@/lib/ai/llm/pipeline";
import { getAIProjectById, upsertAIProjectFiles } from "@/queries/ai-projects";
import { AIFileNode } from "@/lib/ai/types/ai-project.types";

export async function POST(req: NextRequest) {
  try {
    // ── Auth ─────────────────────────────────────────────────────────────
    const clerkUser = await currentUser();
    if (!clerkUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // ── Body ─────────────────────────────────────────────────────────────
    const body = await req.json();
    const { subaccountId, projectId, instructions } = body as {
      subaccountId?: string;
      projectId?: string;
      instructions?: string;
    };

    if (!subaccountId || !projectId || !instructions) {
      return NextResponse.json(
        { error: "Missing required fields: subaccountId, projectId, instructions" },
        { status: 400 }
      );
    }

    // ── Permission check ──────────────────────────────────────────────────
    const authUser = await getAuthUserDetails();
    if (!authUser) {
      return NextResponse.json({ error: "User not found" }, { status: 401 });
    }

    const role = clerkUser.privateMetadata.role as Role | undefined;
    const isOwnerOrAdmin =
      role === Role.AGENCY_OWNER || role === Role.AGENCY_ADMIN;

    if (!isOwnerOrAdmin) {
      const hasPermission = authUser.permissions.find(
        (p) => p.access && p.subAccountId === subaccountId
      );
      if (!hasPermission) {
        return NextResponse.json(
          { error: "No access to this subaccount" },
          { status: 403 }
        );
      }
    }

    // ── Load files: RAM first, DB fallback ────────────────────────────────
    let existingFiles: AIFileNode[] = [];

    try {
      existingFiles = AIOrchestrator.getProjectFiles(projectId);
      console.log(`✅ Loaded ${existingFiles.length} files from RAM for ${projectId}`);
    } catch {
      console.warn(`⚠️ RAM miss for ${projectId} — loading from DB`);

      const dbProject = await getAIProjectById(projectId);

      if (!dbProject || !dbProject.files.length) {
        return NextResponse.json(
          { error: "Project not found — please generate it first" },
          { status: 404 }
        );
      }

      existingFiles = dbProject.files.map(
        (f: { path: string; content: string }): AIFileNode => ({
          path: f.path,
          content: f.content,
          type: "file",
        })
      );

      // Re-hydrate RAM so subsequent calls in this server lifetime are fast
      AIOrchestrator.setProjectFiles(projectId, existingFiles);
      console.log(`✅ Re-hydrated RAM from DB: ${existingFiles.length} files`);
    }

    if (!existingFiles.length) {
      return NextResponse.json({ error: "Project has no files" }, { status: 404 });
    }

    // ── Edit pipeline ─────────────────────────────────────────────────────
    const updatedFiles = await editProjectWithPipeline(instructions, existingFiles);

    if (!updatedFiles || updatedFiles.length === 0) {
      return NextResponse.json(
        { error: "Edit pipeline returned no files" },
        { status: 500 }
      );
    }

    // ── Merge back into RAM ───────────────────────────────────────────────
    const merged = AIOrchestrator.updateProjectFiles(projectId, updatedFiles);

    // ── Persist merged files to DB ────────────────────────────────────────
    await upsertAIProjectFiles(
      projectId,
      merged.map((f: AIFileNode) => ({ path: f.path, content: f.content }))
    );

    // ── Diff summary ──────────────────────────────────────────────────────
    const editedPaths = updatedFiles
      .filter((f: AIFileNode) => {
        const original = existingFiles.find((e) => e.path === f.path);
        return !original || original.content !== f.content;
      })
      .map((f: AIFileNode) => f.path);

    return NextResponse.json({
      success: true,
      projectId,
      files: merged,
      editedFiles: editedPaths,
      message: `${editedPaths.length} file(s) updated`,
    });
  } catch (err) {
    console.error("❌ /api/ai/edit error:", err);
    return NextResponse.json(
      { error: "Failed to edit project" },
      { status: 500 }
    );
  }
}


