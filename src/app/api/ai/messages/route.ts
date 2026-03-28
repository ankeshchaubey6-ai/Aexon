import { NextRequest, NextResponse } from "next/server";
import { getMessages } from "@/queries/ai-messages";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get("projectId");

    if (!projectId) {
      return NextResponse.json(
        { error: "Missing projectId" },
        { status: 400 }
      );
    }

    const messages = await getMessages(projectId);

    return NextResponse.json({
      success: true,
      messages,
    });

  } catch (err) {
    console.error("Messages API Error:", err);

    return NextResponse.json(
      { error: "Internal error" },
      { status: 500 }
    );
  }
}