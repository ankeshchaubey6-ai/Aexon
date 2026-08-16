/**
 * validators/check-content.ts — Semantic Content Validation
 * 
 * Quality gate: Ensure generated components have required content fields
 * - Hero: headline + subheadline present
 * - CTA: button text present
 * - Form: at least one input field
 * - Pricing: at least one tier
 * - FAQs: at least 3 items
 * 
 * This validator can run on component props or generated source code.
 * 
 * Used by: validate-quality step
 */

export interface ContentCheckResult {
  isValid: boolean;
  violations: ContentViolation[];
}

export interface ContentViolation {
  type: "missing-field" | "empty-field" | "insufficient-items" | "invalid-structure";
  message: string;
  severity: "ERROR" | "WARN";
  fixHint: string;
}

/**
 * Check if a component has required content fields
 * Takes a component name and its props object
 */
export function checkComponentContent(
  componentName: string,
  props: Record<string, any>
): ContentCheckResult {
  const violations: ContentViolation[] = [];

  // Component-specific requirements
  const checks: Record<string, (props: any) => ContentViolation[]> = {
    Hero: (props) => {
      const issues: ContentViolation[] = [];
      if (!props.headline || typeof props.headline !== "string" || props.headline.trim().length === 0) {
        issues.push({
          type: "missing-field",
          message: "Hero missing required 'headline' prop",
          severity: "ERROR",
          fixHint: "Add headline string (e.g., 'Welcome to our platform')",
        });
      }
      if (!props.subheadline || typeof props.subheadline !== "string") {
        issues.push({
          type: "missing-field",
          message: "Hero missing recommended 'subheadline' prop",
          severity: "WARN",
          fixHint: "Add subheadline string for context",
        });
      }
      return issues;
    },

    CTA: (props) => {
      const issues: ContentViolation[] = [];
      if (!props.buttonText || typeof props.buttonText !== "string" || props.buttonText.trim().length === 0) {
        issues.push({
          type: "missing-field",
          message: "CTA missing required 'buttonText' prop",
          severity: "ERROR",
          fixHint: "Add button label (e.g., 'Get Started', 'Learn More')",
        });
      }
      return issues;
    },

    Form: (props) => {
      const issues: ContentViolation[] = [];
      if (!Array.isArray(props.fields) || props.fields.length === 0) {
        issues.push({
          type: "insufficient-items",
          message: "Form has no input fields",
          severity: "ERROR",
          fixHint: "Add at least one form field definition",
        });
      }
      return issues;
    },

    Pricing: (props) => {
      const issues: ContentViolation[] = [];
      if (!Array.isArray(props.tiers) || props.tiers.length === 0) {
        issues.push({
          type: "insufficient-items",
          message: "Pricing has no tiers",
          severity: "ERROR",
          fixHint: "Add at least one pricing tier",
        });
      } else if (props.tiers.length < 2) {
        issues.push({
          type: "insufficient-items",
          message: "Pricing has only 1 tier (should have at least 2)",
          severity: "WARN",
          fixHint: "Add a second pricing tier for comparison",
        });
      }
      return issues;
    },

    FAQ: (props) => {
      const issues: ContentViolation[] = [];
      if (!Array.isArray(props.items) || props.items.length < 3) {
        issues.push({
          type: "insufficient-items",
          message: `FAQ has ${props.items?.length || 0} items (should have at least 3)`,
          severity: "WARN",
          fixHint: "Add at least 3 FAQ items for comprehensive coverage",
        });
      }
      return issues;
    },

    Features: (props) => {
      const issues: ContentViolation[] = [];
      if (!Array.isArray(props.features) || props.features.length < 3) {
        issues.push({
          type: "insufficient-items",
          message: `Features has ${props.features?.length || 0} items (should have at least 3)`,
          severity: "WARN",
          fixHint: "Add at least 3 features to show breadth",
        });
      }
      return issues;
    },

    Testimonials: (props) => {
      const issues: ContentViolation[] = [];
      if (!Array.isArray(props.items) || props.items.length < 2) {
        issues.push({
          type: "insufficient-items",
          message: `Testimonials has ${props.items?.length || 0} items (should have at least 2)`,
          severity: "WARN",
          fixHint: "Add at least 2 testimonials for credibility",
        });
      }
      return issues;
    },
  };

  const checker = checks[componentName];
  if (checker) {
    violations.push(...checker(props));
  }

  return {
    isValid: violations.filter((v) => v.severity === "ERROR").length === 0,
    violations,
  };
}

/**
 * Format violations for display
 */
export function formatContentViolations(violations: ContentViolation[]): string {
  if (violations.length === 0) return "✓ All required content present";

  return violations
    .map((v) => `[${v.severity}] ${v.message}\n  Fix: ${v.fixHint}`)
    .join("\n");
}
