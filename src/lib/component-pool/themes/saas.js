// ─────────────────────────────────────────────────────────────────────────────
// SAAS THEME PRESET
// Optimised for B2B SaaS products: professional, trustworthy, conversion-focused.
// Brand: blue primary + violet accent. Clean, spacious, high contrast.
//
// Usage:
//   import { saasTheme } from "@/lib/component-pool/themes/saas";
//   const theme = deepMerge(baseTheme, saasTheme);
// ─────────────────────────────────────────────────────────────────────────────

import { ramps } from "./tokens/colors.js";
import { fontWeight, fontFamily } from "./tokens/typography.js";
import { borderRadius } from "./tokens/spacing.js";
import { glowShadows } from "./tokens/shadows.js";

export const saasTheme = {
  name: "saas",
  mode: "light",  // override dark separately with deepMerge

  colors: {
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
      // CTA override — slightly more vibrant than base
      cta:            ramps.blue[600],
      ctaHover:       ramps.blue[500],
    },

    // Section backgrounds for visual rhythm
    section: {
      hero:       "#f0f9ff",   // sky-50 — trust / clarity
      features:   "#faf5ff",   // violet-50 — innovation
      pricing:    "#f0fdf4",   // emerald-50 — growth / value
      cta:        ramps.blue[600],
      testimonials:"#f8fafc",  // slate-50 — neutral authority
      stats:      "#fafafa",
      faq:        ramps.white,
      dark:       "#0f172a",   // slate-950 — power section
    },

    // Gradient presets used in hero / CTA sections
    gradient: {
      heroBg:   "linear-gradient(135deg, #f0f9ff 0%, #faf5ff 60%, #f0fdf4 100%)",
      heroRadial:"radial-gradient(ellipse at top left, rgba(219,234,254,0.8) 0%, transparent 60%)",
      ctaBg:    "linear-gradient(135deg, #1d4ed8 0%, #6d28d9 100%)",
      feature:  "linear-gradient(135deg, #ede9fe 0%, #dbeafe 100%)",
      card:     "linear-gradient(135deg, #f8fafc 0%, #f0f9ff 100%)",
      darkHero: "linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #0f2d1e 100%)",
    },
  },

  typography: {
    fontFamily: {
      ...fontFamily,
      // SaaS typically uses Inter — reinforce the default
      sans: "var(--font-sans, 'Inter', system-ui, sans-serif)",
    },
    // Hero text is larger and bolder for SaaS landing pages
    heroWeight: fontWeight.extrabold,
    ctaWeight:  fontWeight.semibold,
  },

  // SaaS components are slightly more rounded — modern, friendly
  borderRadius: {
    ...borderRadius,
    button: "0.5rem",    // lg
    input:  "0.5rem",    // lg
    card:   "0.75rem",   // xl
    modal:  "1rem",      // 2xl
  },

  components: {
    button: {
      // Primary CTA button gets a glow shadow for higher conversion
      primaryShadow:  glowShadows.blue,
      primaryShadowHover: glowShadows.blue,
      radius:         "0.5rem",
      fontWeight:     fontWeight.semibold,
    },
    hero: {
      // Eyebrow badge above the headline
      eyebrowBg:      ramps.blue[50],
      eyebrowText:    ramps.blue[700],
      eyebrowBorder:  ramps.blue[200],
      // Social proof row beneath CTAs
      socialProofColor: ramps.gray[500],
    },
    pricing: {
      // Featured plan gets a raised + glowing card
      featuredBg:     ramps.blue[600],
      featuredText:   ramps.white,
      featuredShadow: glowShadows.blue,
      featuredScale:  "scale(1.04)",
    },
    navbar: {
      // Scroll past 80px → frosted glass effect
      scrolledBg:     "rgba(255,255,255,0.90)",
      scrolledBorder: `1px solid ${ramps.gray[200]}`,
      scrolledShadow: "0 1px 12px rgba(0,0,0,0.08)",
    },
    testimonial: {
      starColor:  ramps.amber[400],
      quoteColor: ramps.gray[400],
    },
    stat: {
      numberSize: "clamp(2rem, 4vw, 3.5rem)",
      numberWeight: fontWeight.extrabold,
      numberColor: ramps.blue[600],
    },
  },

  // ── Tailwind class overrides ────────────────────────────────────────────
  // Quick class-string references the AI can use directly.
  tw: {
    heroTitle:   "text-5xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight text-gray-900 dark:text-white",
    heroSub:     "text-xl sm:text-2xl text-gray-600 dark:text-gray-300 leading-relaxed font-normal",
    sectionTitle:"text-3xl sm:text-4xl font-bold tracking-tight text-gray-900 dark:text-white",
    sectionSub:  "text-lg sm:text-xl text-gray-600 dark:text-gray-400 leading-relaxed",
    eyebrow:     "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium bg-blue-50 text-blue-700 border border-blue-100 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-900",
    ctaButton:   "bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg shadow-[0_0_0_1px_rgba(37,99,235,0.15),0_8px_32px_-4px_rgba(37,99,235,0.35)]",
    sectionBg:   "bg-white dark:bg-zinc-950",
    altBg:       "bg-gray-50 dark:bg-zinc-900",
    cardBase:    "bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl shadow-sm",
    featureIcon: "w-12 h-12 rounded-xl bg-blue-50 dark:bg-blue-950 flex items-center justify-center text-blue-600 dark:text-blue-400",
    statNumber:  "text-4xl sm:text-5xl font-extrabold text-blue-600 dark:text-blue-400",
    pricingFeatured: "bg-blue-600 text-white shadow-[0_0_0_1px_rgba(37,99,235,0.15),0_20px_40px_-8px_rgba(37,99,235,0.40)] scale-[1.04]",
  },
};