/**
 * lib/ai/generate-custom.ts
 * 
 * CUSTOM_GENERATE Generator — Full Component Generation
 * 
 * Input:
 *   - section intent (detailed description of needed component)
 *   - tokens (design system with CSS variables)
 *   - content hints (headlines, CTA labels, etc.)
 * Output:
 *   - Full TSX component source code
 * 
 * Use case: No pool component matches (score < 0.60), generate from scratch
 * Constraints: MUST use only CSS variable tokens, no hardcoded values
 */

import type { ResolvedSection } from "@/lib/resolver/types";
import type { CSSVariableManifest } from "@/lib/design-system/types";
import type { SemanticIntentCategory } from "@/lib/types/site-plan";

export interface GenerateCustomInput {
  section: ResolvedSection;
  tokens: CSSVariableManifest;
  previouslyGenerated?: string[]; // Other custom components from this project
}

export interface GenerateCustomOutput {
  source: string; // Full component source code
  imports: string[]; // External imports needed
  usesTokens: string[]; // Which CSS variables are used
}

/**
 * Generate a custom component from scratch
 */
export async function generateCustom(input: GenerateCustomInput): Promise<GenerateCustomOutput> {
  const { section, tokens } = input;

  // TODO: Call Claude to generate component
  // const response = await callClaudeAPI({
  //   system: CUSTOM_GENERATION_SYSTEM,
  //   messages: [{
  //     role: "user",
  //     content: `
  //       Category: ${section.intent.category}
  //       Description: ${section.intent.description}
  //       Content Hints: ${JSON.stringify(section.intent.contentHints)}
  //       Available Tokens: ${JSON.stringify(tokens)}
  //
  //       Generate a React component in TypeScript/TSX that implements this intent.
  //       CRITICAL: Use ONLY CSS variables from tokens (var(--color-*), var(--space-*), etc)
  //       NEVER use hardcoded colors, sizes, or fonts.
  //     `
  //   }]
  // })

  const source = generateMockCustom(section, tokens);
  const usesTokens = extractTokensFromSource(source);

  return {
    source,
    imports: ["React"],
    usesTokens,
  };
}

/**
 * Generate mock custom component
 */
function generateMockCustom(section: ResolvedSection, tokens: CSSVariableManifest): string {
  const componentName = section.sectionId;
  const category = section.intent.category;

  // Generate appropriate component structure based on category
  let componentBody = "";

  switch (category) {
    case "hero":
      componentBody = `
    <section style={heroStyle}>
      <div style={containerStyle}>
        <h1 style={headingStyle}>Welcome to Our Platform</h1>
        <p style={descriptionStyle}>Discover amazing features and capabilities</p>
        <button style={buttonStyle}>Get Started</button>
      </div>
    </section>`;
      break;

    case "features":
      componentBody = `
    <section style={sectionStyle}>
      <h2 style={headingStyle}>Our Features</h2>
      <div style={gridStyle}>
        {['Feature 1', 'Feature 2', 'Feature 3'].map((feature, i) => (
          <div key={i} style={featureCardStyle}>
            <div style={featureIconStyle}>✨</div>
            <h3 style={featureHeadingStyle}>{feature}</h3>
            <p style={descriptionStyle}>Feature description goes here</p>
          </div>
        ))}
      </div>
    </section>`;
      break;

    case "pricing":
      componentBody = `
    <section style={sectionStyle}>
      <h2 style={headingStyle}>Pricing Plans</h2>
      <div style={gridStyle}>
        {[
          { name: 'Starter', price: '$29', features: ['Feature 1', 'Feature 2'] },
          { name: 'Pro', price: '$79', features: ['All Features', 'Priority Support'] },
        ].map((tier, i) => (
          <div key={i} style={pricingCardStyle}>
            <h3 style={tierNameStyle}>{tier.name}</h3>
            <div style={priceStyle}>{tier.price}/mo</div>
            <ul style={featureListStyle}>
              {tier.features.map((f, j) => <li key={j}>{f}</li>)}
            </ul>
            <button style={buttonStyle}>Select Plan</button>
          </div>
        ))}
      </div>
    </section>`;
      break;

    case "cta":
      componentBody = `
    <section style={ctaSectionStyle}>
      <div style={coreContainerStyle}>
        <h2 style={headingStyle}>Ready to Get Started?</h2>
        <p style={descriptionStyle}>Join thousands of satisfied customers</p>
        <button style={ctaButtonStyle}>Start Free Trial</button>
      </div>
    </section>`;
      break;

    case "faq":
      componentBody = `
    <section style={sectionStyle}>
      <h2 style={headingStyle}>Frequently Asked Questions</h2>
      <div style={faqListStyle}>
        {[
          { q: 'What is this?', a: 'This is an amazing platform' },
          { q: 'How do I start?', a: 'Sign up and get started in minutes' },
        ].map((item, i) => (
          <details key={i} style={faqItemStyle}>
            <summary style={faqQuestionStyle}>{item.q}</summary>
            <p style={faqAnswerStyle}>{item.a}</p>
          </details>
        ))}
      </div>
    </section>`;
      break;

    default:
      componentBody = `
    <section style={sectionStyle}>
      <div style={containerStyle}>
        <h2 style={headingStyle}>${section.intent.description}</h2>
        <p style={descriptionStyle}>Content goes here</p>
      </div>
    </section>`;
  }

  return `/**
 * Custom-generated component
 * Category: ${category}
 * Intent: ${section.intent.description}
 */

import React from 'react';

export default function ${componentName}() {
  // Define all styles as constants
  const sectionStyle = {
    padding: 'var(--space-16)',
    backgroundColor: 'var(--color-bg-primary)',
    color: 'var(--color-fg-primary)',
  };

  const containerStyle = {
    maxWidth: '1200px',
    margin: '0 auto',
  };

  const headingStyle = {
    fontSize: 'var(--font-size-3xl)',
    fontWeight: '700',
    marginBottom: 'var(--space-6)',
    color: 'var(--color-fg-primary)',
  };

  const descriptionStyle = {
    fontSize: 'var(--font-size-base)',
    color: 'var(--color-fg-secondary)',
    marginBottom: 'var(--space-4)',
    lineHeight: '1.5',
  };

  const buttonStyle = {
    padding: 'var(--space-3) var(--space-6)',
    backgroundColor: 'var(--color-accent-primary)',
    color: 'white',
    border: 'none',
    borderRadius: 'var(--radius-md)',
    cursor: 'pointer',
    fontSize: 'var(--font-size-base)',
    fontWeight: '600',
    transition: 'background-color 0.3s ease-in-out',
  };

  const gridStyle = {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
    gap: 'var(--space-6)',
    marginTop: 'var(--space-8)',
  };

  const cardStyle = {
    padding: 'var(--space-6)',
    backgroundColor: 'var(--color-bg-secondary)',
    borderRadius: 'var(--radius-lg)',
    border: '1px solid var(--color-border-default)',
  };

  return (${componentBody}
  );
}
`;
}

/**
 * Extract which CSS variables are used in the component source
 */
function extractTokensFromSource(source: string): string[] {
  const tokenRegex = /var\(--([a-z0-9-]+)\)/g;
  const matches = [...source.matchAll(tokenRegex)];
  return [...new Set(matches.map((m) => `--${m[1]}`))];
}

/**
 * Validation: ensure generated code uses ONLY valid tokens
 */
export function validateCustomGeneratedCode(source: string, validTokens: string[]): {
  isValid: boolean;
  invalidTokens: string[];
} {
  const tokenRegex = /var\(--([a-z0-9-]+)\)/g;
  const matches = [...source.matchAll(tokenRegex)];
  const usedTokens = new Set(matches.map((m) => `--${m[1]}`));

  const validTokenSet = new Set(validTokens);
  const invalidTokens = Array.from(usedTokens).filter((t) => !validTokenSet.has(t));

  return {
    isValid: invalidTokens.length === 0,
    invalidTokens,
  };
}
