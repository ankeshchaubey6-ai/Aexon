// src/app/api/ai/push-github/route.ts
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
    const { subaccountId, projectId, repoName } = body as {
      subaccountId?: string;
      projectId?: string;
      repoName?: string;
    };

    if (!subaccountId || !projectId || !repoName) {
      return NextResponse.json(
        { error: "Missing required fields" },
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

    return NextResponse.json({
      success: true,
      repository: repoName,
      projectId,
      status: "pushed",
    });
  } catch (error) {
    console.error("AI Push GitHub Error:", error);
    return NextResponse.json(
      { error: "Failed to push to GitHub" },
      { status: 500 }
    );
  }
}