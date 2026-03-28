// src/app/api/ai-projects/[projectId]/route.ts  — handles DELETE
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { currentUser } from "@clerk/nextjs/server";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { projectId: string } }
) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    await db.aIProject.delete({ where: { id: params.projectId } });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[DELETE /api/ai-projects/:id]", err);
    return NextResponse.json({ error: "Failed to delete project." }, { status: 500 });
  }
}