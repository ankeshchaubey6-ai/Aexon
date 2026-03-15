// src/app/api/ai/projects/route.ts
import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { Role } from "@prisma/client";
import { getAuthUserDetails } from "@/queries/auth";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const subaccountId = searchParams.get("subaccountId");

    if (!subaccountId) {
      return NextResponse.json(
        { error: "subaccountId is required" },
        { status: 400 }
      );
    }

    const clerkUser = await currentUser();
    if (!clerkUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
      projects: [],
    });
  } catch (error) {
    console.error("AI Projects Fetch Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch projects" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const clerkUser = await currentUser();
    if (!clerkUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { subaccountId, name } = body as {
      subaccountId?: string;
      name?: string;
    };

    if (!subaccountId || !name) {
      return NextResponse.json(
        { error: "Missing subaccountId or name" },
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

    const projectId = crypto.randomUUID();

    return NextResponse.json({
      success: true,
      project: {
        id: projectId,
        name,
        subaccountId,
        createdAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("AI Project Create Error:", error);
    return NextResponse.json(
      { error: "Failed to create project" },
      { status: 500 }
    );
  }
}