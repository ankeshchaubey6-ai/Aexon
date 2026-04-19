// ─────────────────────────────────────────────────────────────────────────────
// DARK THEME
// Override layer applied on top of baseTheme when dark mode is active.
// Only the values that change in dark mode are listed here.
// Merge with: const theme = deepMerge(baseTheme, darkTheme)
// ─────────────────────────────────────────────────────────────────────────────

import { darkColorTokens, ramps }   from "./tokens/colors.js";
import { darkShadows, glowShadows } from "./tokens/shadows.js";

export const darkTheme = {
  name: "dark",
  mode: "dark",

  // ── Colors ──────────────────────────────────────────────────────────────
  colors: darkColorTokens,

  // ── Shadows ─────────────────────────────────────────────────────────────
  // Dark surfaces need stronger shadows for visual separation.
  shadows: darkShadows,
  glowShadows,   // Brand glows remain the same — they look good on dark bg

  // ── Component overrides ──────────────────────────────────────────────────
  components: {
    input: {
      bg:          ramps.zinc[900],
      border:      `1px solid ${ramps.zinc[700]}`,
      focusBorder: `1px solid ${ramps.blue[400]}`,
    },
    card: {
      bg:     ramps.zinc[900],
      border: `1px solid ${ramps.zinc[800]}`,
      shadow: darkShadows.sm,
    },
    modal: {
      bg:       ramps.zinc[900],
      shadow:   darkShadows["2xl"],
      backdrop: "rgba(0,0,0,0.7)",
    },
    tooltip: {
      bg:   ramps.zinc[800],
      text: ramps.zinc[100],
    },
  },
};

// ── Deep merge utility ───────────────────────────────────────────────────────
/**
 * Deep-merge two theme objects. Arrays are replaced (not concatenated).
 * @param {object} base    - baseTheme
 * @param {object} overrides - darkTheme (or any other override)
 * @returns {object} merged theme
 */
export function deepMerge(base, overrides) {
  const result = { ...base };
  for (const [key, value] of Object.entries(overrides)) {
    if (
      value &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      base[key] &&
      typeof base[key] === "object"
    ) {
      result[key] = deepMerge(base[key], value);
    } else {
      result[key] = value;
    }
  }
  return result;
}

/**
 * Get the complete dark theme by merging base + dark overrides.
 * @param {object} base - Pass baseTheme here
 * @returns {object} full dark theme
 */
export function getDarkTheme(base) {
  return deepMerge(base, darkTheme);
}