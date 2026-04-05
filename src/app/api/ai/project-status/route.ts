//=================== FILE: src/app/api/ai/project-status/route.ts ====================

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const projectId = searchParams.get("projectId");

  if (!projectId) {
    return NextResponse.json(
      { error: "Missing projectId" },
      { status: 400 }
    );
  }

  const files = await db.aIProjectFile.findMany({
    where: { projectId },
  });

  return NextResponse.json({
    status: files.length > 0 ? "COMPLETED" : "PROCESSING",
    files: files.map((f) => ({
      path: f.path,
      content: f.content,
    })),
  });
}


