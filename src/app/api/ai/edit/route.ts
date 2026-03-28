// src/app/api/ai/edit/route.ts
//
// POST /api/ai/edit
// Runs the 3-stage edit pipeline on only the affected files.
//
//  Edit Stage 1 — kimi-k2-instruct   → identifies which files change
//  Edit Stage 2 — deepseek-v3.2      → rewrites them in parallel
//  Edit Stage 3 — phi-3.5-mini       → validates / fixes edited JSX
//
// Unchanged files are merged back from the existing project untouched.
// The result is hot-patchable via WebContainer HMR.
//

import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { Role } from "@prisma/client";

import { getAuthUserDetails } from "@/queries/auth";
import { AIOrchestrator } from "@/lib/ai/engine/ai-orchestrator";
import { editProjectWithPipeline } from "@/lib/ai/llm/pipeline";

export async function POST(req: NextRequest) {
  try {
    // ── Auth ────────────────────────────────────────────────────────────
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

    // ── Permission check ─────────────────────────────────────────────────
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

    // ── Load existing files from global store ────────────────────────────
    let existingFiles;
    try {
      existingFiles = AIOrchestrator.getProjectFiles(projectId);
    } catch {
      return NextResponse.json(
        { error: "Project not found — generate it first" },
        { status: 404 }
      );
    }

    if (!existingFiles || existingFiles.length === 0) {
      return NextResponse.json(
        { error: "Project has no files" },
        { status: 404 }
      );
    }

    // ── Edit pipeline — 3 stages ──────────────────────────────────────────
    //  kimi → identifies which files to change
    //  deepseek → rewrites them in parallel
    //  phi → validates / fixes edited JSX
    const updatedFiles = await editProjectWithPipeline(
      instructions,
      existingFiles
    );

    if (!updatedFiles || updatedFiles.length === 0) {
      return NextResponse.json(
        { error: "Edit pipeline returned no files" },
        { status: 500 }
      );
    }

    // ── Merge back into global store (safe upsert) ───────────────────────
    const merged = AIOrchestrator.updateProjectFiles(projectId, updatedFiles);

    // ── Diff summary for the client ───────────────────────────────────────
    const editedPaths = updatedFiles
      .filter((f) => {
        const original = existingFiles.find((e) => e.path === f.path);
        return !original || original.content !== f.content;
      })
      .map((f) => f.path);

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