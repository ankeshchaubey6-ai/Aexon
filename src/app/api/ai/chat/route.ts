import { NextRequest, NextResponse } from "next/server";
import { planProject } from "@/lib/ai/llm/plan-project";
import { generateCodeFromAI } from "@/lib/ai/llm/generate-code";
import { loadBaseTemplate } from "@/lib/ai/template/load-template";
import { mergeFiles } from "@/lib/ai/engine/merge-files";
import { autoFixFiles } from "@/lib/ai/engine/auto-fix";
import { addMessage } from "@/queries/ai-messages";
import { db } from "@/lib/db";
import { v4 as uuid } from "uuid";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { prompt, subaccountId, projectId } = body;

    if (!prompt || !subaccountId || !projectId) {
      return NextResponse.json(
        { error: "Missing fields" },
        { status: 400 }
      );
    }

    // =========================
    // 💬 SAVE USER MESSAGE
    // =========================
    await addMessage({
      id: uuid(),
      projectId,
      role: "USER",
      content: prompt,
      status: "DONE",
      createdAt: new Date().toISOString(),
    });

    // =========================
    // 🧠 STEP 1: PLAN
    // =========================
    const plan = await planProject(prompt);

    if (!plan) {
      return NextResponse.json(
        { error: "Planning failed" },
        { status: 500 }
      );
    }

    // =========================
    // ⚡ STEP 2: GENERATE AI FILES
    // =========================
    const aiFiles = await generateCodeFromAI(
      JSON.stringify(plan, null, 2)
    );

    if (!aiFiles.length) {
      return NextResponse.json(
        { error: "Generation failed" },
        { status: 500 }
      );
    }

    // =========================
    // 📦 STEP 3: LOAD TEMPLATE
    // =========================
    const baseFiles = loadBaseTemplate();

    // =========================
    // 🔀 STEP 4: MERGE + FIX
    // =========================
    const mergedFiles = mergeFiles(baseFiles, aiFiles);
    const finalFiles = autoFixFiles(mergedFiles);

    // =========================
    // 💾 STEP 5: SAVE FILES TO DB
    // =========================

    // 🧹 delete old files
    await db.aIProjectFile.deleteMany({
      where: { projectId },
    });

    // 💾 insert new files
    await db.aIProjectFile.createMany({
      data: finalFiles.map((file) => ({
        projectId,
        path: file.path,
        content: file.content,
      })),
    });

    // 📝 update project metadata
    await db.aIProject.update({
      where: { id: projectId },
      data: {
        name: plan.projectName || "AI Project",
        updatedAt: new Date(),
      },
    });

    // =========================
    // 🤖 SAVE ASSISTANT MESSAGE
    // =========================
    await addMessage({
      id: uuid(),
      projectId,
      role: "ASSISTANT",
      content: "🚀 Project generated successfully!",
      status: "DONE",
      createdAt: new Date().toISOString(),
    });

    // =========================
    // 🚀 RESPONSE
    // =========================
    return NextResponse.json({
      success: true,
      projectId,
      files: finalFiles,
    });

  } catch (err) {
    console.error("AI Chat Error:", err);

    return NextResponse.json(
      { error: "Internal error" },
      { status: 500 }
    );
  }
}