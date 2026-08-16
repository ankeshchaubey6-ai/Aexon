/**
 * SitePlan — The canonical structured output of intent parsing
 * 
 * This is what the LLM produces when given a freeform user prompt.
 * It flows through the entire pipeline as the source of truth for
 * what the user wants to build.
 * 
 * Output from: parse-intent step (LLM structured output)
 * Input to: resolve-design-tokens, build-registry-context, resolve-components
 */

export type SemanticIntentCategory =
  | "hero"
  | "features"
  | "testimonials"
  | "pricing"
  | "cta"
  | "footer"
  | "nav"
  | "gallery"
  | "form"
  | "stats"
  | "faq"
  | "team"
  | "blog-list"
  | "custom";

export interface ContentHints {
  headline?: string;
  subheadline?: string;
  bulletPoints?: string[];
  ctaLabel?: string;
  ctaHref?: string;
  description?: string;
}

export interface SemanticIntent {
  /** UI component category from closed set */
  category: SemanticIntentCategory;

  /** 1-2 sentence natural language description of what this section should do */
  description: string;

  /** Semantic tags that qualify the intent ("dark", "centered", "with-image", etc) */
  tags: string[];

  /** Content hints for the LLM (headlines, CTA labels, etc) */
  contentHints: ContentHints;
}

export interface Section {
  /** Stable ID within the plan (used for caching, logging) */
  id: string;

  /** The semantic intent this section fulfills */
  intent: SemanticIntent;

  /** Order on the page (0 = first section) */
  order: number;
}

export interface Page {
  /** URL path for this page ("/", "/pricing", "/about", etc) */
  path: string;

  /** Page title (for <title> tag and navigation) */
  title: string;

  /** Meta description for SEO */
  metaDescription: string;

  /** Sections that make up this page, in order */
  sections: Section[];
}

export interface SitePlan {
  /** Industry/vertical: "saas" | "ecommerce" | "agency" | "landing" | "blog" | "portfolio" | "generic" */
  industry: string;

  /** Design mood: "minimal" | "bold" | "playful" | "professional" | "luxury" | "generic" */
  mood: string;

  /** Company/product name */
  brandName: string;

  /** Tagline or short brand description */
  brandTagline: string;

  /** Pages to build, in logical order */
  pages: Page[];
}

/**
 * Validation: Throw if:
 * - pages.length === 0
 * - any page has sections.length === 0
 * - industry is empty string
 * - any section has category === "custom" AND description is too vague
 */
export function validateSitePlan(plan: SitePlan): void {
  if (!plan.pages || plan.pages.length === 0) {
    throw new Error("SitePlan must have at least one page");
  }

  for (const page of plan.pages) {
    if (!page.sections || page.sections.length === 0) {
      throw new Error(`Page ${page.path} has no sections`);
    }
    for (const section of page.sections) {
      if (!section.intent.description || section.intent.description.length < 5) {
        throw new Error(
          `Section ${section.id} has invalid description: "${section.intent.description}"`
        );
      }
    }
  }

  if (!plan.industry || plan.industry.length === 0) {
    throw new Error("SitePlan industry cannot be empty");
  }

  if (!plan.brandName || plan.brandName.length === 0) {
    throw new Error("SitePlan brandName cannot be empty");
  }
}
