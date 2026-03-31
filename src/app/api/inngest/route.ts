// src/app/api/inngest/route.ts
// This file MUST export the Inngest handler and list ALL your functions.
// If aiBuilderFunction is not listed here, Inngest will never run it.

import { serve } from "inngest/next";
import { inngest } from "@/inngest/client";
import { aiBuilderFunction } from "@/inngest/functions";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
    aiBuilderFunction, // ✅ Make sure this is listed
  ],
});