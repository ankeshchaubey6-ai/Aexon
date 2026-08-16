// ─────────────────────────────────────────────────────────────────────────────
// SHADOW TOKENS
// Layered box-shadow definitions for every elevation level + brand glows.
// Use the `shadows` object in Tailwind config to extend boxShadow.
// ─────────────────────────────────────────────────────────────────────────────

// ── Core elevation shadows (light mode) ──────────────────────────────────────
export const shadows = {
  none:    "none",

  // Hairline — very subtle separation
  xs:      "0 1px 2px 0 rgba(0,0,0,0.05)",

  // Small — cards at rest, inputs
  sm:      "0 1px 3px 0 rgba(0,0,0,0.10), 0 1px 2px -1px rgba(0,0,0,0.10)",

  // Default — floating cards, dropdowns
  DEFAULT: "0 4px 6px -1px rgba(0,0,0,0.10), 0 2px 4px -2px rgba(0,0,0,0.10)",

  // Medium — popovers, hover cards
  md:      "0 4px 6px -1px rgba(0,0,0,0.10), 0 2px 4px -2px rgba(0,0,0,0.10)",

  // Large — modals, dialogs
  lg:      "0 10px 15px -3px rgba(0,0,0,0.10), 0 4px 6px -4px rgba(0,0,0,0.10)",

  // Extra large — feature cards, pricing panels
  xl:      "0 20px 25px -5px rgba(0,0,0,0.10), 0 8px 10px -6px rgba(0,0,0,0.10)",

  // 2xl — hero images, prominent modals
  "2xl":   "0 25px 50px -12px rgba(0,0,0,0.25)",

  // Inset — pressed states, sunken inputs
  inner:   "inset 0 2px 4px 0 rgba(0,0,0,0.05)",
  innerMd: "inset 0 4px 8px 0 rgba(0,0,0,0.08)",
};

// ── Dark mode shadows ─────────────────────────────────────────────────────────
// Darker and more pronounced because dark surfaces need stronger separation.
export const darkShadows = {
  none:    "none",
  xs:      "0 1px 2px 0 rgba(0,0,0,0.30)",
  sm:      "0 1px 3px 0 rgba(0,0,0,0.40), 0 1px 2px -1px rgba(0,0,0,0.30)",
  DEFAULT: "0 4px 6px -1px rgba(0,0,0,0.40), 0 2px 4px -2px rgba(0,0,0,0.30)",
  md:      "0 4px 6px -1px rgba(0,0,0,0.40), 0 2px 4px -2px rgba(0,0,0,0.30)",
  lg:      "0 10px 15px -3px rgba(0,0,0,0.50), 0 4px 6px -4px rgba(0,0,0,0.40)",
  xl:      "0 20px 25px -5px rgba(0,0,0,0.55), 0 8px 10px -6px rgba(0,0,0,0.45)",
  "2xl":   "0 25px 50px -12px rgba(0,0,0,0.70)",
  inner:   "inset 0 2px 4px 0 rgba(0,0,0,0.40)",
  innerMd: "inset 0 4px 8px 0 rgba(0,0,0,0.50)",
};

// ── Brand / colored glow shadows ──────────────────────────────────────────────
// Used on CTAs, featured pricing tiers, highlight buttons.
export const glowShadows = {
  // Primary brand glows
  blue:     "0 0 0 1px rgba(59,130,246,0.15), 0 8px 32px -4px rgba(59,130,246,0.35)",
  blueSm:   "0 0 0 1px rgba(59,130,246,0.10), 0 4px 16px -2px rgba(59,130,246,0.25)",
  violet:   "0 0 0 1px rgba(139,92,246,0.15), 0 8px 32px -4px rgba(139,92,246,0.35)",
  violetSm: "0 0 0 1px rgba(139,92,246,0.10), 0 4px 16px -2px rgba(139,92,246,0.25)",
  indigo:   "0 0 0 1px rgba(99,102,241,0.15), 0 8px 32px -4px rgba(99,102,241,0.35)",

  // Status glows
  emerald:  "0 0 0 1px rgba(16,185,129,0.15), 0 8px 32px -4px rgba(16,185,129,0.35)",
  rose:     "0 0 0 1px rgba(244,63,94,0.15),  0 8px 32px -4px rgba(244,63,94,0.35)",
  amber:    "0 0 0 1px rgba(245,158,11,0.15), 0 8px 32px -4px rgba(245,158,11,0.35)",

  // White glow (for dark backgrounds)
  white:    "0 0 0 1px rgba(255,255,255,0.10), 0 8px 32px -4px rgba(255,255,255,0.15)",
};

// ── Focus ring shadows ────────────────────────────────────────────────────────
// Used for accessibility — keyboard focus visible states.
export const focusRing = {
  DEFAULT: "0 0 0 3px rgba(59,130,246,0.45)",
  sm:      "0 0 0 2px rgba(59,130,246,0.45)",
  offset:  "0 0 0 2px #fff, 0 0 0 4px rgba(59,130,246,0.60)",
  offsetDark: "0 0 0 2px #18181b, 0 0 0 4px rgba(59,130,246,0.60)",

  // Status focus rings
  error:   "0 0 0 3px rgba(244,63,94,0.40)",
  success: "0 0 0 3px rgba(16,185,129,0.40)",
  warning: "0 0 0 3px rgba(245,158,11,0.40)",
};

// ── Layered shadow builder ────────────────────────────────────────────────────
/**
 * Compose multiple shadow layers into a single box-shadow string.
 * @param {...string} layers
 * @returns {string}
 * @example
 * composeShadow(shadows.md, glowShadows.blue)
 * → "0 4px 6px... , 0 0 0 1px rgba(59,130,246,0.15)..."
 */
export function composeShadow(...layers) {
  return layers.filter(Boolean).join(", ");
}

// ── Drop shadow filter values ─────────────────────────────────────────────────
// For SVGs and images — CSS filter: drop-shadow(...)
export const dropShadow = {
  sm:   "drop-shadow(0 1px 1px rgba(0,0,0,0.08))",
  md:   "drop-shadow(0 4px 3px rgba(0,0,0,0.07)) drop-shadow(0 2px 2px rgba(0,0,0,0.06))",
  lg:   "drop-shadow(0 10px 8px rgba(0,0,0,0.04)) drop-shadow(0 4px 3px rgba(0,0,0,0.10))",
  xl:   "drop-shadow(0 20px 13px rgba(0,0,0,0.03)) drop-shadow(0 8px 5px rgba(0,0,0,0.08))",
  "2xl":"drop-shadow(0 25px 25px rgba(0,0,0,0.15))",
  none: "drop-shadow(0 0 #0000)",
};

// ── Text shadow ───────────────────────────────────────────────────────────────
export const textShadow = {
  none:   "none",
  sm:     "0 1px 2px rgba(0,0,0,0.20)",
  DEFAULT:"0 2px 4px rgba(0,0,0,0.25)",
  lg:     "0 4px 8px rgba(0,0,0,0.30)",
  glow:   "0 0 20px rgba(255,255,255,0.50)",
};