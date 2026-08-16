/**
 * inngest/steps/assemble-pages.step.ts
 * 
 * Step 8: Assemble Pages
 * 
 * Input:
 *   - resolvedSections[] (with tier decision and chosen components)
 *   - tokens (CSS variable manifest)
 * Output:
 *   - AIFile[] (generated .tsx/.css files for all sections and pages)
 * 
 * Routing:
 * - POOL_MATCH: Call generate-props to instantiate component
 * - POOL_ADAPT: Call generate-adapter to create wrapper
 * - CUSTOM_GENERATE: Call generate-custom to create from scratch
 * 
 * Then combines all files into page index, layout, styles
 */


import { inngest } from "../client";
import { manifestToInlineStyle } from "@/lib/design-system/manifest-to-css";
import {
  normalizeImportPath,
  buildFilePath,
  getImportStatement,
  validateNoDoubleExtension,
  validateComponentPath,
} from "@/lib/utils/path-utils";

import type { AIFile } from "@/lib/types/ai-file";
import type { ResolvedSection } from "@/lib/resolver/types";
import type { CSSVariableManifest } from "@/lib/design-system/types";

export interface AssemblePagesInput {
  projectId: string;
  resolvedSections: ResolvedSection[];
  tokens: CSSVariableManifest;
  onPing?: (msg: string) => void;
}

export interface AssemblePagesOutput {
  files: AIFile[];
  fileCount: number;
  componentCount: number;
  styleCount: number;
}

/**
 * Generate component files from resolved sections
 * Routes to appropriate generator based on tier
 */
export async function assemblePagesStep(input: AssemblePagesInput): Promise<AssemblePagesOutput> {
  const { projectId, resolvedSections, tokens, onPing } = input;

  onPing?.("[Step 8] Assembling pages from resolved sections...");

  try {
    const files: AIFile[] = [];

    // 1. Generate global styles file
    const globalCss = manifestToInlineStyle(tokens);
    
    // Ensure CSS has closing braces and is valid
    const sanitizedCss = globalCss.trim().endsWith("}") 
      ? globalCss 
      : globalCss.trim() + "\n}";
    
    files.push({
      path: "src/styles/tokens.css",
      content: sanitizedCss,
      provenance: "assembly",
    });

    onPing?.("[Step 8] ✓ Generated global tokens (styles/tokens.css)");

    // 2. For each resolved section, generate component file
    let poolMatchCount = 0;
    let poolAdaptCount = 0;
    let customGenCount = 0;

    for (const section of resolvedSections) {
      let componentSource = "";

      if (section.tier === "POOL_MATCH") {
        // Use pool component as-is with props
        componentSource = generatePoolMatchComponent(section);
        poolMatchCount++;
      } else if (section.tier === "POOL_ADAPT") {
        // Create wrapper around pool component
        componentSource = generatePoolAdaptComponent(section);
        poolAdaptCount++;
      } else {
        // Generate custom component from scratch
        componentSource = generateCustomComponent(section, tokens);
        customGenCount++;
      }

      // Normalize import path and validate
      const normalizedPath = normalizeImportPath(section.importPath);
      const pathValidation = validateComponentPath(normalizedPath);

      if (!pathValidation.valid) {
        onPing?.(
          `[Step 8] ⚠ Path validation warning for ${section.sectionId}: ${pathValidation.errors.join("; ")}`
        );
      }

      // Ensure no double extensions
      if (!validateNoDoubleExtension(normalizedPath)) {
        onPing?.(
          `[Step 8] ✗ Critical: Double extension detected in ${section.sectionId}, skipping`
        );
        continue;
      }

      // Build proper file path with .tsx extension
      const properFilePath = buildFilePath(normalizedPath, "tsx");

      files.push({
        path: properFilePath,
        content: componentSource,
        provenance: section.tier === "POOL_MATCH" ? "pool" : section.tier === "POOL_ADAPT" ? "assembly" : "custom",
      });

      onPing?.(`[Step 8] Generated ${section.sectionId} (${section.tier}) -> ${properFilePath}`);
    }

    // 3. Generate page index
    const pageIndex = generatePageIndex(resolvedSections);
    files.push({
      path: `pages/index.tsx`,
      content: pageIndex,
      provenance: "assembly",
    });

    // 4. Generate layout wrapper
    const layout = generateLayout(tokens);
    files.push({
      path: `layout.tsx`,
      content: layout,
      provenance: "assembly",
    });

    onPing?.(
      `[Step 8] ✓ Assembled: ${poolMatchCount} POOL_MATCH, ${poolAdaptCount} POOL_ADAPT, ${customGenCount} CUSTOM + global styles + page + layout`
    );

    return {
      files,
      fileCount: files.length,
      componentCount: customGenCount + poolMatchCount + poolAdaptCount,
      styleCount: 1,
    };
  } catch (err) {
    onPing?.(`[Step 8] ✗ Error: ${err instanceof Error ? err.message : "Unknown error"}`);
    throw err;
  }
}

/**
 * Generate POOL_MATCH component (use pool component directly)
 */
function generatePoolMatchComponent(section: ResolvedSection): string {
  if (!section.component) return "";

  // Build proper component name from section ID
  const componentName =
    section.sectionId.charAt(0).toUpperCase() +
    section.sectionId
      .slice(1)
      .replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());

  // Build props string safely
  const propsStr = section.props
    ? Object.entries(section.props)
        .map(([k, v]) => `${k}={${JSON.stringify(v)}}`)
        .join("\n        ")
    : "";

  return `/**
 * Generated from pool: ${section.component.name}
 * Tier: POOL_MATCH (${section.component.description || "direct instantiation"})
 */

import { ${section.component.name} } from '${section.component.importPath}';

export default function ${componentName}() {
  return (
    <section id="${section.sectionId}" className="pool-match-section">
      <${section.component.name} 
        ${propsStr}
      />
    </section>
  );
}
`;
}

/**
 * Generate POOL_ADAPT component (wrapper around pool component)
 */
function generatePoolAdaptComponent(section: ResolvedSection): string {
  if (!section.component) return "";

  // Build proper component name from section ID
  const componentName =
    section.sectionId.charAt(0).toUpperCase() +
    section.sectionId
      .slice(1)
      .replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());

  return `/**
 * Generated adapter for pool component: ${section.component.name}
 * Tier: POOL_ADAPT (wrapper adapter)
 */

import { ${section.component.name} } from '${section.component.importPath}';

interface ${componentName}Props {
  // Adapter-specific props can go here
}

export default function ${componentName}(props: ${componentName}Props) {
  return (
    <section id="${section.sectionId}" className="pool-adapt-section">
      <div className="adapter-wrapper">
        <${section.component.name} 
          {...props}
        />
      </div>
    </section>
  );
}
`;
}

/**
 * Generate CUSTOM_GENERATE component (full custom code)
 */
function generateCustomComponent(section: ResolvedSection, tokens: CSSVariableManifest): string {
  // Build proper component name from section ID
  const componentName =
    section.sectionId.charAt(0).toUpperCase() +
    section.sectionId
      .slice(1)
      .replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());

  return `/**
 * Custom-generated component for: ${section.intent.category}
 * Tier: CUSTOM_GENERATE (full custom)
 * Intent: ${section.intent.description}
 */

export default function ${componentName}() {
  return (
    <section id="${section.sectionId}" className="custom-section">
      <div className="container">
        <h2 
          style={{ 
            color: 'var(--color-fg-primary)', 
            fontSize: 'var(--font-size-2xl)',
            marginBottom: '1rem'
          }}
        >
          ${section.intent.description}
        </h2>
        <p className="custom-content">
          Custom ${section.intent.category} component content
        </p>
      </div>
    </section>
  );
}
`;
}

/**
 * Generate page index that composes all sections
 */
function generatePageIndex(sections: ResolvedSection[]): string {
  // Build imports with proper path handling
  const imports = sections
    .map((s) => {
      const normalized = normalizeImportPath(s.importPath);
      // For imports in generated index, use direct path reference
      const properPath = buildFilePath(normalized, "tsx");
      // Convert to relative import for generated pages
      const relativePath = `./${properPath.replace("src/", "")}`;
      return `import ${s.sectionId} from '${relativePath}';`;
    })
    .join("\n");

  const components = sections.map((s) => `<${s.sectionId} />`).join("\n    ");

  return `/**
 * Generated page index
 * Composes all sections in order
 */

${imports}

export default function Page() {
  return (
    <main className="page-container">
      ${components}
    </main>
  );
}
`;
}

/**
 * Generate layout wrapper
 */
function generateLayout(tokens: CSSVariableManifest): string {
  return `/**
 * Generated layout wrapper
 * Provides global styles and structure
 */

import './styles/tokens.css';

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="description" content="Generated by AI Builder" />
        <title>AI Generated Site</title>
      </head>
      <body className="layout-root">
        <div id="root">
          {children}
        </div>
      </body>
    </html>
  );
}
`;
}

/**
 * Inngest event definition
 */
export const assemblePagesEvent = inngest.createFunction(
  { id: "assemble-pages", triggers: [{ event: "ai/assemble-pages" }] },
  async ({ event, logger, step }) => {
    logger.info("assemble-pages", { projectId: event.data.projectId });

    const result = await step.run("assemble", async () => {
      return assemblePagesStep(event.data as AssemblePagesInput);
    });

    return result;
  }
);
