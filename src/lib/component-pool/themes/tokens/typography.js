// ─────────────────────────────────────────────────────────────────────────────
// TYPOGRAPHY TOKENS
// All type decisions in one place.
// Components reference these via CSS custom properties or direct token import.
// ─────────────────────────────────────────────────────────────────────────────

// ── Font stacks ──────────────────────────────────────────────────────────────
export const fontFamily = {
  /**
   * Primary sans-serif — Inter is the default.
   * The CSS var allows Next.js / Nuxt font providers to override at runtime.
   */
  sans:  "var(--font-sans, 'Inter', 'Helvetica Neue', Arial, system-ui, sans-serif)",
  /** Monospace — code blocks, OTP inputs, data displays */
  mono:  "var(--font-mono, 'JetBrains Mono', 'Fira Code', 'Cascadia Code', 'Courier New', monospace)",
  /** Serif — blog posts, editorial layouts, pull quotes */
  serif: "var(--font-serif, 'Lora', 'Merriweather', Georgia, 'Times New Roman', serif)",
  /** Display / hero headlines — large, expressive weight */
  display:"var(--font-display, 'Cal Sans', 'Sora', 'Inter', system-ui, sans-serif)",
};

// ── Font size scale (rem, base = 16px) ──────────────────────────────────────
export const fontSize = {
  "2xs":  "0.625rem",   //  10px
  xs:     "0.75rem",    //  12px
  sm:     "0.875rem",   //  14px
  base:   "1rem",       //  16px
  lg:     "1.125rem",   //  18px
  xl:     "1.25rem",    //  20px
  "2xl":  "1.5rem",     //  24px
  "3xl":  "1.875rem",   //  30px
  "4xl":  "2.25rem",    //  36px
  "5xl":  "3rem",       //  48px
  "6xl":  "3.75rem",    //  60px
  "7xl":  "4.5rem",     //  72px
  "8xl":  "6rem",       //  96px
  "9xl":  "8rem",       // 128px
};

// ── Fluid / clamp sizes for hero headings ───────────────────────────────────
// These scale smoothly between min and max viewport widths.
export const fluidFontSize = {
  heroXl:   "clamp(2.5rem, 5vw + 1rem, 5rem)",      // 40px → 80px
  heroLg:   "clamp(2rem, 4vw + 0.75rem, 4rem)",     // 32px → 64px
  heroMd:   "clamp(1.75rem, 3vw + 0.5rem, 3rem)",   // 28px → 48px
  sectionLg:"clamp(1.5rem, 2.5vw + 0.5rem, 2.5rem)",// 24px → 40px
  sectionMd:"clamp(1.25rem, 2vw + 0.25rem, 2rem)",  // 20px → 32px
};

// ── Font weights ─────────────────────────────────────────────────────────────
export const fontWeight = {
  thin:       100,
  extralight: 200,
  light:      300,
  normal:     400,
  medium:     500,
  semibold:   600,
  bold:       700,
  extrabold:  800,
  black:      900,
};

// ── Line heights ─────────────────────────────────────────────────────────────
export const lineHeight = {
  none:     1,
  tight:    1.2,
  snug:     1.375,
  normal:   1.5,
  relaxed:  1.625,
  loose:    2,
  // Named for use cases
  heading:  1.2,
  subheading: 1.375,
  body:     1.6,
  code:     1.7,
};

// ── Letter spacing ───────────────────────────────────────────────────────────
export const letterSpacing = {
  tighter: "-0.05em",
  tight:   "-0.025em",
  normal:   "0em",
  wide:     "0.025em",
  wider:    "0.05em",
  widest:   "0.1em",
  // Named
  display:  "-0.03em",   // large headings look better tighter
  mono:     "0em",
  caps:     "0.08em",    // all-caps labels
};

// ── Prose (long-form content) ─────────────────────────────────────────────────
export const prose = {
  // Max-widths for readable line length (45–75 chars)
  width: {
    narrow: "45ch",
    DEFAULT:"65ch",
    wide:   "75ch",
  },
  // Paragraph spacing (margin-bottom between <p> tags)
  paragraphSpacing: "1.25em",
  // Lead paragraph (first p in an article)
  lead: {
    fontSize:   "1.25rem",
    lineHeight: 1.6,
    color:      "var(--color-text-secondary)",
  },
};

// ── Text style presets ───────────────────────────────────────────────────────
// Use these as a reference when writing Tailwind class strings.
export const textStyles = {
  // Display
  displayXl:  { fontSize: fluidFontSize.heroXl,   fontWeight: fontWeight.extrabold, lineHeight: lineHeight.tight,   letterSpacing: letterSpacing.display },
  displayLg:  { fontSize: fluidFontSize.heroLg,   fontWeight: fontWeight.extrabold, lineHeight: lineHeight.tight,   letterSpacing: letterSpacing.display },
  displayMd:  { fontSize: fluidFontSize.heroMd,   fontWeight: fontWeight.bold,      lineHeight: lineHeight.tight,   letterSpacing: letterSpacing.display },
  // Headings
  h1:         { fontSize: fontSize["5xl"],  fontWeight: fontWeight.bold,     lineHeight: lineHeight.heading },
  h2:         { fontSize: fontSize["4xl"],  fontWeight: fontWeight.bold,     lineHeight: lineHeight.heading },
  h3:         { fontSize: fontSize["3xl"],  fontWeight: fontWeight.semibold, lineHeight: lineHeight.snug   },
  h4:         { fontSize: fontSize["2xl"],  fontWeight: fontWeight.semibold, lineHeight: lineHeight.snug   },
  h5:         { fontSize: fontSize.xl,      fontWeight: fontWeight.semibold, lineHeight: lineHeight.normal },
  h6:         { fontSize: fontSize.lg,      fontWeight: fontWeight.semibold, lineHeight: lineHeight.normal },
  // Body
  bodyLg:     { fontSize: fontSize.lg,      fontWeight: fontWeight.normal,   lineHeight: lineHeight.relaxed },
  body:       { fontSize: fontSize.base,    fontWeight: fontWeight.normal,   lineHeight: lineHeight.relaxed },
  bodySm:     { fontSize: fontSize.sm,      fontWeight: fontWeight.normal,   lineHeight: lineHeight.normal  },
  // UI chrome
  label:      { fontSize: fontSize.sm,      fontWeight: fontWeight.medium,   lineHeight: lineHeight.normal  },
  labelSm:    { fontSize: fontSize.xs,      fontWeight: fontWeight.medium,   lineHeight: lineHeight.normal  },
  caption:    { fontSize: fontSize.xs,      fontWeight: fontWeight.normal,   lineHeight: lineHeight.normal  },
  overline:   { fontSize: fontSize.xs,      fontWeight: fontWeight.semibold, lineHeight: lineHeight.normal, letterSpacing: letterSpacing.caps },
  // Code
  code:       { fontFamily: fontFamily.mono, fontSize: fontSize.sm, lineHeight: lineHeight.code },
  codeBlock:  { fontFamily: fontFamily.mono, fontSize: fontSize.sm, lineHeight: lineHeight.code },
};

// ── Tailwind class mappings (convenience strings) ────────────────────────────
export const twText = {
  displayXl:   "text-5xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight leading-tight",
  displayLg:   "text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight leading-tight",
  displayMd:   "text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight leading-tight",
  sectionTitle:"text-3xl sm:text-4xl font-bold tracking-tight",
  sectionSub:  "text-lg sm:text-xl text-gray-600 dark:text-gray-400 leading-relaxed",
  cardTitle:   "text-xl font-semibold",
  cardBody:    "text-sm text-gray-600 dark:text-gray-400 leading-relaxed",
  label:       "text-sm font-medium text-gray-700 dark:text-gray-300",
  caption:     "text-xs text-gray-500 dark:text-gray-400",
  code:        "font-mono text-sm",
  eyebrow:     "text-sm font-semibold tracking-widest uppercase text-blue-600 dark:text-blue-400",
};