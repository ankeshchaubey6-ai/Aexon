// src/app/api/ai-projects/route.ts  — handles POST (create)
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { currentUser } from "@clerk/nextjs/server";

export async function POST(req: NextRequest) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { subaccountId, name } = await req.json();
    if (!subaccountId || !name?.trim())
      return NextResponse.json({ error: "Missing required fields." }, { status: 400 });

    const project = await db.aIProject.create({
      data: {
        id: crypto.randomUUID(),
        name: name.trim(),
        description: "",
        subAccountId: subaccountId,
      },
    });

    return NextResponse.json({ project });
  } catch (err) {
    console.error("[POST /api/ai-projects]", err);
    return NextResponse.json({ error: "Failed to create project." }, { status: 500 });
  }
}