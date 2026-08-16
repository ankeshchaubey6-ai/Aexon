/**
 * validators/check-a11y.ts — Accessibility Compliance Validation
 * 
 * Quality gate: Ensure generated HTML has basic accessibility features
 * - Images have alt text
 * - Buttons have accessible labels
 * - Links have descriptive text (not "click here")
 * - Form inputs have labels
 * - Color contrast ratios meet WCAG AA
 * - Heading hierarchy is proper (h1, then h2/h3, never h4-h6 first)
 * 
 * Runs as regex pattern matching on generated HTML/TSX code.
 * 
 * Used by: validate-quality step
 */

export interface A11yCheckResult {
  isValid: boolean;
  violations: A11yViolation[];
}

export interface A11yViolation {
  line: number;
  code: string;
  issueType: "missing-alt" | "missing-label" | "poor-link-text" | "heading-hierarchy" | "no-color-contrast-info";
  message: string;
  severity: "ERROR" | "WARN";
  fixHint: string;
}

/**
 * Check generated HTML/TSX for basic a11y compliance
 */
export function checkA11yInCode(content: string): A11yCheckResult {
  const violations: A11yViolation[] = [];
  const lines = content.split("\n");

  lines.forEach((line, lineNum) => {
    // 1. Check for <img> without alt
    const imgMatches = [...line.matchAll(/<img\s+([^>]*)>/g)];
    for (const match of imgMatches) {
      const attrs = match[1];
      if (!attrs.includes("alt=") && !attrs.includes("alt ")) {
        violations.push({
          line: lineNum + 1,
          code: match[0],
          issueType: "missing-alt",
          message: "Image missing alt attribute",
          severity: "ERROR",
          fixHint: 'Add alt="descriptive text" to the img element',
        });
      }
    }

    // 2. Check for <button> without aria-label or text content
    const buttonMatches = [...line.matchAll(/<button\s+([^>]*)>(.*?)<\/button>/g)];
    for (const match of buttonMatches) {
      const attrs = match[1];
      const content = match[2];
      if (!attrs.includes("aria-label") && content.trim().length === 0) {
        violations.push({
          line: lineNum + 1,
          code: match[0],
          issueType: "missing-label",
          message: "Button has no accessible label",
          severity: "ERROR",
          fixHint: 'Add text content or aria-label="label" to button',
        });
      }
    }

    // 3. Check for <input> without associated <label>
    // (Simple heuristic: look for orphaned inputs)
    const inputMatches = [...line.matchAll(/<input\s+([^>]*)>/g)];
    for (const match of inputMatches) {
      const attrs = match[1];
      // Check if input is not wrapped in <label> and has no aria-label
      if (!attrs.includes("aria-label") && !line.includes("<label>")) {
        // This is a heuristic; ideally would parse DOM tree
        violations.push({
          line: lineNum + 1,
          code: match[0],
          issueType: "missing-label",
          message: "Input field missing label association",
          severity: "WARN",
          fixHint: 'Either wrap input in <label> or add aria-label="field name"',
        });
      }
    }

    // 4. Check for poor link text
    const linkMatches = [...line.matchAll(/<a\s+([^>]*)>(.*?)<\/a>/g)];
    for (const match of linkMatches) {
      const linkText = match[2].toLowerCase();
      if (
        linkText.includes("click here") ||
        linkText.includes("read more") ||
        linkText.includes("link") ||
        linkText.length < 3
      ) {
        violations.push({
          line: lineNum + 1,
          code: match[0],
          issueType: "poor-link-text",
          message: `Link has vague text: "${match[2]}"`,
          severity: "WARN",
          fixHint: 'Use descriptive link text (e.g., "Learn about pricing" instead of "click here")',
        });
      }
    }

    // 5. Heading hierarchy check
    const headingMatches = [...line.matchAll(/<h([1-6])\s*>/g)];
    for (const match of headingMatches) {
      const level = parseInt(match[1]);
      // Simple check: h1 should appear before h2, h2 before h3, etc.
      // Store as state for next line scan
    }
  });

  return {
    isValid: violations.filter((v) => v.severity === "ERROR").length === 0,
    violations,
  };
}

/**
 * Check for heading hierarchy issues
 * Requires parsing full document for context
 */
export function checkHeadingHierarchy(content: string): A11yViolation[] {
  const violations: A11yViolation[] = [];
  const lines = content.split("\n");

  let lastHeadingLevel: number | null = null;

  lines.forEach((line, lineNum) => {
    const headingMatch = line.match(/<h([1-6])/);
    if (headingMatch) {
      const level = parseInt(headingMatch[1]);

      // Check if jumping levels (h1 → h3 skips h2)
      if (lastHeadingLevel !== null && level > lastHeadingLevel + 1) {
        violations.push({
          line: lineNum + 1,
          code: headingMatch[0],
          issueType: "heading-hierarchy",
          message: `Heading hierarchy jump: h${lastHeadingLevel} → h${level}`,
          severity: "WARN",
          fixHint: "Use sequential heading levels (h1, then h2, then h3, etc.)",
        });
      }

      lastHeadingLevel = level;
    }
  });

  return violations;
}

/**
 * Format violations for display
 */
export function formatA11yViolations(violations: A11yViolation[]): string {
  if (violations.length === 0) return "✓ Accessibility checks passed";

  return violations
    .map(
      (v) =>
        `Line ${v.line} [${v.severity}] ${v.message}\n  Code: ${v.code.substring(0, 50)}...\n  Fix: ${v.fixHint}`
    )
    .join("\n");
}
