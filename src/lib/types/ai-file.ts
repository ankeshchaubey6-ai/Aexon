/**
 * AIFile — Shared representation of a generated file
 * 
 * Used throughout the pipeline to represent code that either:
 * - Is imported from the component pool
 * - Was generated as a custom component
 * - Is assembly code (page shells, routing, etc)
 */

export type FileProvenance = "pool" | "custom" | "assembly";

export interface AIFile {
  /** File path relative to project root (e.g., "src/components/Button.jsx") */
  path: string;

  /** File content (JSX, CSS, JSON, etc) */
  content: string;

  /** Where this file came from */
  provenance: FileProvenance;

  /** True if this file passed all validation checks */
  isValid?: boolean;

  /** Validation errors, if any */
  validationErrors?: Array<{
    severity: "ERROR" | "WARN";
    line?: number;
    message: string;
    fixHint?: string;
  }>;
}
