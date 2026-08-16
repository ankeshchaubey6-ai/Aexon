/**
 * inngest/steps/parse-intent.step.ts
 * 
 * Step 1: Parse Intent
 * 
 * Input:
 *   - userPrompt (free-form text about desired website)
 * Output:
 *   - SitePlan with structured pages/sections/intents
 * 
 * LLM Call: Uses Claude to understand intent and produce JSON
 * Output is validated against SitePlan schema before returning
 */

import { inngest } from "../client";
import { validateSitePlan } from "@/lib/types/site-plan";

import type { SitePlan } from "@/lib/types/site-plan";

export interface ParseIntentInput {
  projectId: string;
  userPrompt: string;
  onPing?: (msg: string) => void;
}

export interface ParseIntentOutput {
  sitePlan: SitePlan;
  tokensUsed: {
    input: number;
    output: number;
  };
}

/**
 * LLM system prompt for intent parsing
 */
const INTENT_PARSER_SYSTEM = `You are an expert web designer. Your task is to analyze a user's website request and output a structured site plan.

You MUST output ONLY valid JSON matching this TypeScript interface (no markdown, no explanation):

{
  "industry": "string",
  "mood": "string (vibrant|minimal|corporate|playful|elegant)",
  "brandName": "string",
  "brandTagline": "string",
  "pages": [
    {
      "path": "/",
      "title": "string",
      "metaDescription": "string",
      "sections": [
        {
          "id": "section_1",
          "intent": {
            "category": "hero|features|testimonials|pricing|cta|footer|nav|gallery|form|stats|faq|team|blog-list|custom",
            "description": "what this section shows",
            "tags": ["tag1", "tag2"],
            "contentHints": {
              "headline": "primary headline",
              "subheadline": "supporting text",
              "bulletPoints": ["any other content hints"],
              "ctaLabel": "button text",
              "description": "section-specific copy"
            }
          },
          "order": 0
        }
      ]
    }
  ]
}

SEMANTIC CATEGORIES:
- hero: Page hero/banner with headline, subheadline, CTA
- features: Feature list/grid showing product benefits
- testimonials: Social proof via customer testimonials
- pricing: Pricing table with tiers and CTA
- cta: Call-to-action banner, minimal design
- footer: Page footer with links, copyright, social
- nav: Navigation bar/header
- gallery: Image/portfolio gallery
- form: Contact/signup form
- stats: Statistics/metrics display
- faq: Frequently asked questions accordion
- team: Team member profiles
- blog-list: Blog post listing
- custom: Other component type

CONTENT HINTS SHOULD INCLUDE:
- For hero: headlines, subheadlines, CTA button text
- For features: feature names/descriptions
- For pricing: tier names, prices, features
- For form: field labels, placeholder text
- For any section: actual content the user wants`;

/**
 * Parse user prompt into structured SitePlan
 * Calls Claude API to understand intent
 */
export async function parseIntentStep(input: ParseIntentInput): Promise<ParseIntentOutput> {
  const { projectId, userPrompt, onPing } = input;

  onPing?.("[Step 1] Parsing user intent...");

  try {
    // TODO: Call Claude API directly or via inngest function
    // For now, return a mock response
    // In production, this would be:
    // const response = await callClaudeAPI({
    //   system: INTENT_PARSER_SYSTEM,
    //   messages: [{ role: "user", content: userPrompt }],
    //   model: "claude-opus",
    //   temperature: 0.7,
    // })

    onPing?.("[Step 1] Calling LLM for intent analysis...");

    // Mock response for demonstration
    const mockSitePlan: SitePlan = {
      industry: "saas",
      mood: "minimal",
      brandName: "Your Brand",
      brandTagline: "Your tagline here",
      pages: [
        {
          path: "/",
          title: "Home",
          metaDescription: "Welcome to our platform",
          sections: [
            {
              id: "hero_0",
              intent: {
                category: "hero",
                description: "Main hero section with headline",
                tags: ["hero", "landing"],
                contentHints: {
                  headline: "Welcome to our platform",
                  ctaLabel: "Get Started",
                },
              },
              order: 0,
            },
            {
              id: "features_1",
              intent: {
                category: "features",
                description: "Feature showcase section",
                tags: ["features", "benefits"],
                contentHints: {
                  headline: "Our Features",
                  bulletPoints: ["Feature 1", "Feature 2", "Feature 3"],
                },
              },
              order: 1,
            },
            {
              id: "cta_2",
              intent: {
                category: "cta",
                description: "Call-to-action for signup",
                tags: ["cta", "conversion"],
                contentHints: {
                  ctaLabel: "Start Free Trial",
                },
              },
              order: 2,
            },
          ],
        },
      ],
    };

    // Validate parsed plan
    validateSitePlan(mockSitePlan);

    onPing?.("[Step 1] ✓ Intent parsed into structured plan");

    return {
      sitePlan: mockSitePlan,
      tokensUsed: {
        input: 500, // Mock values
        output: 300,
      },
    };
  } catch (err) {
    onPing?.(`[Step 1] ✗ Error: ${err instanceof Error ? err.message : "Unknown error"}`);
    throw err;
  }
}

/**
 * Inngest event definition
 */
export const parseIntentEvent = inngest.createFunction(
  { id: "parse-intent", triggers: [{ event: "ai/parse-intent" }] },
  async ({ event, logger, step }) => {
    logger.info("parse-intent", { projectId: event.data.projectId });

    const result = await step.run("parse", async () => {
      return parseIntentStep(event.data as ParseIntentInput);
    });

    return result;
  }
);
