/**
 * inngest/steps/validate-quality.step.ts
 * 
 * Step 9: Validate Quality Gates
 * 
 * Input:
 *   - resolvedSections[] (with generated component code)
 * Output:
 *   - Validation report for each file
 *   - Only continue to persist if all ERRORs cleared
 * 
 * Runs all deterministic quality validators:
 * - checkIntegrity (file truncation, unclosed braces, buffer issues)
 * - checkTokensInCode (no hardcoded colors/sizes)
 * - checkComponentContent (required fields present)
 * - checkA11yInCode (accessibility compliance)
 * - checkImportsInCode (imports resolvable)
 */


import { inngest } from "../client";
import { validateFiles, formatValidationReport } from "@/lib/validators";
import { checkFileIntegrity, checkFilesIntegrity } from "@/lib/validators/check-integrity";

import type { AIFile } from "@/lib/types/ai-file";
import type { ResolvedSection } from "@/lib/resolver/types";

export interface ValidateQualityInput {
  projectId: string;
  files: AIFile[];
  resolvedSections: ResolvedSection[];
  registryComponents?: string[];
  onPing?: (msg: string) => void;
}

export interface ValidateQualityOutput {
  allValid: boolean;
  totalErrors: number;
  totalWarnings: number;
  reports: Array<{
    fileId: string;
    filePath: string;
    isValid: boolean;
    failureCount: number;
    warningCount: number;
  }>;
  failedFiles: Array<{
    filePath: string;
    errors: string[];
  }>;
}

/**
 * Run quality validation on generated files
 */
export async function validateQualityStep(input: ValidateQualityInput) {
  const { projectId, files, resolvedSections, registryComponents, onPing } = input;

  onPing?.("[Step 9] Validating quality gates...");

  try {
    onPing?.("[Step 9] Running integrity checks (truncation, buffer, syntax)...");

    // First pass: Integrity checks (fail-fast on critical issues)
    const integrityResults = checkFilesIntegrity(files);

    if (!integrityResults.allValid) {
      const criticalErrors = integrityResults.reports
        .filter((r) => r.result.violations.some((v) => v.severity === "ERROR"))
        .map((r) => r.path);

      onPing?.(
        `[Step 9] ✗ CRITICAL: ${integrityResults.totalErrors} integrity errors found in: ${criticalErrors.join(", ")}`
      );

      // Return early with detailed errors
      const failedFiles = integrityResults.reports
        .filter((r) => !r.result.isValid)
        .map((r) => ({
          filePath: r.path,
          errors: r.result.violations.map(
            (v) => `[${v.type}] ${v.message}${v.fixHint ? ` - ${v.fixHint}` : ""}`
          ),
        }));

      return {
        allValid: false,
        totalErrors: integrityResults.totalErrors,
        totalWarnings: integrityResults.reports.reduce(
          (sum, r) => sum + r.result.violations.filter((v) => v.severity === "WARN").length,
          0
        ),
        reports: integrityResults.reports.map((r) => ({
          fileId: r.path,
          filePath: r.path,
          isValid: r.result.isValid,
          failureCount: r.result.violations.filter((v) => v.severity === "ERROR").length,
          warningCount: r.result.violations.filter((v) => v.severity === "WARN").length,
        })),
        failedFiles,
      } as ValidateQualityOutput;
    }

    onPing?.(`[Step 9] ✓ Integrity check passed (${files.length} files)`);

    // Second pass: Full validation
    onPing?.("[Step 9] Running full validation (tokens, imports, a11y)...");

    const validationResult = validateFiles(files, {
      registryComponents,
    });

    onPing?.(`[Step 9] Checked ${files.length} files`);

    if (validationResult.allValid) {
      onPing?.(`[Step 9] ✓ All quality gates passed`);
    } else {
      onPing?.(
        `[Step 9] ⚠ Found ${validationResult.totalErrors} errors, ${validationResult.totalWarnings} warnings`
      );
    }

    // Collect failed files for error reporting
    const failedFiles = validationResult.reports
      .filter((r) => !r.isValid)
      .map((r) => ({
        filePath: r.filePath,
        errors: r.sections.tokens.violations
          .concat(r.sections.content.violations)
          .concat(r.sections.a11y.violations)
          .concat(r.sections.imports.violations)
          .concat(r.sections.integrity.violations)
          .filter((v: any) => v.severity === "ERROR")
          .map((v: any) => v.message || v.description),
      }));

    return {
      allValid: validationResult.allValid,
      totalErrors: validationResult.totalErrors,
      totalWarnings: validationResult.totalWarnings,
      reports: validationResult.reports.map((r) => ({
        fileId: r.fileId,
        filePath: r.filePath,
        isValid: r.isValid,
        failureCount: r.failureCount,
        warningCount: r.warningCount,
      })),
      failedFiles,
    } as ValidateQualityOutput;
  } catch (err) {
    onPing?.(`[Step 9] ✗ Error: ${err instanceof Error ? err.message : "Unknown error"}`);
    throw err;
  }
}

/**
 * Inngest event definition
 */
export const validateQualityEvent = inngest.createFunction(
  { id: "validate-quality", triggers: [{ event: "ai/validate-quality" }] },
  async ({ event, logger, step }) => {
    logger.info("validate-quality", { projectId: event.data.projectId });

    const result = await step.run("validate", async () => {
      return validateQualityStep(event.data as ValidateQualityInput);
    });

    return result;
  }
);
