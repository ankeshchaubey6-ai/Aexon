// src/app/api/ai/preview/route.ts (UPDATED - real sandbox render)
import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { Role } from "@prisma/client";
import { getAuthUserDetails } from "@/queries/auth";
import { AIOrchestrator } from "@/lib/ai/engine/ai-orchestrator";
import { renderPreview } from "@/lib/ai/preview/preview-renderer";

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
    const { subaccountId, projectId } = body as {
      subaccountId?: string;
      projectId?: string;
    };

    if (!subaccountId || !projectId) {
      return NextResponse.json(
        { error: "Missing subaccountId or projectId" },
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

    const files = AIOrchestrator.getProjectFiles(projectId);

    const preview = await renderPreview(projectId, files);

    return NextResponse.json({
      success: true,
      previewUrl: preview.url,
      status: preview.status,
    });
  } catch (error) {
    console.error("AI Preview Error:", error);
    return NextResponse.json(
      { error: "Failed to generate preview" },
      { status: 500 }
    );
  }
}