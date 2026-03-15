// src/app/api/ai/generate/route.ts (UPDATED - wired with orchestrator)
import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { Role } from "@prisma/client";
import { getAuthUserDetails } from "@/queries/auth";
import { AIOrchestrator } from "@/lib/ai/engine/ai-orchestrator";
import { createAIProject } from "@/queries/ai-projects";

export async function POST(req: NextRequest) {
  try {
    const clerkUser = await currentUser();
    if (!clerkUser) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { subaccountId, prompt, name } = body as {
      subaccountId?: string;
      prompt?: string;
      name?: string;
    };

    if (!subaccountId || !prompt) {
      return NextResponse.json(
        { error: "Missing subaccountId or prompt" },
        { status: 400 }
      );
    }

    const authUser = await getAuthUserDetails();
    if (!authUser || !authUser.agency) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 401 }
      );
    }

    const role = clerkUser.privateMetadata.role as Role | undefined;
    const isOwnerOrAdmin =
      role === Role.AGENCY_OWNER || role === Role.AGENCY_ADMIN;

    if (!isOwnerOrAdmin) {
      const hasPermission = authUser.permissions.find(
        (permission) =>
          permission.access &&
          permission.subAccountId === subaccountId
      );

      if (!hasPermission) {
        return NextResponse.json(
          { error: "No access to this subaccount" },
          { status: 403 }
        );
      }
    }

    const projectId = crypto.randomUUID();

    const files = AIOrchestrator.createProject(
      projectId,
      prompt
    );

    await createAIProject({
      id: projectId,
      name: name || "AI Project",
      subaccountId,
      files,
      createdAt: new Date().toISOString(),
    });

    return NextResponse.json({
      success: true,
      projectId,
      files,
    });
  } catch (error) {
    console.error("AI Generate Error:", error);
    return NextResponse.json(
      { error: "Failed to generate project" },
      { status: 500 }
    );
  }
}