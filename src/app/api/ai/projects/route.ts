// src/app/api/ai/projects/route.ts

import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { db } from "@/lib/db";

// GET /api/ai/projects?subaccountId=xxx
// Used by ProjectSidebar to list all projects.
export async function GET(req: NextRequest) {
  try {
    const clerkUser = await currentUser();
    if (!clerkUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const subaccountId = searchParams.get("subaccountId");

    if (!subaccountId) {
      return NextResponse.json({ error: "Missing subaccountId" }, { status: 400 });
    }

    const projects = await db.aIProject.findMany({
      where:   { subAccountId: subaccountId },
      select: {
        id:          true,
        name:        true,
        description: true,
        createdAt:   true,
        updatedAt:   true,
      },
      orderBy: { updatedAt: "desc" },
    });

    return NextResponse.json({ success: true, projects });
  } catch (err) {
    console.error("[GET /api/ai/projects]", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

// POST /api/ai/projects — create an empty named project
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
      return NextResponse.json({ error: "Missing subaccountId or name" }, { status: 400 });
    }

    const project = await db.aIProject.create({
      data: {
        name:        name.trim(),
        description: "",
        subAccountId: subaccountId,
      },
      select: {
        id:          true,
        name:        true,
        description: true,
        createdAt:   true,
        updatedAt:   true,
      },
    });

    return NextResponse.json({ success: true, project });
  } catch (err) {
    console.error("[POST /api/ai/projects]", err);
    return NextResponse.json({ error: "Failed to create project" }, { status: 500 });
  }
}

// DELETE /api/ai/projects?projectId=xxx&subaccountId=xxx
export async function DELETE(req: NextRequest) {
  try {
    const clerkUser = await currentUser();
    if (!clerkUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const projectId    = searchParams.get("projectId");
    const subaccountId = searchParams.get("subaccountId");

    if (!projectId || !subaccountId) {
      return NextResponse.json({ error: "Missing projectId or subaccountId" }, { status: 400 });
    }

    const project = await db.aIProject.findUnique({
      where:  { id: projectId },
      select: { id: true, subAccountId: true },
    });

    if (!project || project.subAccountId !== subaccountId) {
      return NextResponse.json({ error: "Not found or access denied" }, { status: 404 });
    }

    await db.aIProject.delete({ where: { id: projectId } });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[DELETE /api/ai/projects]", err);
    return NextResponse.json({ error: "Failed to delete project" }, { status: 500 });
  }
}