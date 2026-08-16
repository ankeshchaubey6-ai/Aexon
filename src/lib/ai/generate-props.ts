/**
 * lib/ai/generate-props.ts
 * 
 * POOL_MATCH Generator — Instantiate Pool Components with Props
 * 
 * Input:
 *   - section intent
 *   - chosen pool component
 *   - tokens (design system)
 * Output:
 *   - props object to pass to component
 * 
 * Uses LLM to generate appropriate props for the pool component
 * based on section intent and component interface
 */

import type { ResolvedSection } from "@/lib/resolver/types";
import type { ComponentMeta } from "@/lib/component-pool/registry/types";
import type { CSSVariableManifest } from "@/lib/design-system/types";

export interface GeneratePropsInput {
  section: ResolvedSection;
  component: ComponentMeta;
  tokens: CSSVariableManifest;
}

export interface GeneratePropsOutput {
  props: Record<string, unknown>;
  generationNotes: string;
}

/**
 * Generate props for a pool component
 */
export async function generateProps(input: GeneratePropsInput): Promise<GeneratePropsOutput> {
  const { section, component, tokens } = input;

  // Build component interface description from ComponentMeta
  const interfaceDesc = describeComponentInterface(component);

  // TODO: Call Claude to generate props
  // const response = await callClaudeAPI({
  //   system: `You are a web component instantiation expert. Given a component interface and a section intent, generate appropriate props.`,
  //   messages: [{
  //     role: "user",
  //     content: `
  //       Component: ${component.name}
  //       Interface: ${interfaceDesc}
  //       Section Intent: ${section.intent.category} - ${section.intent.description}
  //       Content Hints: ${JSON.stringify(section.intent.contentHints)}
  //
  //       Generate a props object that would instantiate this component appropriately.
  //       Output ONLY valid JSON, no markdown.
  //     `
  //   }]
  // })

  // Mock response for now
  const mockProps = generateMockProps(component, section);

  return {
    props: mockProps,
    generationNotes: `Generated props for ${component.name} to fulfill ${section.intent.category} intent`,
  };
}

/**
 * Describe component interface in human-readable format
 */
function describeComponentInterface(component: ComponentMeta): string {
  const props = component.props
    .map((p) => `- ${p.name} (${p.type})${p.required ? " [REQUIRED]" : ""}: ${p.description}`)
    .join("\n");

  const variants = component.variants
    .map((v) => `- ${v.name}: ${v.description}`)
    .join("\n");

  return `
Props:
${props}

Variants:
${variants}

Slots:
${component.slots.map((s) => `- ${s.name}: ${s.description}`).join("\n")}

Examples: ${component.examples.join(", ")}
`;
}

/**
 * Generate mock props based on component and section intent
 */
function generateMockProps(component: ComponentMeta, section: ResolvedSection): Record<string, unknown> {
  const props: Record<string, unknown> = {};

  // For each required prop, generate a value
  for (const prop of component.props.filter((p) => p.required)) {
    if (prop.type === "string") {
      // Use content hints if available
      if (section.intent.contentHints?.headline && prop.name.includes("headline")) {
        props[prop.name] = section.intent.contentHints.headline || "Your Headline";
      } else if (section.intent.contentHints?.ctaLabel && prop.name.includes("button")) {
        props[prop.name] = section.intent.contentHints.ctaLabel || "Learn More";
      } else {
        props[prop.name] = prop.defaultValue || `Sample ${prop.name}`;
      }
    } else if (prop.type === "number") {
      props[prop.name] = prop.defaultValue || 0;
    } else if (prop.type === "boolean") {
      props[prop.name] = prop.defaultValue ?? false;
    } else if (prop.type === "array") {
      props[prop.name] = [];
    }
  }

  return props;
}

/**
 * Format generated props to TSX/JSX code
 */
export function formatPropsAsJsx(props: Record<string, unknown>): string {
  return Object.entries(props)
    .map(([key, value]) => {
      if (typeof value === "string") {
        return `${key}="${value}"`;
      } else if (typeof value === "boolean") {
        return value ? key : `${key}={false}`;
      } else {
        return `${key}={${JSON.stringify(value)}}`;
      }
    })
    .join("\n  ");
}
