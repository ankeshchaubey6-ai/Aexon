// ─────────────────────────────────────────────────────────────────────────────
// SPACING TOKENS
// Base-4 scale (1 unit = 4px = 0.25rem).
// Matches Tailwind's default spacing scale exactly.
// ─────────────────────────────────────────────────────────────────────────────

// ── Core spacing scale ───────────────────────────────────────────────────────
export const spacing = {
  0:     "0px",
  px:    "1px",
  0.5:   "0.125rem",  //  2px
  1:     "0.25rem",   //  4px
  1.5:   "0.375rem",  //  6px
  2:     "0.5rem",    //  8px
  2.5:   "0.625rem",  // 10px
  3:     "0.75rem",   // 12px
  3.5:   "0.875rem",  // 14px
  4:     "1rem",      // 16px
  5:     "1.25rem",   // 20px
  6:     "1.5rem",    // 24px
  7:     "1.75rem",   // 28px
  8:     "2rem",      // 32px
  9:     "2.25rem",   // 36px
  10:    "2.5rem",    // 40px
  11:    "2.75rem",   // 44px
  12:    "3rem",      // 48px
  14:    "3.5rem",    // 56px
  16:    "4rem",      // 64px
  20:    "5rem",      // 80px
  24:    "6rem",      // 96px
  28:    "7rem",      // 112px
  32:    "8rem",      // 128px
  36:    "9rem",      // 144px
  40:    "10rem",     // 160px
  44:    "11rem",     // 176px
  48:    "12rem",     // 192px
  52:    "13rem",     // 208px
  56:    "14rem",     // 224px
  60:    "15rem",     // 240px
  64:    "16rem",     // 256px
  72:    "18rem",     // 288px
  80:    "20rem",     // 320px
  96:    "24rem",     // 384px
};

// ── Semantic spacing roles ───────────────────────────────────────────────────
export const space = {
  // Component internal padding
  component: {
    xs:  spacing[2],    //  8px
    sm:  spacing[3],    // 12px
    md:  spacing[4],    // 16px
    lg:  spacing[5],    // 20px
    xl:  spacing[6],    // 24px
  },

  // Section vertical padding (page sections)
  section: {
    sm:  spacing[12],   //  48px
    md:  `${spacing[16]} ${spacing[20]}`,  // 64px → 80px (sm → lg)
    lg:  `${spacing[20]} ${spacing[28]}`,  // 80px → 112px
    xl:  `${spacing[24]} ${spacing[36]}`,  // 96px → 144px
  },

  // Container padding (horizontal gutter)
  container: {
    sm:  spacing[4],    // 16px
    md:  spacing[6],    // 24px
    lg:  spacing[8],    // 32px
  },

  // Card padding
  card: {
    sm:  spacing[4],    // 16px
    md:  `${spacing[5]} ${spacing[6]}`,    // 20px → 24px
    lg:  `${spacing[6]} ${spacing[8]}`,    // 24px → 32px
  },

  // Gap between grid/flex items
  gap: {
    xs:  spacing[2],    //  8px
    sm:  spacing[3],    // 12px
    md:  spacing[4],    // 16px
    lg:  spacing[6],    // 24px
    xl:  spacing[8],    // 32px
    "2xl": spacing[12], // 48px
  },

  // Stack (vertical rhythm between siblings)
  stack: {
    xs:  spacing[1],    //  4px
    sm:  spacing[2],    //  8px
    md:  spacing[4],    // 16px
    lg:  spacing[6],    // 24px
    xl:  spacing[8],    // 32px
  },

  // Inline (horizontal spacing between siblings)
  inline: {
    xs:  spacing[1],
    sm:  spacing[2],
    md:  spacing[3],
    lg:  spacing[4],
    xl:  spacing[6],
  },
};

// ── Layout sizing ────────────────────────────────────────────────────────────
export const layout = {
  // Max content widths
  maxWidth: {
    xs:    "320px",
    sm:    "384px",
    md:    "448px",
    lg:    "512px",
    xl:    "576px",
    "2xl": "672px",
    "3xl": "768px",
    "4xl": "896px",
    "5xl": "1024px",
    "6xl": "1152px",
    "7xl": "1280px",         // default content width
    full:  "100%",
    prose: "65ch",
  },

  // Fixed structural heights
  topbar:           "64px",
  topbarSm:         "56px",
  sidebar:          "256px",
  sidebarCollapsed: "64px",
  footer:           "auto",
  mobilNav:         "64px",

  // Aspect ratios (width / height)
  aspectRatio: {
    square:   "1 / 1",
    video:    "16 / 9",
    portrait: "3 / 4",
    landscape:"4 / 3",
    wide:     "21 / 9",
    golden:   "1.618 / 1",
  },
};

// ── Border radius ────────────────────────────────────────────────────────────
export const borderRadius = {
  none:    "0px",
  sm:      "0.125rem",  // 2px
  DEFAULT: "0.25rem",   // 4px
  md:      "0.375rem",  // 6px
  lg:      "0.5rem",    // 8px
  xl:      "0.75rem",   // 12px
  "2xl":   "1rem",      // 16px
  "3xl":   "1.5rem",    // 24px
  full:    "9999px",

  // Semantic aliases
  button:  "0.5rem",    // lg  — buttons
  input:   "0.5rem",    // lg  — inputs
  card:    "0.75rem",   // xl  — cards
  modal:   "1rem",      // 2xl — modals
  avatar:  "9999px",    // full
  badge:   "9999px",    // full
  tag:     "0.375rem",  // md  — tags / chips
};

// ── Component-specific size scales ───────────────────────────────────────────
export const componentSizes = {
  // Button heights
  button: {
    xs:   "1.75rem",  // 28px
    sm:   "2rem",     // 32px
    md:   "2.25rem",  // 36px
    lg:   "2.5rem",   // 40px
    xl:   "3rem",     // 48px
    "2xl":"3.5rem",   // 56px
  },

  // Input / select heights
  input: {
    sm:  "2rem",      // 32px
    md:  "2.25rem",   // 36px
    lg:  "2.75rem",   // 44px
  },

  // Icon sizes
  icon: {
    xs:   "0.75rem",  // 12px
    sm:   "1rem",     // 16px
    md:   "1.25rem",  // 20px
    lg:   "1.5rem",   // 24px
    xl:   "2rem",     // 32px
    "2xl":"2.5rem",   // 40px
    "3xl":"3rem",     // 48px
  },

  // Avatar sizes
  avatar: {
    xs:  "1.5rem",    // 24px
    sm:  "2rem",      // 32px
    md:  "2.5rem",    // 40px
    lg:  "3rem",      // 48px
    xl:  "4rem",      // 64px
    "2xl":"5rem",     // 80px
  },

  // Badge / chip
  badge: {
    sm:  { height: "1.25rem", fontSize: "0.6875rem", px: "0.5rem" },
    md:  { height: "1.5rem",  fontSize: "0.75rem",   px: "0.625rem" },
    lg:  { height: "1.75rem", fontSize: "0.875rem",  px: "0.75rem" },
  },

  // Spinner
  spinner: {
    xs:  "0.75rem",
    sm:  "1rem",
    md:  "1.5rem",
    lg:  "2rem",
    xl:  "3rem",
  },
};