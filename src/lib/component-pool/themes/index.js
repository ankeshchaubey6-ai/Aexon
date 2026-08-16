export * from "./base.js";
export * from "./dark.js";
export * from "./saas.js";
export * from "./tokens/colors.js";
export * from "./tokens/typography.js";
export * from "./tokens/spacing.js";
export * from "./tokens/shadows.js";
export * from "./tokens/breakpoints.js";
// ─────────────────────────────────────────────────────────────────────────────
// THEMES — Barrel Export
// Import from here: import { baseTheme, darkTheme, saasTheme } from "@/lib/component-pool/themes"
// ─────────────────────────────────────────────────────────────────────────────

// ── Tokens (raw design values) ────────────────────────────────────────────────
export * from "./tokens/colors.js";
export * from "./tokens/typography.js";
export * from "./tokens/spacing.js";
export * from "./tokens/shadows.js";
export * from "./tokens/breakpoints.js";

// ── Themes ────────────────────────────────────────────────────────────────────
export * from "./base.js";
export * from "./dark.js";
export * from "./saas.js";
export * from "./ecommerce.js";
export * from "./startup.js";

// ─────────────────────────────────────────────────────────────────────────────
// Theme registry
// Maps site type / theme name → theme preset object.
// Used by the AI engine's theme-resolver.
// ─────────────────────────────────────────────────────────────────────────────
import { baseTheme, generateCSSVars, applyTheme } from "./base.js";
import { darkTheme, deepMerge, getDarkTheme }      from "./dark.js";
import { saasTheme }       from "./saas.js";
import { ecommerceTheme }  from "./ecommerce.js";
import { startupTheme }    from "./startup.js";

/** All available theme presets */
export const themeRegistry = {
  base:       baseTheme,
  saas:       deepMerge(baseTheme, saasTheme),
  ecommerce:  deepMerge(baseTheme, ecommerceTheme),
  startup:    deepMerge(baseTheme, startupTheme),
  // Dark variants
  darkBase:      getDarkTheme(baseTheme),
  darkSaas:      getDarkTheme(deepMerge(baseTheme, saasTheme)),
  darkEcommerce: getDarkTheme(deepMerge(baseTheme, ecommerceTheme)),
};

/**
 * Resolve a theme by name and mode.
 *
 * @param {"base"|"saas"|"ecommerce"|"startup"} preset
 * @param {"light"|"dark"|"system"}             mode
 * @returns {object} resolved theme
 */
export function resolveTheme(preset = "base", mode = "light") {
  const effectiveMode =
    mode === "system"
      ? typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light"
      : mode;

  const presetTheme = {
    base:      baseTheme,
    saas:      deepMerge(baseTheme, saasTheme),
    ecommerce: deepMerge(baseTheme, ecommerceTheme),
    startup:   deepMerge(baseTheme, startupTheme),
  }[preset] ?? baseTheme;

  return effectiveMode === "dark" ? getDarkTheme(presetTheme) : presetTheme;
}

/**
 * Infer the best theme preset from a site type string.
 * Used by the AI component selector.
 *
 * @param {"landing"|"saas"|"ecommerce"|"dashboard"|"startup"|"blog"|"portfolio"|"auth"|"docs"} siteType
 * @returns {"base"|"saas"|"ecommerce"|"startup"}
 */
export function inferThemeFromSiteType(siteType) {
  const map = {
    landing:   "base",
    saas:      "saas",
    ecommerce: "ecommerce",
    startup:   "startup",
    waitlist:  "startup",
    dashboard: "saas",
    blog:      "base",
    portfolio: "base",
    agency:    "base",
    auth:      "saas",
    docs:      "base",
  };
  return map[siteType] ?? "base";
}

// Re-export utilities
export { generateCSSVars, applyTheme, deepMerge, getDarkTheme };