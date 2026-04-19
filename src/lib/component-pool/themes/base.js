// ─────────────────────────────────────────────────────────────────────────────
// BASE THEME (light mode)
// The default theme object consumed by every component.
// Import and use directly, or feed into a CSS variable injector.
// ─────────────────────────────────────────────────────────────────────────────

import { colorTokens, ramps }    from "./tokens/colors.js";
import { fontFamily, fontSize, fontWeight, lineHeight, letterSpacing, fluidFontSize, prose, twText } from "./tokens/typography.js";
import { spacing, space, layout, borderRadius, componentSizes } from "./tokens/spacing.js";
import { shadows, glowShadows, focusRing, dropShadow, textShadow } from "./tokens/shadows.js";
import { breakpoints, breakpointValues, mq, containerMaxWidth, sectionPy, containerPx, gridCols } from "./tokens/breakpoints.js";

export const baseTheme = {
  // ── Meta ────────────────────────────────────────────────────────────────
  name:     "base",
  mode:     "light",
  version:  "2.0.0",

  // ── Colors ──────────────────────────────────────────────────────────────
  colors: colorTokens,
  ramps,

  // ── Typography ──────────────────────────────────────────────────────────
  typography: {
    fontFamily,
    fontSize,
    fluidFontSize,
    fontWeight,
    lineHeight,
    letterSpacing,
    prose,
    tw: twText,
  },

  // ── Spacing & Layout ────────────────────────────────────────────────────
  spacing,
  space,
  layout,
  borderRadius,
  componentSizes,

  // ── Shadows ─────────────────────────────────────────────────────────────
  shadows,
  glowShadows,
  focusRing,
  dropShadow,
  textShadow,

  // ── Breakpoints ─────────────────────────────────────────────────────────
  breakpoints,
  breakpointValues,
  mq,
  containerMaxWidth,
  gridCols,

  // ── Responsive helpers ───────────────────────────────────────────────────
  sectionPy,
  containerPx,

  // ── Transitions ──────────────────────────────────────────────────────────
  transition: {
    fast:   "all 150ms cubic-bezier(0.25,0.46,0.45,0.94)",
    normal: "all 250ms cubic-bezier(0.25,0.46,0.45,0.94)",
    slow:   "all 400ms cubic-bezier(0.25,0.46,0.45,0.94)",
    colors: "color 150ms ease, background-color 150ms ease, border-color 150ms ease",
    shadow: "box-shadow 200ms ease",
    transform:"transform 250ms cubic-bezier(0.25,0.46,0.45,0.94)",
    opacity:"opacity 200ms ease",
  },

  // ── Z-index scale ────────────────────────────────────────────────────────
  zIndex: {
    base:           0,
    raised:         1,
    dropdown:       10,
    sticky:         20,
    fixed:          30,
    overlay:        40,
    modal:          50,
    popover:        60,
    toast:          70,
    tooltip:        80,
    commandPalette: 90,
  },

  // ── Component defaults ───────────────────────────────────────────────────
  // Shared defaults that individual components can override.
  components: {
    button: {
      radius:      borderRadius.button,
      fontWeight:  fontWeight.medium,
      transition:  "all 150ms cubic-bezier(0.25,0.46,0.45,0.94)",
    },
    input: {
      radius:      borderRadius.input,
      border:      `1px solid ${colorTokens.border.DEFAULT}`,
      focusBorder: `1px solid ${colorTokens.border.focus}`,
      bg:          colorTokens.form.bg,
    },
    card: {
      radius:      borderRadius.card,
      shadow:      shadows.sm,
      border:      `1px solid ${colorTokens.border.DEFAULT}`,
      bg:          colorTokens.surface.card,
    },
    modal: {
      radius:      borderRadius.modal,
      shadow:      shadows["2xl"],
      backdrop:    colorTokens.surface.overlay,
    },
    badge: {
      radius:      borderRadius.badge,
      fontWeight:  fontWeight.medium,
    },
    avatar: {
      radius:      borderRadius.avatar,
    },
    tooltip: {
      radius:      borderRadius.md,
      bg:          ramps.gray[900],
      text:        ramps.white,
      shadow:      shadows.lg,
    },
  },
};

// ── CSS variable generator ───────────────────────────────────────────────────
/**
 * Generate a :root { } block of CSS custom properties from a theme object.
 * Inject into a <style> tag or your global CSS file.
 *
 * @param {object} theme - Any theme object (baseTheme, darkTheme, etc.)
 * @param {string} [selector=":root"] - CSS selector to scope the vars
 * @returns {string} CSS string
 */
export function generateCSSVars(theme, selector = ":root") {
  const lines = [];

  function flatten(obj, prefix = "--") {
    for (const [key, value] of Object.entries(obj)) {
      const cssKey = `${prefix}${key.replace(/([A-Z])/g, (m) => `-${m.toLowerCase()}`)}`;
      if (value && typeof value === "object" && !Array.isArray(value)) {
        flatten(value, `${cssKey}-`);
      } else if (typeof value === "string" || typeof value === "number") {
        lines.push(`  ${cssKey}: ${value};`);
      }
    }
  }

  // Only flatten colors and shadows into CSS vars (others used via JS tokens)
  flatten(theme.colors,  "--color-");
  flatten(theme.shadows, "--shadow-");

  return `${selector} {\n${lines.join("\n")}\n}`;
}

/**
 * Apply theme CSS variables to the document root.
 * Call this on app init and whenever the theme changes.
 *
 * @param {object} theme
 * @param {HTMLElement} [root=document.documentElement]
 */
export function applyTheme(theme, root = document?.documentElement) {
  if (!root) return;

  function applyFlat(obj, prefix = "--") {
    for (const [key, value] of Object.entries(obj)) {
      const cssKey = `${prefix}${key.replace(/([A-Z])/g, (m) => `-${m.toLowerCase()}`)}`;
      if (value && typeof value === "object" && !Array.isArray(value)) {
        applyFlat(value, `${cssKey}-`);
      } else if (typeof value === "string" || typeof value === "number") {
        root.style.setProperty(cssKey, String(value));
      }
    }
  }

  applyFlat(theme.colors,  "--color-");
  applyFlat(theme.shadows, "--shadow-");
}