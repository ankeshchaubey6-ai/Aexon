// ─────────────────────────────────────────────
// Layout
// ─────────────────────────────────────────────

export const MAX_CONTENT_WIDTH    = "1280px";
export const CONTAINER_PADDING    = { sm: "1rem", md: "1.5rem", lg: "2rem" };
export const SIDEBAR_WIDTH        = 256; // px
export const SIDEBAR_COLLAPSED    = 64;  // px
export const TOPBAR_HEIGHT        = 64;  // px

// ─────────────────────────────────────────────
// Responsive breakpoints (must match tailwind.config)
// ─────────────────────────────────────────────

export const BREAKPOINTS = {
  sm:  640,
  md:  768,
  lg:  1024,
  xl:  1280,
  "2xl": 1536,
};

export const MEDIA = Object.fromEntries(
  Object.entries(BREAKPOINTS).map(([k, v]) => [k, `(min-width: ${v}px)`])
);

// ─────────────────────────────────────────────
// Z-index scale (every component must use these)
// ─────────────────────────────────────────────

export const Z = {
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
};

// ─────────────────────────────────────────────
// Animation durations (ms)
// ─────────────────────────────────────────────

export const DURATION = {
  instant:   0,
  faster:    100,
  fast:      150,
  normal:    250,
  slow:      400,
  slower:    600,
  slowest:   1000,
};

// ─────────────────────────────────────────────
// Easing curves
// ─────────────────────────────────────────────

export const EASING = {
  out:          "cubic-bezier(0.25, 0.46, 0.45, 0.94)",
  in:           "cubic-bezier(0.55, 0.055, 0.675, 0.19)",
  inOut:        "cubic-bezier(0.645, 0.045, 0.355, 1.0)",
  spring:       "cubic-bezier(0.34, 1.56, 0.64, 1)",
  linear:       "linear",
};

// ─────────────────────────────────────────────
// Spacing (base-4 scale matching Tailwind)
// ─────────────────────────────────────────────

export const SPACING = {
  0:    "0px",
  px:   "1px",
  0.5:  "0.125rem",
  1:    "0.25rem",
  2:    "0.5rem",
  3:    "0.75rem",
  4:    "1rem",
  5:    "1.25rem",
  6:    "1.5rem",
  8:    "2rem",
  10:   "2.5rem",
  12:   "3rem",
  16:   "4rem",
  20:   "5rem",
  24:   "6rem",
  32:   "8rem",
  40:   "10rem",
  48:   "12rem",
  64:   "16rem",
  80:   "20rem",
  96:   "24rem",
};

// ─────────────────────────────────────────────
// Border radius
// ─────────────────────────────────────────────

export const RADIUS = {
  none:   "0px",
  sm:     "0.125rem",
  DEFAULT:"0.25rem",
  md:     "0.375rem",
  lg:     "0.5rem",
  xl:     "0.75rem",
  "2xl":  "1rem",
  "3xl":  "1.5rem",
  full:   "9999px",
};

// ─────────────────────────────────────────────
// Typography
// ─────────────────────────────────────────────

export const DEFAULT_FONT_SANS  = "'Inter', 'Helvetica Neue', system-ui, sans-serif";
export const DEFAULT_FONT_MONO  = "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace";
export const DEFAULT_FONT_SERIF = "'Lora', Georgia, 'Times New Roman', serif";

export const FONT_SIZE = {
  xs:   "0.75rem",
  sm:   "0.875rem",
  base: "1rem",
  lg:   "1.125rem",
  xl:   "1.25rem",
  "2xl":"1.5rem",
  "3xl":"1.875rem",
  "4xl":"2.25rem",
  "5xl":"3rem",
  "6xl":"3.75rem",
  "7xl":"4.5rem",
  "8xl":"6rem",
};

// ─────────────────────────────────────────────
// Site types (used by AI component selector)
// ─────────────────────────────────────────────

export const SITE_TYPES = [
  "landing",
  "saas",
  "ecommerce",
  "dashboard",
  "blog",
  "portfolio",
  "auth",
  "docs",
  "startup",
  "agency",
];

// ─────────────────────────────────────────────
// Component categories
// ─────────────────────────────────────────────

export const CATEGORIES = [
  "primitives",
  "blocks",
  "animations",
  "layouts",
  "hooks",
  "utils",
];

// ─────────────────────────────────────────────
// Keyboard keys
// ─────────────────────────────────────────────

export const KEYS = {
  ENTER:      "Enter",
  ESCAPE:     "Escape",
  SPACE:      " ",
  TAB:        "Tab",
  ARROW_UP:   "ArrowUp",
  ARROW_DOWN: "ArrowDown",
  ARROW_LEFT: "ArrowLeft",
  ARROW_RIGHT:"ArrowRight",
  HOME:       "Home",
  END:        "End",
  PAGE_UP:    "PageUp",
  PAGE_DOWN:  "PageDown",
  BACKSPACE:  "Backspace",
  DELETE:     "Delete",
};

// ─────────────────────────────────────────────
// Regex patterns (reuse to avoid duplication)
// ─────────────────────────────────────────────

export const REGEX = {
  EMAIL:     /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/,
  URL:       /^https?:\/\/[^\s/$.?#].[^\s]*$/i,
  PHONE:     /^\+?[\d\s\-().]{7,15}$/,
  HEX_COLOR: /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/,
  ZIP_US:    /^\d{5}(-\d{4})?$/,
  SLUG:      /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
  UUID:      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
};

// ─────────────────────────────────────────────
// Local storage keys (central registry — no magic strings)
// ─────────────────────────────────────────────

export const LS_KEYS = {
  COLOR_SCHEME:   "color-scheme",      // "light" | "dark" | "system"
  AUTH_TOKEN:     "auth-token",
  SIDEBAR_STATE:  "sidebar-collapsed",
  RECENT_SEARCH:  "recent-searches",
  ONBOARDING:     "onboarding-complete",
  COOKIE_CONSENT: "cookie-consent",
  LANGUAGE:       "app-language",
};

// ─────────────────────────────────────────────
// HTTP status codes (common ones)
// ─────────────────────────────────────────────

export const HTTP = {
  OK:                    200,
  CREATED:               201,
  NO_CONTENT:            204,
  BAD_REQUEST:           400,
  UNAUTHORIZED:          401,
  FORBIDDEN:             403,
  NOT_FOUND:             404,
  METHOD_NOT_ALLOWED:    405,
  CONFLICT:              409,
  UNPROCESSABLE_ENTITY:  422,
  TOO_MANY_REQUESTS:     429,
  INTERNAL_SERVER_ERROR: 500,
  BAD_GATEWAY:           502,
  SERVICE_UNAVAILABLE:   503,
};

// ─────────────────────────────────────────────
// Pagination defaults
// ─────────────────────────────────────────────

export const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];
export const DEFAULT_PAGE_SIZE = 20;

// ─────────────────────────────────────────────
// File upload constraints
// ─────────────────────────────────────────────

export const FILE = {
  MAX_SIZE_MB:    10,
  MAX_SIZE_BYTES: 10 * 1024 * 1024,
  IMAGE_TYPES:    ["image/jpeg", "image/png", "image/webp", "image/gif", "image/svg+xml"],
  DOC_TYPES:      ["application/pdf", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
  VIDEO_TYPES:    ["video/mp4", "video/webm", "video/ogg"],
};

// ─────────────────────────────────────────────
// Social / OAuth providers
// ─────────────────────────────────────────────

export const OAUTH_PROVIDERS = ["google", "github", "apple", "facebook", "twitter", "linkedin", "microsoft"];