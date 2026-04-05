//==================== FILE: src/app/api/ai/validate/route.ts ====================

// src/app/api/ai/validate/route.ts
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
    const { subaccountId, files } = body as {
      subaccountId?: string;
      files?: { path: string; content: string }[];
    };

    if (!subaccountId || !files) {
      return NextResponse.json(
        { error: "Missing validation payload" },
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
      errors: [],
      warnings: [],
    });
  } catch (error) {
    console.error("AI Validate Error:", error);
    return NextResponse.json(
      { error: "Validation failed" },
      { status: 500 }
    );
  }
}


