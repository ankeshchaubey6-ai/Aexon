// src/inngest/ai-builder.ts
// Sends the "ai/build" event to trigger the Inngest function.
// Called from the chat API route or server actions.

import { inngest } from "./client";

export async function triggerAIBuild({
  prompt,
  projectId,
  subaccountId,
}: {
  prompt: string;
  projectId: string;
  subaccountId: string;
}) {
  await inngest.send({
    name: "ai/build",
    data: {
      prompt,
      projectId,
      subaccountId,
    },
  });

  console.log(`📨 [INNGEST] Triggered ai/build for project ${projectId}`);
}