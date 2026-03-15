// src/app/api/ai/export-zip/route.ts
import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { Role } from "@prisma/client";
import { getAuthUserDetails } from "@/queries/auth";

export async function POST(req: NextRequest) {
  try {
    const clerkUser = await currentUser();
    if (!clerkUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
      return NextResponse.json({ error: "User not found" }, { status: 401 });
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

    const downloadUrl = `/api/ai/export-zip/download?projectId=${projectId}`;

    return NextResponse.json({
      success: true,
      projectId,
      downloadUrl,
    });
  } catch (error) {
    console.error("AI Export ZIP Error:", error);
    return NextResponse.json(
      { error: "Failed to export zip" },
      { status: 500 }
    );
  }
}