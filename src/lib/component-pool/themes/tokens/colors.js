// ─────────────────────────────────────────────────────────────────────────────
// COLOR TOKENS
// Single source of truth for every color decision in the component pool.
// These map to CSS custom properties at runtime via themes/base.js.
//
// Naming convention:
//   colorTokens.{role}.{scale}
//   e.g. colorTokens.brand.primary  → main brand blue
//        colorTokens.surface.card   → card background
//        colorTokens.text.muted     → subdued text
// ─────────────────────────────────────────────────────────────────────────────

// ── Raw primitive ramps (shared across all themes) ───────────────────────────
export const ramps = {
  blue: {
    50:  "#eff6ff", 100: "#dbeafe", 200: "#bfdbfe", 300: "#93c5fd",
    400: "#60a5fa", 500: "#3b82f6", 600: "#2563eb", 700: "#1d4ed8",
    800: "#1e40af", 900: "#1e3a8a", 950: "#172554",
  },
  indigo: {
    50:  "#eef2ff", 100: "#e0e7ff", 200: "#c7d2fe", 300: "#a5b4fc",
    400: "#818cf8", 500: "#6366f1", 600: "#4f46e5", 700: "#4338ca",
    800: "#3730a3", 900: "#312e81", 950: "#1e1b4b",
  },
  violet: {
    50:  "#f5f3ff", 100: "#ede9fe", 200: "#ddd6fe", 300: "#c4b5fd",
    400: "#a78bfa", 500: "#8b5cf6", 600: "#7c3aed", 700: "#6d28d9",
    800: "#5b21b6", 900: "#4c1d95", 950: "#2e1065",
  },
  purple: {
    50:  "#faf5ff", 100: "#f3e8ff", 200: "#e9d5ff", 300: "#d8b4fe",
    400: "#c084fc", 500: "#a855f7", 600: "#9333ea", 700: "#7e22ce",
    800: "#6b21a8", 900: "#581c87", 950: "#3b0764",
  },
  pink: {
    50:  "#fdf2f8", 100: "#fce7f3", 200: "#fbcfe8", 300: "#f9a8d4",
    400: "#f472b6", 500: "#ec4899", 600: "#db2777", 700: "#be185d",
    800: "#9d174d", 900: "#831843", 950: "#500724",
  },
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
  orange: {
    50:  "#fff7ed", 100: "#ffedd5", 200: "#fed7aa", 300: "#fdba74",
    400: "#fb923c", 500: "#f97316", 600: "#ea580c", 700: "#c2410c",
    800: "#9a3412", 900: "#7c2d12", 950: "#431407",
  },
  amber: {
    50:  "#fffbeb", 100: "#fef3c7", 200: "#fde68a", 300: "#fcd34d",
    400: "#fbbf24", 500: "#f59e0b", 600: "#d97706", 700: "#b45309",
    800: "#92400e", 900: "#78350f", 950: "#451a03",
  },
  yellow: {
    50:  "#fefce8", 100: "#fef9c3", 200: "#fef08a", 300: "#fde047",
    400: "#facc15", 500: "#eab308", 600: "#ca8a04", 700: "#a16207",
    800: "#854d0e", 900: "#713f12", 950: "#422006",
  },
  lime: {
    50:  "#f7fee7", 100: "#ecfccb", 200: "#d9f99d", 300: "#bef264",
    400: "#a3e635", 500: "#84cc16", 600: "#65a30d", 700: "#4d7c0f",
    800: "#3f6212", 900: "#365314", 950: "#1a2e05",
  },
  green: {
    50:  "#f0fdf4", 100: "#dcfce7", 200: "#bbf7d0", 300: "#86efac",
    400: "#4ade80", 500: "#22c55e", 600: "#16a34a", 700: "#15803d",
    800: "#166534", 900: "#14532d", 950: "#052e16",
  },
  emerald: {
    50:  "#ecfdf5", 100: "#d1fae5", 200: "#a7f3d0", 300: "#6ee7b7",
    400: "#34d399", 500: "#10b981", 600: "#059669", 700: "#047857",
    800: "#065f46", 900: "#064e3b", 950: "#022c22",
  },
  teal: {
    50:  "#f0fdfa", 100: "#ccfbf1", 200: "#99f6e4", 300: "#5eead4",
    400: "#2dd4bf", 500: "#14b8a6", 600: "#0d9488", 700: "#0f766e",
    800: "#115e59", 900: "#134e4a", 950: "#042f2e",
  },
  cyan: {
    50:  "#ecfeff", 100: "#cffafe", 200: "#a5f3fc", 300: "#67e8f9",
    400: "#22d3ee", 500: "#06b6d4", 600: "#0891b2", 700: "#0e7490",
    800: "#155e75", 900: "#164e63", 950: "#083344",
  },
  sky: {
    50:  "#f0f9ff", 100: "#e0f2fe", 200: "#bae6fd", 300: "#7dd3fc",
    400: "#38bdf8", 500: "#0ea5e9", 600: "#0284c7", 700: "#0369a1",
    800: "#075985", 900: "#0c4a6e", 950: "#082f49",
  },
  slate: {
    50:  "#f8fafc", 100: "#f1f5f9", 200: "#e2e8f0", 300: "#cbd5e1",
    400: "#94a3b8", 500: "#64748b", 600: "#475569", 700: "#334155",
    800: "#1e293b", 900: "#0f172a", 950: "#020617",
  },
  gray: {
    50:  "#f9fafb", 100: "#f3f4f6", 200: "#e5e7eb", 300: "#d1d5db",
    400: "#9ca3af", 500: "#6b7280", 600: "#4b5563", 700: "#374151",
    800: "#1f2937", 900: "#111827", 950: "#030712",
  },
  zinc: {
    50:  "#fafafa", 100: "#f4f4f5", 200: "#e4e4e7", 300: "#d4d4d8",
    400: "#a1a1aa", 500: "#71717a", 600: "#52525b", 700: "#3f3f46",
    800: "#27272a", 900: "#18181b", 950: "#09090b",
  },
  neutral: {
    50:  "#fafafa", 100: "#f5f5f5", 200: "#e5e5e5", 300: "#d4d4d4",
    400: "#a3a3a3", 500: "#737373", 600: "#525252", 700: "#404040",
    800: "#262626", 900: "#171717", 950: "#0a0a0a",
  },
  stone: {
    50:  "#fafaf9", 100: "#f5f5f4", 200: "#e7e5e4", 300: "#d6d3d1",
    400: "#a8a29e", 500: "#78716c", 600: "#57534e", 700: "#44403c",
    800: "#292524", 900: "#1c1917", 950: "#0c0a09",
  },
  white: "#ffffff",
  black: "#000000",
  transparent: "transparent",
  current: "currentColor",
};

// ── Semantic light-mode color tokens ────────────────────────────────────────
export const colorTokens = {
  // Brand
  brand: {
    primary:        ramps.blue[600],
    primaryHover:   ramps.blue[700],
    primaryActive:  ramps.blue[800],
    primarySubtle:  ramps.blue[50],
    primaryMuted:   ramps.blue[100],
    secondary:      ramps.violet[600],
    secondaryHover: ramps.violet[700],
    accent:         ramps.emerald[500],
    accentHover:    ramps.emerald[600],
  },

  // Semantic status
  success: {
    DEFAULT:  ramps.emerald[600],
    hover:    ramps.emerald[700],
    subtle:   ramps.emerald[50],
    muted:    ramps.emerald[100],
    text:     ramps.emerald[800],
  },
  warning: {
    DEFAULT:  ramps.amber[500],
    hover:    ramps.amber[600],
    subtle:   ramps.amber[50],
    muted:    ramps.amber[100],
    text:     ramps.amber[800],
  },
  danger: {
    DEFAULT:  ramps.rose[600],
    hover:    ramps.rose[700],
    subtle:   ramps.rose[50],
    muted:    ramps.rose[100],
    text:     ramps.rose[800],
  },
  info: {
    DEFAULT:  ramps.sky[500],
    hover:    ramps.sky[600],
    subtle:   ramps.sky[50],
    muted:    ramps.sky[100],
    text:     ramps.sky[800],
  },

  // Surfaces (backgrounds)
  surface: {
    page:       ramps.white,
    subtle:     ramps.gray[50],
    muted:      ramps.gray[100],
    card:       ramps.white,
    cardHover:  ramps.gray[50],
    overlay:    "rgba(0, 0, 0, 0.5)",
    invert:     ramps.gray[900],
  },

  // Text
  text: {
    primary:    ramps.gray[900],
    secondary:  ramps.gray[600],
    muted:      ramps.gray[400],
    disabled:   ramps.gray[300],
    inverse:    ramps.white,
    link:       ramps.blue[600],
    linkHover:  ramps.blue[700],
    onBrand:    ramps.white,
  },

  // Borders
  border: {
    DEFAULT:  ramps.gray[200],
    subtle:   ramps.gray[100],
    strong:   ramps.gray[300],
    focus:    ramps.blue[500],
    error:    ramps.rose[400],
    invert:   ramps.gray[700],
  },

  // Form fields
  form: {
    bg:           ramps.white,
    bgDisabled:   ramps.gray[50],
    border:       ramps.gray[300],
    borderFocus:  ramps.blue[500],
    borderError:  ramps.rose[400],
    placeholder:  ramps.gray[400],
    label:        ramps.gray[700],
    hint:         ramps.gray[500],
    check:        ramps.blue[600],
  },

  // Interactive
  interactive: {
    hover:        "rgba(0, 0, 0, 0.04)",
    active:       "rgba(0, 0, 0, 0.08)",
    selected:     ramps.blue[50],
    selectedText: ramps.blue[700],
    disabled:     ramps.gray[100],
    disabledText: ramps.gray[400],
  },

  // Shadows (as rgba strings)
  shadow: {
    sm:   "rgba(0, 0, 0, 0.05)",
    md:   "rgba(0, 0, 0, 0.10)",
    lg:   "rgba(0, 0, 0, 0.15)",
    xl:   "rgba(0, 0, 0, 0.20)",
    brand:"rgba(37, 99, 235, 0.35)",
  },

  // Gradients (CSS strings)
  gradient: {
    brand:    "linear-gradient(135deg, #2563eb 0%, #7c3aed 100%)",
    hero:     "linear-gradient(135deg, #eff6ff 0%, #f5f3ff 50%, #ecfdf5 100%)",
    dark:     "linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%)",
    success:  "linear-gradient(135deg, #059669 0%, #10b981 100%)",
    warm:     "linear-gradient(135deg, #f97316 0%, #ec4899 100%)",
    cool:     "linear-gradient(135deg, #06b6d4 0%, #6366f1 100%)",
    sunset:   "linear-gradient(135deg, #f59e0b 0%, #ef4444 100%)",
    radialHero: "radial-gradient(ellipse at top, #dbeafe 0%, transparent 70%)",
  },
};

// ── Dark-mode overrides ──────────────────────────────────────────────────────
// Merged on top of colorTokens when dark mode is active.
export const darkColorTokens = {
  brand: {
    primary:        ramps.blue[500],
    primaryHover:   ramps.blue[400],
    primaryActive:  ramps.blue[300],
    primarySubtle:  "rgba(59,130,246,0.1)",
    primaryMuted:   "rgba(59,130,246,0.15)",
    secondary:      ramps.violet[400],
    secondaryHover: ramps.violet[300],
    accent:         ramps.emerald[400],
    accentHover:    ramps.emerald[300],
  },
  success: {
    DEFAULT:  ramps.emerald[400],
    hover:    ramps.emerald[300],
    subtle:   "rgba(52,211,153,0.1)",
    muted:    "rgba(52,211,153,0.15)",
    text:     ramps.emerald[300],
  },
  warning: {
    DEFAULT:  ramps.amber[400],
    hover:    ramps.amber[300],
    subtle:   "rgba(251,191,36,0.1)",
    muted:    "rgba(251,191,36,0.15)",
    text:     ramps.amber[300],
  },
  danger: {
    DEFAULT:  ramps.rose[400],
    hover:    ramps.rose[300],
    subtle:   "rgba(244,63,94,0.1)",
    muted:    "rgba(244,63,94,0.15)",
    text:     ramps.rose[300],
  },
  info: {
    DEFAULT:  ramps.sky[400],
    hover:    ramps.sky[300],
    subtle:   "rgba(56,189,248,0.1)",
    muted:    "rgba(56,189,248,0.15)",
    text:     ramps.sky[300],
  },
  surface: {
    page:       ramps.zinc[950],
    subtle:     ramps.zinc[900],
    muted:      ramps.zinc[800],
    card:       ramps.zinc[900],
    cardHover:  ramps.zinc[800],
    overlay:    "rgba(0, 0, 0, 0.7)",
    invert:     ramps.gray[50],
  },
  text: {
    primary:    ramps.zinc[50],
    secondary:  ramps.zinc[400],
    muted:      ramps.zinc[500],
    disabled:   ramps.zinc[600],
    inverse:    ramps.zinc[900],
    link:       ramps.blue[400],
    linkHover:  ramps.blue[300],
    onBrand:    ramps.white,
  },
  border: {
    DEFAULT:  ramps.zinc[700],
    subtle:   ramps.zinc[800],
    strong:   ramps.zinc[600],
    focus:    ramps.blue[400],
    error:    ramps.rose[500],
    invert:   ramps.zinc[300],
  },
  form: {
    bg:           ramps.zinc[900],
    bgDisabled:   ramps.zinc[800],
    border:       ramps.zinc[700],
    borderFocus:  ramps.blue[400],
    borderError:  ramps.rose[500],
    placeholder:  ramps.zinc[500],
    label:        ramps.zinc[300],
    hint:         ramps.zinc[400],
    check:        ramps.blue[400],
  },
  interactive: {
    hover:        "rgba(255,255,255,0.06)",
    active:       "rgba(255,255,255,0.10)",
    selected:     "rgba(59,130,246,0.15)",
    selectedText: ramps.blue[300],
    disabled:     ramps.zinc[800],
    disabledText: ramps.zinc[600],
  },
  shadow: {
    sm:   "rgba(0,0,0,0.25)",
    md:   "rgba(0,0,0,0.35)",
    lg:   "rgba(0,0,0,0.50)",
    xl:   "rgba(0,0,0,0.60)",
    brand:"rgba(59,130,246,0.40)",
  },
  gradient: {
    brand:    "linear-gradient(135deg, #1d4ed8 0%, #6d28d9 100%)",
    hero:     "linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #022c22 100%)",
    dark:     "linear-gradient(135deg, #09090b 0%, #1e1b4b 100%)",
    success:  "linear-gradient(135deg, #047857 0%, #059669 100%)",
    warm:     "linear-gradient(135deg, #c2410c 0%, #be185d 100%)",
    cool:     "linear-gradient(135deg, #0e7490 0%, #4338ca 100%)",
    sunset:   "linear-gradient(135deg, #b45309 0%, #b91c1c 100%)",
    radialHero: "radial-gradient(ellipse at top, rgba(30,58,138,0.4) 0%, transparent 70%)",
  },
};