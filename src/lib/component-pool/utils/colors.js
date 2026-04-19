// ─────────────────────────────────────────────
// Full design-system color palette
// Each ramp: 50 (lightest) → 950 (darkest)
// ─────────────────────────────────────────────

export const palette = {
  // ── Blues ──────────────────────────────────
  blue: {
    50:  "#eff6ff", 100: "#dbeafe", 200: "#bfdbfe", 300: "#93c5fd",
    400: "#60a5fa", 500: "#3b82f6", 600: "#2563eb", 700: "#1d4ed8",
    800: "#1e40af", 900: "#1e3a8a", 950: "#172554",
  },
  // ── Indigo ─────────────────────────────────
  indigo: {
    50:  "#eef2ff", 100: "#e0e7ff", 200: "#c7d2fe", 300: "#a5b4fc",
    400: "#818cf8", 500: "#6366f1", 600: "#4f46e5", 700: "#4338ca",
    800: "#3730a3", 900: "#312e81", 950: "#1e1b4b",
  },
  // ── Violet ─────────────────────────────────
  violet: {
    50:  "#f5f3ff", 100: "#ede9fe", 200: "#ddd6fe", 300: "#c4b5fd",
    400: "#a78bfa", 500: "#8b5cf6", 600: "#7c3aed", 700: "#6d28d9",
    800: "#5b21b6", 900: "#4c1d95", 950: "#2e1065",
  },
  // ── Emerald ────────────────────────────────
  emerald: {
    50:  "#ecfdf5", 100: "#d1fae5", 200: "#a7f3d0", 300: "#6ee7b7",
    400: "#34d399", 500: "#10b981", 600: "#059669", 700: "#047857",
    800: "#065f46", 900: "#064e3b", 950: "#022c22",
  },
  // ── Green ──────────────────────────────────
  green: {
    50:  "#f0fdf4", 100: "#dcfce7", 200: "#bbf7d0", 300: "#86efac",
    400: "#4ade80", 500: "#22c55e", 600: "#16a34a", 700: "#15803d",
    800: "#166534", 900: "#14532d", 950: "#052e16",
  },
  // ── Amber ──────────────────────────────────
  amber: {
    50:  "#fffbeb", 100: "#fef3c7", 200: "#fde68a", 300: "#fcd34d",
    400: "#fbbf24", 500: "#f59e0b", 600: "#d97706", 700: "#b45309",
    800: "#92400e", 900: "#78350f", 950: "#451a03",
  },
  // ── Orange ─────────────────────────────────
  orange: {
    50:  "#fff7ed", 100: "#ffedd5", 200: "#fed7aa", 300: "#fdba74",
    400: "#fb923c", 500: "#f97316", 600: "#ea580c", 700: "#c2410c",
    800: "#9a3412", 900: "#7c2d12", 950: "#431407",
  },
  // ── Rose / Red ─────────────────────────────
  rose: {
    50:  "#fff1f2", 100: "#ffe4e6", 200: "#fecdd3", 300: "#fda4af",
    400: "#fb7185", 500: "#f43f5e", 600: "#e11d48", 700: "#be123c",
    800: "#9f1239", 900: "#881337", 950: "#4c0519",
  },
  red: {
    50:  "#fef2f2", 100: "#fee2e2", 200: "#fecaca", 300: "#fca5a5",
    400: "#f87171", 500: "#ef4444", 600: "#dc2626", 700: "#b91c1c",
    800: "#991b1b", 900: "#7f1d1d", 950: "#450a0a",
  },
  // ── Sky ────────────────────────────────────
  sky: {
    50:  "#f0f9ff", 100: "#e0f2fe", 200: "#bae6fd", 300: "#7dd3fc",
    400: "#38bdf8", 500: "#0ea5e9", 600: "#0284c7", 700: "#0369a1",
    800: "#075985", 900: "#0c4a6e", 950: "#082f49",
  },
  // ── Neutral / Gray ─────────────────────────
  gray: {
    50:  "#f9fafb", 100: "#f3f4f6", 200: "#e5e7eb", 300: "#d1d5db",
    400: "#9ca3af", 500: "#6b7280", 600: "#4b5563", 700: "#374151",
    800: "#1f2937", 900: "#111827", 950: "#030712",
  },
  slate: {
    50:  "#f8fafc", 100: "#f1f5f9", 200: "#e2e8f0", 300: "#cbd5e1",
    400: "#94a3b8", 500: "#64748b", 600: "#475569", 700: "#334155",
    800: "#1e293b", 900: "#0f172a", 950: "#020617",
  },
  zinc: {
    50:  "#fafafa", 100: "#f4f4f5", 200: "#e4e4e7", 300: "#d4d4d8",
    400: "#a1a1aa", 500: "#71717a", 600: "#52525b", 700: "#3f3f46",
    800: "#27272a", 900: "#18181b", 950: "#09090b",
  },
};

// Semantic aliases used throughout the system
export const semantic = {
  primary:   palette.blue,
  secondary: palette.violet,
  accent:    palette.emerald,
  success:   palette.emerald,
  warning:   palette.amber,
  danger:    palette.rose,
  info:      palette.sky,
  neutral:   palette.zinc,
};

// ─────────────────────────────────────────────
// Hex / RGB conversion helpers
// ─────────────────────────────────────────────

/**
 * Parse a hex color string to { r, g, b }.
 * Supports #rgb and #rrggbb formats.
 * @returns {{ r: number, g: number, b: number } | null}
 */
export function hexToRgb(hex) {
  const clean = hex.replace(/^#/, "");
  if (clean.length === 3) {
    const [r, g, b] = clean.split("").map((c) => parseInt(c + c, 16));
    return { r, g, b };
  }
  if (clean.length === 6) {
    return {
      r: parseInt(clean.slice(0, 2), 16),
      g: parseInt(clean.slice(2, 4), 16),
      b: parseInt(clean.slice(4, 6), 16),
    };
  }
  return null;
}

/**
 * Convert { r, g, b } to a hex color string.
 */
export function rgbToHex({ r, g, b }) {
  return (
    "#" + [r, g, b].map((c) => Math.round(c).toString(16).padStart(2, "0")).join("")
  );
}

/**
 * Convert a hex color to rgba() CSS string.
 * @example hexToRgba("#3b82f6", 0.5) → "rgba(59, 130, 246, 0.5)"
 */
export function hexToRgba(hex, alpha = 1) {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
}

/**
 * Lighten a hex color by mixing it with white.
 * @param {string} hex
 * @param {number} amount - 0 (no change) → 1 (fully white)
 */
export function lighten(hex, amount) {
  const { r, g, b } = hexToRgb(hex) ?? { r: 0, g: 0, b: 0 };
  return rgbToHex({
    r: Math.round(r + (255 - r) * amount),
    g: Math.round(g + (255 - g) * amount),
    b: Math.round(b + (255 - b) * amount),
  });
}

/**
 * Darken a hex color by mixing it with black.
 * @param {string} hex
 * @param {number} amount - 0 (no change) → 1 (fully black)
 */
export function darken(hex, amount) {
  const { r, g, b } = hexToRgb(hex) ?? { r: 0, g: 0, b: 0 };
  return rgbToHex({
    r: Math.round(r * (1 - amount)),
    g: Math.round(g * (1 - amount)),
    b: Math.round(b * (1 - amount)),
  });
}

/**
 * Mix two hex colors together.
 * @param {number} weight - 0 → fully colorA, 1 → fully colorB
 */
export function mixColors(hexA, hexB, weight = 0.5) {
  const a = hexToRgb(hexA) ?? { r: 0, g: 0, b: 0 };
  const b = hexToRgb(hexB) ?? { r: 0, g: 0, b: 0 };
  return rgbToHex({
    r: Math.round(a.r + (b.r - a.r) * weight),
    g: Math.round(a.g + (b.g - a.g) * weight),
    b: Math.round(a.b + (b.b - a.b) * weight),
  });
}

// ─────────────────────────────────────────────
// Contrast & accessibility
// ─────────────────────────────────────────────

/**
 * Calculate relative luminance of a hex color (WCAG formula).
 */
export function luminance(hex) {
  const { r, g, b } = hexToRgb(hex) ?? { r: 0, g: 0, b: 0 };
  const toLinear = (c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

/**
 * Calculate WCAG contrast ratio between two hex colors.
 * WCAG AA requires ≥ 4.5:1 for normal text, ≥ 3:1 for large text.
 */
export function contrastRatio(hexA, hexB) {
  const la = luminance(hexA);
  const lb = luminance(hexB);
  const [light, dark] = la > lb ? [la, lb] : [lb, la];
  return parseFloat(((light + 0.05) / (dark + 0.05)).toFixed(2));
}

/**
 * Return "#000000" or "#ffffff" — whichever has better contrast against the given bg color.
 * Use this to automatically pick readable text color for any background.
 * @example getContrastColor("#3b82f6") → "#ffffff"
 */
export function getContrastColor(hex) {
  const l = luminance(hex);
  return l > 0.179 ? "#000000" : "#ffffff";
}

/**
 * Check if a hex color meets WCAG AA contrast against a background.
 * @param {string} foreground
 * @param {string} background
 * @param {"normal"|"large"} level - "normal" text (4.5:1) or "large" text (3:1)
 */
export function meetsWCAGAA(foreground, background, level = "normal") {
  const ratio = contrastRatio(foreground, background);
  return level === "large" ? ratio >= 3 : ratio >= 4.5;
}

// ─────────────────────────────────────────────
// Brand color generator (deterministic from string)
// ─────────────────────────────────────────────

const BRAND_COLORS = [
  { bg: palette.blue[100],   text: palette.blue[800]   },
  { bg: palette.violet[100], text: palette.violet[800] },
  { bg: palette.emerald[100],text: palette.emerald[800]},
  { bg: palette.amber[100],  text: palette.amber[800]  },
  { bg: palette.rose[100],   text: palette.rose[800]   },
  { bg: palette.sky[100],    text: palette.sky[800]    },
  { bg: palette.orange[100], text: palette.orange[800] },
  { bg: palette.indigo[100], text: palette.indigo[800] },
];

/**
 * Get a deterministic background + text color pair from a string
 * (e.g. user name, category label). Safe, accessible, never random.
 *
 * @param {string} str
 * @returns {{ bg: string, text: string }}
 */
export function getColorFromString(str = "") {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return BRAND_COLORS[Math.abs(hash) % BRAND_COLORS.length];
}

/**
 * Generate an inline style object for an avatar / badge from a name.
 * @example getAvatarStyle("John Doe") → { backgroundColor: "#dbeafe", color: "#1e40af" }
 */
export function getAvatarStyle(name = "") {
  const { bg, text } = getColorFromString(name);
  return { backgroundColor: bg, color: text };
}