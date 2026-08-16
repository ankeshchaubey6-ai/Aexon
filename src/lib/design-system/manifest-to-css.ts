/**
 * manifest-to-css.ts — CSS Variable Stylesheet Generator
 * 
 * Converts a CSSVariableManifest into a :root { --token: value; } CSS string
 * that can be:
 * - Written to src/styles/tokens.css
 * - Injected into a <style> tag in HTML
 * 
 * Used by: assemble-pages step (inject into index.html <head>)
 */

import type { CSSVariableManifest, TokenName } from "./types";

/**
 * Generate a CSS string with :root selector from a manifest
 */
export function manifestToCss(manifest: CSSVariableManifest, selector = ":root"): string {
  const lines: string[] = [];

  // Flatten all token categories into lines
  for (const [category, tokens] of Object.entries(manifest)) {
    for (const [name, value] of Object.entries(tokens)) {
      // Validate the value is a string (not null, undefined, etc)
      if (typeof value !== "string" || value.length === 0) {
        throw new Error(`Invalid token value for ${name}: ${value}`);
      }
      lines.push(`  ${name}: ${value};`);
    }
  }

  return `${selector} {\n${lines.join("\n")}\n}`;
}

/**
 * Generate a CSS string for a specific media query (e.g., @media (prefers-color-scheme: dark))
 */
export function manifestToCssDark(manifest: CSSVariableManifest): string {
  const lines: string[] = [];

  for (const [category, tokens] of Object.entries(manifest)) {
    for (const [name, value] of Object.entries(tokens)) {
      if (typeof value !== "string" || value.length === 0) {
        throw new Error(`Invalid dark token value for ${name}: ${value}`);
      }
      lines.push(`  ${name}: ${value};`);
    }
  }

  return `@media (prefers-color-scheme: dark) {\n  :root {\n${lines.join("\n")}\n  }\n}`;
}

/**
 * For embedding in HTML <style> tag
 */
export function manifestToInlineStyle(manifest: CSSVariableManifest): string {
  return manifestToCss(manifest, ":root");
}

/**
 * For embedding in JSON (e.g., for passing to client-side CSS-in-JS)
 */
export function manifestToJson(manifest: CSSVariableManifest): Record<string, string> {
  const result: Record<string, string> = {};

  for (const [category, tokens] of Object.entries(manifest)) {
    for (const [name, value] of Object.entries(tokens) as [string, string][]) {
      result[name] = value;
    }
  }

  return result;
}
