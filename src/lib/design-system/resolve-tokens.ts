/**
 * resolve-tokens.ts — Theme resolution
 * 
 * Takes a theme name and optional overrides, returns a fully-populated CSSVariableManifest
 * with concrete CSS values for every token.
 * 
 * Used by: resolve-design-tokens step
 * Outputs to: LLM context (via format-tokens.ts) and CSS injection (via manifest-to-css.ts)
 */

import type { CSSVariableManifest } from "./types";
import { TOKEN_TAXONOMY, isValidToken } from "./types";

/**
 * Default theme manifest — fallback values
 */
const DEFAULT_THEME: CSSVariableManifest = {
  colors: {
    "--color-bg-primary": "#ffffff",
    "--color-bg-secondary": "#f9fafb",
    "--color-bg-elevated": "#f3f4f6",
    "--color-bg-hover": "#eeeff2",
    "--color-fg-primary": "#111827",
    "--color-fg-secondary": "#4b5563",
    "--color-fg-muted": "#9ca3af",
    "--color-accent-primary": "#3b82f6",
    "--color-accent-secondary": "#8b5cf6",
    "--color-border-default": "#e5e7eb",
    "--color-border-strong": "#d1d5db",
    "--color-border-subtle": "#f3f4f6",
    "--color-success": "#10b981",
    "--color-warning": "#f59e0b",
    "--color-danger": "#ef4444",
    "--color-info": "#0ea5e9",
  },
  typography: {
    "--font-family-sans": "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    "--font-family-serif": "Georgia, 'Times New Roman', serif",
    "--font-family-mono": "'SF Mono', Monaco, 'Cascadia Code', monospace",
    "--font-size-xs": "0.75rem",
    "--font-size-sm": "0.875rem",
    "--font-size-base": "1rem",
    "--font-size-lg": "1.125rem",
    "--font-size-xl": "1.25rem",
    "--font-size-2xl": "1.5rem",
    "--font-size-3xl": "1.875rem",
    "--font-size-4xl": "2.25rem",
    "--font-size-5xl": "3rem",
    "--font-size-6xl": "3.75rem",
    "--font-weight-normal": "400",
    "--font-weight-medium": "500",
    "--font-weight-semibold": "600",
    "--font-weight-bold": "700",
    "--line-height-tight": "1.25",
    "--line-height-normal": "1.5",
    "--line-height-loose": "1.75",
  },
  spacing: {
    "--space-0": "0px",
    "--space-1": "0.25rem",
    "--space-2": "0.5rem",
    "--space-3": "0.75rem",
    "--space-4": "1rem",
    "--space-6": "1.5rem",
    "--space-8": "2rem",
    "--space-12": "3rem",
    "--space-16": "4rem",
    "--space-20": "5rem",
    "--space-24": "6rem",
    "--space-32": "8rem",
  },
  radius: {
    "--radius-none": "0",
    "--radius-sm": "0.25rem",
    "--radius-md": "0.375rem",
    "--radius-lg": "0.5rem",
    "--radius-full": "9999px",
  },
  shadows: {
    "--shadow-none": "none",
    "--shadow-sm": "0 1px 2px 0 rgba(0, 0, 0, 0.05)",
    "--shadow-md": "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
    "--shadow-lg": "0 10px 15px -3px rgba(0, 0, 0, 0.1)",
    "--shadow-xl": "0 20px 25px -5px rgba(0, 0, 0, 0.1)",
    "--shadow-2xl": "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
  },
  motion: {
    "--duration-fast": "150ms",
    "--duration-normal": "250ms",
    "--duration-slow": "400ms",
    "--easing-standard": "cubic-bezier(0.25, 0.46, 0.45, 0.94)",
    "--easing-emphasized": "cubic-bezier(0.34, 1.56, 0.64, 1)",
  },
};

/**
 * Theme presets — per-industry overrides
 * These get merged on top of DEFAULT_THEME
 */
const THEME_PRESETS: Record<string, Partial<CSSVariableManifest>> = {
  saas: {
    colors: {
      "--color-accent-primary": "#6366f1",
      "--color-accent-secondary": "#a78bfa",
    },
  },
  ecommerce: {
    colors: {
      "--color-accent-primary": "#ec4899",
      "--color-accent-secondary": "#f472b6",
    },
  },
  portfolio: {
    colors: {
      "--color-accent-primary": "#8b5cf6",
      "--color-accent-secondary": "#d8b4fe",
    },
  },
  landing: {
    colors: {
      "--color-accent-primary": "#3b82f6",
      "--color-accent-secondary": "#60a5fa",
    },
  },
};

/**
 * Resolve a theme name + overrides into a fully-populated CSSVariableManifest
 */
export function resolveTokens(input: {
  theme: string;
  overrides?: Partial<CSSVariableManifest>;
}): CSSVariableManifest {
  const { theme, overrides } = input;

  // Start with defaults
  let manifest = JSON.parse(JSON.stringify(DEFAULT_THEME)) as CSSVariableManifest;

  // Apply theme preset if available
  if (THEME_PRESETS[theme]) {
    manifest = deepMerge(manifest, THEME_PRESETS[theme] as CSSVariableManifest);
  }

  // Apply user overrides
  if (overrides) {
    manifest = deepMerge(manifest, overrides);
  }

  // Validate every token exists
  for (const category of Object.values(TOKEN_TAXONOMY)) {
    for (const token of category) {
      const category_key = token.split("-")[1] as keyof CSSVariableManifest;
      if (!manifest[category_key]) {
        throw new Error(`Missing token category for ${token}`);
      }
    }
  }

  // Validate every value is present
  for (const [category, tokens] of Object.entries(TOKEN_TAXONOMY)) {
    for (const token of tokens as readonly string[]) {
      const cat_key = category as keyof CSSVariableManifest;
      const token_key = token as any;
      if (!manifest[cat_key][token_key]) {
        throw new Error(`Missing value for token ${token}`);
      }
    }
  }

  return manifest;
}

/**
 * Deep merge utility
 */
function deepMerge(base: any, overrides: any): any {
  const result = { ...base };
  for (const [key, value] of Object.entries(overrides)) {
    if (value && typeof value === "object" && key in result && typeof result[key] === "object") {
      result[key] = deepMerge(result[key], value);
    } else {
      result[key] = value;
    }
  }
  return result;
}
