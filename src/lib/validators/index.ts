/**
 * validators/index.ts — Validation Orchestrator
 * 
 * Runs all quality gate validators and aggregates results
 * Returns single report with all violations
 * 
 * Used by: validate-quality Inngest step
 */

import { checkTokensInCode, checkTokensInCss } from "./check-tokens";
import { checkComponentContent } from "./check-content";
import { checkA11yInCode, checkHeadingHierarchy } from "./check-a11y";
import { checkImportsInCode } from "./check-imports";
import { checkFileIntegrity } from "./check-integrity";

import type { AIFile } from "@/lib/types/ai-file";
import type { CSSVariableManifest } from "@/lib/design-system/types";

export interface ValidationReport {
  fileId: string;
  filePath: string;
  isValid: boolean;
  failureCount: number;
  warningCount: number;
  sections: {
    tokens: { passed: boolean; violations: any[] };
    content: { passed: boolean; violations: any[] };
    a11y: { passed: boolean; violations: any[] };
    imports: { passed: boolean; violations: any[] };
    integrity: { passed: boolean; violations: any[] };
  };
  summary: string;
}

/**
 * Run all validators on a generated file
 */
export function validateFile(
  file: AIFile,
  options: {
    componentName?: string;
    componentProps?: Record<string, any>;
    registryComponents?: string[];
  } = {}
): ValidationReport {
  const violations = {
    tokens: [] as any[],
    content: [] as any[],
    a11y: [] as any[],
    imports: [] as any[],
    integrity: [] as any[],
  };

  let failureCount = 0;
  let warningCount = 0;

  // 0. Integrity check first (critical gate)
  const integrityCheck = checkFileIntegrity(file);
  violations.integrity = integrityCheck.violations;
  failureCount += integrityCheck.violations.filter((v) => v.severity === "ERROR").length;
  warningCount += integrityCheck.violations.filter((v) => v.severity === "WARN").length;

  // If critical integrity errors, fail fast
  if (!integrityCheck.isValid && integrityCheck.violations.some((v) => v.severity === "ERROR")) {
    return {
      fileId: file.path,
      filePath: file.path,
      isValid: false,
      failureCount,
      warningCount,
      sections: {
        tokens: { passed: true, violations: [] },
        content: { passed: true, violations: [] },
        a11y: { passed: true, violations: [] },
        imports: { passed: true, violations: [] },
        integrity: { passed: false, violations: violations.integrity },
      },
      summary: `CRITICAL: File integrity check failed (${failureCount} errors)`,
    };
  }

  // 1. Token validation
  const tokenCheck = file.path.endsWith(".css")
    ? checkTokensInCss(file.content)
    : checkTokensInCode(file.content);

  violations.tokens = tokenCheck.violations;
  failureCount += tokenCheck.violations.filter((v) => v.severity === "ERROR").length;
  warningCount += tokenCheck.violations.filter((v) => v.severity === "WARN").length;

  // 2. Content validation (if component name provided)
  if (options.componentName && options.componentProps) {
    const contentCheck = checkComponentContent(options.componentName, options.componentProps);
    violations.content = contentCheck.violations;
    failureCount += contentCheck.violations.filter((v) => v.severity === "ERROR").length;
    warningCount += contentCheck.violations.filter((v) => v.severity === "WARN").length;
  }

  // 3. A11y validation (for HTML/JSX files)
  if (file.path.endsWith(".tsx") || file.path.endsWith(".jsx") || file.path.endsWith(".html")) {
    const a11yCheck = checkA11yInCode(file.content);
    violations.a11y = a11yCheck.violations;
    failureCount += a11yCheck.violations.filter((v) => v.severity === "ERROR").length;
    warningCount += a11yCheck.violations.filter((v) => v.severity === "WARN").length;

    const headingCheck = checkHeadingHierarchy(file.content);
    violations.a11y.push(...headingCheck);
    failureCount += headingCheck.filter((v) => v.severity === "ERROR").length;
    warningCount += headingCheck.filter((v) => v.severity === "WARN").length;
  }

  // 4. Import validation (for TypeScript/JavaScript files)
  if (file.path.endsWith(".ts") || file.path.endsWith(".tsx") || file.path.endsWith(".js")) {
    const importCheck = checkImportsInCode(file.content, {
      registryComponents: options.registryComponents,
    });
    violations.imports = importCheck.violations;
    failureCount += importCheck.violations.filter((v) => v.severity === "ERROR").length;
    warningCount += importCheck.violations.filter((v) => v.severity === "WARN").length;
  }

  const isValid = failureCount === 0;
  const summaryParts: string[] = [];
  if (violations.content.length > 0) {
    summaryParts.push(`content (${violations.content.length})`);
  }
  if (violations.a11y.length > 0) {
    summaryParts.push(`a11y (${violations.a11y.length})`);
  }
  if (violations.imports.length > 0) {
    summaryParts.push(`imports (${violations.imports.length})`);
  }

  const summary = isValid
    ? `✓ All validations passed (${warningCount} warnings)`
    : `✗ Validation failed with ${failureCount} errors, ${warningCount} warnings in: ${summaryParts.join(", ")}`;

  return {
    fileId: file.path,
    filePath: file.path,
    isValid,
    failureCount,
    warningCount,
    sections: {
      tokens: { passed: tokenCheck.isValid, violations: violations.tokens },
      content: { passed: violations.content.length === 0, violations: violations.content },
      a11y: { passed: violations.a11y.length === 0, violations: violations.a11y },
      imports: { passed: violations.imports.length === 0, violations: violations.imports },
      integrity: { passed: violations.integrity.length === 0, violations: violations.integrity },
    },
    summary,
  };
}

/**
 * Validate multiple files and aggregate results
 */
export function validateFiles(
  files: AIFile[],
  options?: { componentName?: string; componentProps?: Record<string, any>; registryComponents?: string[] }
): {
  allValid: boolean;
  reports: ValidationReport[];
  totalErrors: number;
  totalWarnings: number;
} {
  const reports = files.map((file) => validateFile(file, options));

  const totalErrors = reports.reduce((sum, r) => sum + r.failureCount, 0);
  const totalWarnings = reports.reduce((sum, r) => sum + r.warningCount, 0);

  return {
    allValid: reports.every((r) => r.isValid),
    reports,
    totalErrors,
    totalWarnings,
  };
}

/**
 * Format validation results for logging
 */
export function formatValidationReport(report: ValidationReport): string {
  const lines: string[] = [
    `\n📋 Validation Report: ${report.filePath}`,
    `Status: ${report.isValid ? "✓ PASS" : "✗ FAIL"}`,
    `Errors: ${report.failureCount} | Warnings: ${report.warningCount}`,
    `\n${report.summary}`,
  ];

  for (const [section, result] of Object.entries(report.sections)) {
    if (result.violations.length > 0) {
      lines.push(`\n[${section}] (${result.violations.length} issues)`);
      for (const v of result.violations.slice(0, 3)) {
        // Show first 3
        lines.push(`  - ${v.message || v.description}`);
      }
      if (result.violations.length > 3) {
        lines.push(`  ... and ${result.violations.length - 3} more`);
      }
    }
  }

  return lines.join("\n");
}
