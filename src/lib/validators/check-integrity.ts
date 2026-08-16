/**
 * lib/validators/check-integrity.ts
 * 
 * Production-grade file integrity validator
 * Ensures files are complete, properly structured, no truncation
 */

import type { AIFile } from "@/lib/types/ai-file";

export interface IntegrityViolation {
  severity: "ERROR" | "WARN";
  type:
    | "truncated-jsx"
    | "unclosed-brace"
    | "incomplete-template"
    | "buffer-overflow"
    | "invalid-utf8"
    | "missing-closing-tag"
    | "syntax-error";
  line?: number;
  message: string;
  fixHint?: string;
}

export interface IntegrityCheckResult {
  isValid: boolean;
  violations: IntegrityViolation[];
  contentLength: number;
  confidence: number; // 0-1 score
}

/**
 * Check JSX integrity - ensure all tags are closed
 */
function checkJSXClosed(content: string): IntegrityViolation[] {
  const violations: IntegrityViolation[] = [];

  // Count opening and closing JSX tags (basic check)
  const openTags = (content.match(/<[A-Z]\w*/g) || []).length;
  const selfClosing = (content.match(/<[A-Z]\w*[^>]*\/>/g) || []).length;
  const closeTags = (content.match(/<\/[A-Z]\w*>/g) || []).length;

  if (openTags > closeTags + selfClosing) {
    violations.push({
      severity: "ERROR",
      type: "missing-closing-tag",
      message: `Unmatched opening tags: ${openTags} open vs ${closeTags + selfClosing} closed`,
      fixHint: "Ensure all JSX components have closing tags",
    });
  }

  return violations;
}

/**
 * Check for unclosed braces in code
 */
function checkBraceBalance(content: string): IntegrityViolation[] {
  const violations: IntegrityViolation[] = [];

  // Count various bracket types
  const counters = {
    curly: 0,
    paren: 0,
    square: 0,
  };

  // Simple bracket counting (not perfect but catches most issues)
  for (const char of content) {
    if (char === "{") counters.curly++;
    else if (char === "}") counters.curly--;
    else if (char === "(") counters.paren++;
    else if (char === ")") counters.paren--;
    else if (char === "[") counters.square++;
    else if (char === "]") counters.square--;
  }

  if (counters.curly !== 0) {
    violations.push({
      severity: "ERROR",
      type: "unclosed-brace",
      message: `Unbalanced curly braces: ${counters.curly > 0 ? "missing " + counters.curly + " closing" : counters.curly + " extra closing"}`,
      fixHint: "Check for unclosed { or extra }",
    });
  }

  if (counters.paren !== 0) {
    violations.push({
      severity: "ERROR",
      type: "unclosed-brace",
      message: `Unbalanced parentheses: ${counters.paren > 0 ? "missing " + counters.paren + " closing" : counters.paren + " extra closing"}`,
      fixHint: "Check for unclosed ( or extra )",
    });
  }

  if (counters.square !== 0) {
    violations.push({
      severity: "ERROR",
      type: "unclosed-brace",
      message: `Unbalanced square brackets: ${counters.square > 0 ? "missing " + counters.square + " closing" : counters.square + " extra closing"}`,
      fixHint: "Check for unclosed [ or extra ]",
    });
  }

  return violations;
}

/**
 * Check for typical truncation patterns
 */
function checkTruncation(content: string): IntegrityViolation[] {
  const violations: IntegrityViolation[] = [];

  // Check if file ends abruptly (mid-word, incomplete JSX, etc)
  const lastLines = content.trim().split("\n").slice(-3).join(" ");

  // Incomplete JSX/TypeScript patterns
  const truncationPatterns = [
    /\s+style=\{\s*$/, // style={{ incomplete
    /\s+className=\s*$/, // className incomplete
    /\s+import\s+\{?\s*$/, // import incomplete
    /\s+const\s+\w*\s*=\s*$/, // const assignment incomplete
    /\s*<\s*\w+\s*$/, // Tag opening incomplete
    /\s*\|\|\s*$/, // operator at end
    /\s*&&\s*$/, // operator at end
    /\s*\?\s*$/, // ternary incomplete
    /\s*:\s*$/, // type annotation incomplete
  ];

  for (const pattern of truncationPatterns) {
    if (pattern.test(lastLines)) {
      violations.push({
        severity: "ERROR",
        type: "truncated-jsx",
        message: "File appears to be truncated - ends with incomplete statement",
        fixHint: "Check file generation buffer limits",
      });
      break;
    }
  }

  // Check for common incomplete file endings
  if (!content.trim().endsWith("}") && !content.trim().endsWith(";")) {
    const lastChar = content.trim().slice(-1);
    if (lastChar && lastChar !== "}" && lastChar !== ";" && lastChar !== "`") {
      violations.push({
        severity: "WARN",
        type: "truncated-jsx",
        message: `File doesn't end with closing brace or semicolon (ends with: ${lastChar})`,
        fixHint: "Verify file generation completed fully",
      });
    }
  }

  return violations;
}

/**
 * Check for buffer overflow indicators
 */
function checkBufferHealth(content: string): IntegrityViolation[] {
  const violations: IntegrityViolation[] = [];

  // Check content length is reasonable (not too small for generated code)
  if (content.trim().length < 50) {
    violations.push({
      severity: "WARN",
      type: "buffer-overflow",
      message: "File content suspiciously small - may be incomplete",
      fixHint: "Check generation process completed",
    });
  }

  // Check for repeating/corrupted patterns
  const lines = content.split("\n");
  let recentLineContent = "";
  let repeatedLineCount = 0;

  for (const line of lines) {
    if (line === recentLineContent) {
      repeatedLineCount++;
    } else {
      repeatedLineCount = 0;
      recentLineContent = line;
    }

    if (repeatedLineCount > 5) {
      violations.push({
        severity: "ERROR",
        type: "buffer-overflow",
        message: `Suspicious content repetition detected (${repeatedLineCount}x same line)`,
        fixHint: "File may be corrupted during generation",
      });
      break;
    }
  }

  return violations;
}

/**
 * Check for valid UTF-8 content
 */
function checkUtf8Valid(content: string): IntegrityViolation[] {
  const violations: IntegrityViolation[] = [];

  try {
    // Attempt to encode/decode to verify UTF-8 validity
    const encoded = Buffer.from(content, "utf-8");
    const decoded = encoded.toString("utf-8");

    if (decoded.length !== content.length) {
      violations.push({
        severity: "ERROR",
        type: "invalid-utf8",
        message: "Content contains invalid UTF-8 sequences",
        fixHint: "Check character encoding",
      });
    }
  } catch (err) {
    violations.push({
      severity: "ERROR",
      type: "invalid-utf8",
      message: "UTF-8 encoding error: " + (err instanceof Error ? err.message : "unknown"),
      fixHint: "Fix character encoding issues",
    });
  }

  return violations;
}

/**
 * Comprehensive file integrity check
 */
export function checkFileIntegrity(file: AIFile): IntegrityCheckResult {
  if (!file || !file.content) {
    return {
      isValid: false,
      violations: [
        {
          severity: "ERROR",
          type: "syntax-error",
          message: "File is empty or null",
        },
      ],
      contentLength: 0,
      confidence: 0,
    };
  }

  const allViolations: IntegrityViolation[] = [];
  const { content } = file;

  // Run all checks
  allViolations.push(...checkBraceBalance(content));
  allViolations.push(...checkTruncation(content));
  allViolations.push(...checkBufferHealth(content));
  allViolations.push(...checkUtf8Valid(content));

  // JSX check only for JSX/TSX files
  if (file.path.endsWith(".tsx") || file.path.endsWith(".jsx")) {
    allViolations.push(...checkJSXClosed(content));
  }

  // Calculate confidence score
  const errorCount = allViolations.filter((v) => v.severity === "ERROR").length;
  const confidence = errorCount === 0 ? 1 : Math.max(0, 1 - errorCount * 0.25);

  return {
    isValid: errorCount === 0,
    violations: allViolations,
    contentLength: content.length,
    confidence,
  };
}

/**
 * Check multiple files for batch integrity
 */
export function checkFilesIntegrity(files: AIFile[]): {
  allValid: boolean;
  reports: Array<{ path: string; result: IntegrityCheckResult }>;
  totalErrors: number;
} {
  const reports = files.map((file) => ({
    path: file.path,
    result: checkFileIntegrity(file),
  }));

  const totalErrors = reports.reduce(
    (sum, r) => sum + r.result.violations.filter((v) => v.severity === "ERROR").length,
    0
  );

  return {
    allValid: reports.every((r) => r.result.isValid),
    reports,
    totalErrors,
  };
}
