// src/app/api/ai/models/route.ts
import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    success: true,
    models: [
      {
        id: "gpt-5",
        name: "GPT-5",
        provider: "openai",
        default: true,
      },
      {
        id: "gemini-1.5-pro",
        name: "Gemini 1.5 Pro",
        provider: "google",
        default: false,
      },
      {
        id: "deepseek-coder",
        name: "DeepSeek Coder",
        provider: "deepseek",
        default: false,
      },
    ],
  });
}