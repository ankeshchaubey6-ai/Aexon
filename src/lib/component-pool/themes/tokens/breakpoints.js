// ─────────────────────────────────────────────────────────────────────────────
// BREAKPOINT TOKENS
// Single source of truth for responsive design.
// These values MUST match tailwind.config.js → theme.screens.
// ─────────────────────────────────────────────────────────────────────────────

// ── Raw pixel values ──────────────────────────────────────────────────────────
export const breakpointValues = {
  xs:    480,   // Extra small — large phones (not in Tailwind by default)
  sm:    640,   // Small — landscape phones
  md:    768,   // Medium — tablets
  lg:    1024,  // Large — small laptops
  xl:    1280,  // Extra large — desktops
  "2xl": 1536,  // 2x Extra large — wide screens
  "3xl": 1920,  // 3x Extra large — ultra-wide (custom)
};

// ── Min-width media query strings ─────────────────────────────────────────────
// Used with window.matchMedia() or CSS media queries.
export const breakpoints = Object.fromEntries(
  Object.entries(breakpointValues).map(([k, v]) => [k, `${v}px`])
);

// ── CSS @media min-width strings ──────────────────────────────────────────────
export const mediaMin = Object.fromEntries(
  Object.entries(breakpointValues).map(([k, v]) => [k, `@media (min-width: ${v}px)`])
);

// ── CSS @media max-width strings (max = breakpoint - 1px) ────────────────────
export const mediaMax = Object.fromEntries(
  Object.entries(breakpointValues).map(([k, v]) => [k, `@media (max-width: ${v - 1}px)`])
);

// ── window.matchMedia strings (no @media wrapper) ────────────────────────────
export const mq = Object.fromEntries(
  Object.entries(breakpointValues).map(([k, v]) => [k, `(min-width: ${v}px)`])
);

// ── Semantic viewport labels ──────────────────────────────────────────────────
export const viewportLabel = {
  mobile:  { min: 0,    max: breakpointValues.sm - 1 },
  tablet:  { min: breakpointValues.sm, max: breakpointValues.lg - 1 },
  desktop: { min: breakpointValues.lg, max: Infinity },
};

/**
 * Get the current viewport size label.
 * Safe to call only in browser context.
 * @returns {"mobile"|"tablet"|"desktop"}
 */
export function getViewportLabel() {
  if (typeof window === "undefined") return "desktop";
  const w = window.innerWidth;
  if (w < breakpointValues.sm)  return "mobile";
  if (w < breakpointValues.lg)  return "tablet";
  return "desktop";
}

/**
 * Check if the current viewport matches a breakpoint.
 * @param {"xs"|"sm"|"md"|"lg"|"xl"|"2xl"|"3xl"} bp
 * @returns {boolean}
 */
export function isBreakpoint(bp) {
  if (typeof window === "undefined") return false;
  return window.matchMedia(mq[bp]).matches;
}

// ── Container max-widths (aligned with Tailwind container) ───────────────────
export const containerMaxWidth = {
  sm:    "640px",
  md:    "768px",
  lg:    "1024px",
  xl:    "1280px",
  "2xl": "1400px",   // slightly narrower than 2xl for better readability
};

// ── Grid column counts at each breakpoint ─────────────────────────────────────
export const gridCols = {
  features: { base: 1, sm: 2, lg: 3 },
  cards:    { base: 1, sm: 2, xl: 4 },
  pricing:  { base: 1, lg: 3 },
  team:     { base: 1, sm: 2, lg: 4 },
  blog:     { base: 1, md: 2, xl: 3 },
  gallery:  { base: 2, sm: 3, lg: 4 },
  stats:    { base: 2, lg: 4 },
  logos:    { base: 2, sm: 3, md: 4, lg: 6 },
};

// ── Tailwind responsive class helpers ─────────────────────────────────────────
/**
 * Build a responsive Tailwind class string.
 * @param {string} property - Tailwind utility without breakpoint prefix
 * @param {object} values   - { base: "1", sm: "2", lg: "3" }
 * @returns {string}
 * @example
 * responsiveCols("grid-cols", { base: "1", sm: "2", lg: "3" })
 * → "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
 */
export function responsiveCols(property, values) {
  return Object.entries(values)
    .map(([bp, val]) => bp === "base" ? `${property}-${val}` : `${bp}:${property}-${val}`)
    .join(" ");
}

// ── Section padding helpers ───────────────────────────────────────────────────
// Standard vertical padding for page sections at each breakpoint.
export const sectionPy = {
  sm:  "py-12",
  md:  "py-16 sm:py-20",
  lg:  "py-20 sm:py-28",
  xl:  "py-24 sm:py-32 lg:py-36",
};

// Standard horizontal padding for containers.
export const containerPx = "px-4 sm:px-6 lg:px-8";