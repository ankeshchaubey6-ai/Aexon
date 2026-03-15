// src/app/api/ai/edit/route.ts (UPDATED - real patch flow)
import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { Role } from "@prisma/client";
import { getAuthUserDetails } from "@/queries/auth";
import { AIOrchestrator } from "@/lib/ai/engine/ai-orchestrator";

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
    const { subaccountId, projectId, instructions } = body as {
      subaccountId?: string;
      projectId?: string;
      instructions?: string;
    };

    if (!subaccountId || !projectId || !instructions) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const authUser = await getAuthUserDetails();
    if (!authUser) {
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

    const updatedFiles = AIOrchestrator.editProject(
      projectId,
      instructions
    );

    return NextResponse.json({
      success: true,
      projectId,
      files: updatedFiles,
    });
  } catch (error) {
    console.error("AI Edit Error:", error);
    return NextResponse.json(
      { error: "Failed to edit project" },
      { status: 500 }
    );
  }
}