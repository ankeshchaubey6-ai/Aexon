/**
 * validators/check-tokens.ts — Token Usage Validation
 * 
 * Quality gate: Ensure generated code uses ONLY approved CSS variable tokens,
 * never hardcoded colors/sizes/fonts.
 * 
 * This is a deterministic check that can run on both:
 * - Generated component source code (TSX/JSX)
 * - Generated CSS files
 * 
 * Used by: validate-quality step
 */

import { TOKEN_TAXONOMY, isValidToken } from "@/lib/design-system/types";

export interface TokenCheckResult {
  isValid: boolean;
  violations: TokenViolation[];
}

export interface TokenViolation {
  line: number;
  column?: number;
  code: string;
  message: string;
  severity: "ERROR" | "WARN";
  fixHint: string;
}

/**
 * Check if generated code uses only valid tokens, no hardcoded values
 */
export function checkTokensInCode(content: string): TokenCheckResult {
  const violations: TokenViolation[] = [];
  const lines = content.split("\n");

  // Pattern matching for common violations
  const patterns = [
    {
      regex: /#[0-9a-f]{3,8}/gi,
      description: "hardcoded color hex",
      severity: "ERROR" as const,
    },
    {
      regex: /rgb\s*\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*\)/gi,
      description: "hardcoded RGB color",
      severity: "ERROR" as const,
    },
    {
      regex: /\b(black|white|red|blue|green|yellow|pink|purple)\b/gi,
      description: "named color (should use token)",
      severity: "WARN" as const,
    },
    {
      regex: /\b\d+(px|rem|em)\b/g,
      description: "hardcoded size (should use spacing token)",
      severity: "WARN" as const,
    },
    {
      regex: /font(Size|Weight|Family)\s*:\s*['"]?(?!var\(--)/gi,
      description: "hardcoded font property (should use token)",
      severity: "ERROR" as const,
    },
  ];

  lines.forEach((line, lineNum) => {
    for (const { regex, description, severity } of patterns) {
      let match;
      while ((match = regex.exec(line)) !== null) {
        violations.push({
          line: lineNum + 1,
          column: match.index + 1,
          code: match[0],
          message: `Found ${description}: ${match[0]}`,
          severity,
          fixHint: `Replace with appropriate CSS variable token (e.g., var(--color-*) or var(--space-*))`,
        });
      }
    }
  });

  return {
    isValid: violations.filter((v) => v.severity === "ERROR").length === 0,
    violations,
  };
}

/**
 * Check CSS file specifically
 */
export function checkTokensInCss(cssContent: string): TokenCheckResult {
  const violations: TokenViolation[] = [];
  const lines = cssContent.split("\n");

  lines.forEach((line, lineNum) => {
    // In CSS, allow var() references
    if (line.includes("var(--")) {
      // Extract token name and validate
      const varMatches = line.matchAll(/var\((--[a-z0-9-]+)\)/g);
      for (const match of varMatches) {
        const tokenName = match[1];
        if (!isValidToken(tokenName)) {
          violations.push({
            line: lineNum + 1,
            column: match.index! + 1,
            code: match[0],
            message: `Unknown token: ${tokenName}`,
            severity: "ERROR",
            fixHint: `Token must be one of the approved names in TOKEN_TAXONOMY. Did you mean a variation?`,
          });
        }
      }
    }

    // Also check for hardcoded values
    const patterns = [
      {
        regex: /#[0-9a-f]{3,8}/gi,
        description: "hardcoded hex color",
      },
      {
        regex: /rgb\s*\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*\)/gi,
        description: "hardcoded RGB color",
      },
    ];

    for (const { regex, description } of patterns) {
      let match;
      while ((match = regex.exec(line)) !== null) {
        violations.push({
          line: lineNum + 1,
          column: match.index + 1,
          code: match[0],
          message: `Found hardcoded ${description} in CSS: ${match[0]}`,
          severity: "ERROR",
          fixHint: `Replace with var(--color-*) token`,
        });
      }
    }
  });

  return {
    isValid: violations.length === 0,
    violations,
  };
}

/**
 * Format violations for display
 */
export function formatTokenViolations(violations: TokenViolation[]): string {
  if (violations.length === 0) return "✓ All tokens valid";

  return violations
    .map((v) => `Line ${v.line}:${v.column || 1} [${v.severity}] ${v.message}\n  Fix: ${v.fixHint}`)
    .join("\n");
}
