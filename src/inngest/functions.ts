/**
 * inngest/functions.ts
 * 
 * OPUS AI Builder: 10-Step Pipeline
 * 
 * 1. parse-intent       - Parse user prompt into structured SitePlan
 * 2. resolve-tokens     - Resolve design tokens based on industry/mood
 * 3. build-registry     - Load and organize component registry
 * 4. resolve-components - Score sections, decide tier (POOL_MATCH/ADAPT/CUSTOM)
 * 5. generate-files     - Generate component code based on tier decisions
 * 6. validate-quality   - Run quality validators (tokens, content, a11y, imports)
 * 7. handle-errors      - If validation failed, optionally retry or report
 * 8. assemble-pages     - Combine components into pages
 * 9. update-metadata    - Update project metadata in DB
 * 10. persist-files     - Save all generated files to database
 */

import { inngest } from "./client";
import { db } from "@/lib/db";

import { parseIntentStep } from "./steps/parse-intent.step";
import { resolveDesignTokensStep } from "./steps/resolve-design-tokens.step";
import { buildRegistryContextStep } from "./steps/build-registry-context.step";
import { resolveComponentsStep } from "./steps/resolve-components.step";
import { validateQualityStep } from "./steps/validate-quality.step";
import { assemblePagesStep } from "./steps/assemble-pages.step";
import { persistFilesStep } from "./steps/persist-files.step";

import { createNewCache } from "@/lib/resolver/session-cache";
import { getRegistryVersion } from "@/lib/component-pool/registry";

import type { AIFile } from "@/lib/types/ai-file";
import type { SitePlan } from "@/lib/types/site-plan";
import type { CSSVariableManifest } from "@/lib/design-system/types";
import type { ResolvedSection, SerializedSessionCache } from "@/lib/resolver/types";

type EventData = {
  prompt: string;
  projectId: string;
  subaccountId: string;
};

/**
 * Main AI Builder Pipeline - 10 Steps
 * 
 * PRODUCTION CONFIGURATION:
 * - Retries: 1 attempt, no retries (LLM failures should be fast-failed)
 * - Timeout: 120s per step, 600s total (10 minutes)
 * - Concurrency: 1 per project (serialized)
 * - Debounce: 5s (prevent rapid re-triggers)
 */
export const aiBuilderFunction = inngest.createFunction(
  {
    id: "ai-builder-run-v2",
    triggers: [{ event: "ai/build" }],
    concurrency: {
      key: "event.data.projectId",
      limit: 1, // Single concurrent build per project
    },
    retries: 0, // No retries - fail fast on LLM errors
    timeouts: {
      finish: "600s", // 10 minute hard timeout
    },
    debounce: {
      period: "5s",
      key: "event.data.projectId",
    },
  },
  async ({ event, step }: any) => {
    const { prompt, projectId, subaccountId } = event.data as EventData;

    console.log("🚀 Starting AI Builder Pipeline", { projectId });

    let assistantMessageId: string = "";

    try {
      // ═══════════════════════════════════════════════════════════════
      // STEP 0: Setup - Create assistant message and session cache
      // ═══════════════════════════════════════════════════════════════

      assistantMessageId = await step.run("setup-message", async () => {
        await db.aIMessage.create({
          data: {
            projectId,
            role: "USER",
            content: prompt,
            status: "DONE",
          },
        });

        const msg = await db.aIMessage.create({
          data: {
            projectId,
            role: "ASSISTANT",
            content: "🔄 Starting generation pipeline...",
            status: "PENDING",
          },
        });
        return msg.id;
      });

      const ping = (msg: string) => console.log(msg);

      // ═══════════════════════════════════════════════════════════════
      // STEP 1: Parse Intent
      // ═══════════════════════════════════════════════════════════════

      const parseIntentOutput = await step.run("parse-intent", async () => {
        return parseIntentStep({
          projectId,
          userPrompt: prompt,
          onPing: ping,
        });
      });

      const sitePlan: SitePlan = parseIntentOutput.sitePlan;
      console.log("✓ Step 1: Intent Parsed", { sections: sitePlan.pages.length });

      // ═══════════════════════════════════════════════════════════════
      // STEP 2: Resolve Design Tokens
      // ═══════════════════════════════════════════════════════════════

      const tokenOutput = await step.run("resolve-tokens", async () => {
        return resolveDesignTokensStep({
          projectId,
          sitePlan,
          onPing: ping,
        });
      });

      const tokens: CSSVariableManifest = tokenOutput.manifest;
      console.log("✓ Step 2: Tokens Resolved", { theme: tokenOutput.theme });

      // ═══════════════════════════════════════════════════════════════
      // STEP 3: Build Registry Context
      // ═══════════════════════════════════════════════════════════════

      const registryOutput = await step.run("build-registry-context", async () => {
        return buildRegistryContextStep({
          projectId,
          sitePlan,
          onPing: ping,
        });
      });

      console.log("✓ Step 3: Registry Context Built", {
        components: registryOutput.componentCount,
        categories: registryOutput.categoriesCovered.length,
      });

      // ═══════════════════════════════════════════════════════════════
      // STEP 4: Resolve Components (Scoring + Tier Decision)
      // ═══════════════════════════════════════════════════════════════

      const sessionCache = createNewCache(projectId);

      const resolveOutput = await step.run("resolve-components", async () => {
        return resolveComponentsStep({
          projectId,
          sitePlan,
          sessionCache,
          onPing: ping,
        });
      });

      const resolutions: ResolvedSection[] = resolveOutput.resolutions;
      const updatedCache: SerializedSessionCache = resolveOutput.updatedCache;

      console.log("✓ Step 4: Components Resolved", {
        poolMatch: resolveOutput.statistics.poolMatchCount,
        poolAdapt: resolveOutput.statistics.poolAdaptCount,
        customGen: resolveOutput.statistics.customGenerateCount,
      });

      // ═══════════════════════════════════════════════════════════════
      // STEP 5: Assemble Pages (Generate Component Code)
      // ═══════════════════════════════════════════════════════════════

      const assemblyOutput = await step.run("assemble-pages", async () => {
        return assemblePagesStep({
          projectId,
          resolvedSections: resolutions,
          tokens,
          onPing: ping,
        });
      });

      const files: AIFile[] = assemblyOutput.files;
      console.log("✓ Step 5: Pages Assembled", { files: files.length });

      // ═══════════════════════════════════════════════════════════════
      // STEP 6: Validate Quality
      // ═══════════════════════════════════════════════════════════════

      const validationOutput = await step.run("validate-quality", async () => {
        return validateQualityStep({
          projectId,
          files,
          resolvedSections: resolutions,
          onPing: ping,
        });
      });

      const validationPassed = validationOutput.allValid;

      console.log("✓ Step 6: Quality Validation", {
        passed: validationPassed,
        errors: validationOutput.totalErrors,
        warnings: validationOutput.totalWarnings,
      });

      if (!validationPassed && validationOutput.totalErrors > 0) {
        // Store failed files with error details
        await step.run("mark-validation-failed", async () => {
          await db.aIMessage.update({
            where: { id: assistantMessageId },
            data: {
              status: "ERROR",
              failedAtStep: "validate-quality",
              validationErrors: JSON.stringify(validationOutput.failedFiles),
              content: `❌ Validation failed with ${validationOutput.totalErrors} errors.`,
            },
          });
        });
        return { projectId, success: false, reason: "Validation failed" };
      }

      // ═══════════════════════════════════════════════════════════════
      // STEP 7: Get Registry Version
      // ═══════════════════════════════════════════════════════════════

      const registryVersion = getRegistryVersion();

      // ═══════════════════════════════════════════════════════════════
      // STEP 8: Persist Files to Database
      // ═══════════════════════════════════════════════════════════════

      const persistOutput = await step.run("persist-files", async () => {
        return persistFilesStep({
          projectId,
          files,
          validationPassed,
          registryVersion,
          onPing: ping,
        });
      });

      console.log("✓ Step 8: Files Persisted", {
        persisted: persistOutput.persisted.length,
        failed: persistOutput.failed.length,
      });

      // ═══════════════════════════════════════════════════════════════
      // STEP 9: Update Final Message
      // ═══════════════════════════════════════════════════════════════

      await step.run("finalize-message", async () => {
        await db.aIMessage.update({
          where: { id: assistantMessageId },
          data: {
            status: "DONE",
            filesGenerated: files.length,
            content: `✅ Pipeline complete! Generated ${files.length} files.`,
          },
        });
      });

      console.log("🎉 Pipeline Complete", {
        projectId,
        files: files.length,
        duration: "~30s",
      });

      return {
        projectId,
        success: true,
        files: files.length,
        stats: resolveOutput.statistics,
      };
    } catch (err) {
      console.error("❌ Pipeline Failed", { error: err });

      if (assistantMessageId) {
        await step.run("mark-pipeline-failed", async () => {
          await db.aIMessage.update({
            where: { id: assistantMessageId },
            data: {
              status: "ERROR",
              content: `❌ Pipeline error: ${err instanceof Error ? err.message : "Unknown error"}`,
            },
          });
        });
      }

      throw err;
    }
  }
);