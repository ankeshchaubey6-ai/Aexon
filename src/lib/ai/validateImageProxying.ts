/**
 * Image Proxying Validation Utility
 *
 * This module provides validation tools to ensure that all external images
 * in generated content are properly proxied through the /api/image endpoint.
 *
 * This is critical for:
 * - Handling CORS headers correctly
 * - Avoiding mixed content warnings (http resources on https pages)
 * - Centralized image error handling and fallbacks
 * - Monitoring and analytics of image requests
 */

import { ensureAllImagesProxied } from "./sanitizeOutput";

export interface ValidationResult {
  isValid: boolean;
  filePath?: string;
  unproxiedUrls: string[];
  message: string;
  timestamp: string;
}

/**
 * Validates a single file content for image proxying compliance
 */
export function validateFileImageProxying(
  content: string,
  filePath?: string
): ValidationResult {
  const { isValid, unproxiedUrls, message } = ensureAllImagesProxied(content);

  return {
    isValid,
    filePath,
    unproxiedUrls,
    message,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Validates multiple files for image proxying compliance
 */
export function validateFilesImageProxying(
  files: Array<{ path: string; content: string }>
): ValidationResult[] {
  return files.map((file) =>
    validateFileImageProxying(file.content, file.path)
  );
}

/**
 * Generates a comprehensive validation report
 */
export function generateImageProxyingReport(
  results: ValidationResult[]
): {
  totalFiles: number;
  passedValidation: number;
  failedValidation: number;
  totalUnproxiedUrls: number;
  summary: string;
  details: ValidationResult[];
} {
  const passedValidation = results.filter((r) => r.isValid).length;
  const failedValidation = results.length - passedValidation;
  const allUnproxiedUrls = results.flatMap((r) => r.unproxiedUrls);
  const uniqueUnproxiedUrls = new Set(allUnproxiedUrls);

  const summary =
    failedValidation === 0
      ? `✓ All ${results.length} files passed image proxying validation`
      : `✗ ${failedValidation}/${results.length} files have unproxied external URLs (${uniqueUnproxiedUrls.size} unique URLs)`;

  return {
    totalFiles: results.length,
    passedValidation,
    failedValidation,
    totalUnproxiedUrls: uniqueUnproxiedUrls.size,
    summary,
    details: results,
  };
}

/**
 * Example of how to use in a development/testing context:
 *
 * // Validate generated files
 * const generatedFiles = await generateProject(); // returns files
 * const results = validateFilesImageProxying(generatedFiles);
 * const report = generateImageProxyingReport(results);
 *
 * if (!report.summary.includes("✓")) {
 *   console.warn("Image proxying issues detected:", report);
 *   // Handle according to your strategy (fail build, warn, auto-fix, etc.)
 * }
 */
