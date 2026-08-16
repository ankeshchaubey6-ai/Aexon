// ─────────────────────────────────────────────────────────────────────────────
// STARTUP THEME PRESET
// Optimised for early-stage products, waitlists, product launches, and
// coming-soon pages. Bold gradients, dark sections, high energy.
// Brand: electric blue → violet gradient + black background option.
//
// Usage:
//   import { startupTheme } from "@/lib/component-pool/themes/startup";
//   const theme = deepMerge(baseTheme, startupTheme);
// ─────────────────────────────────────────────────────────────────────────────

import { ramps } from "./tokens/colors.js";
import { fontWeight, fontFamily } from "./tokens/typography.js";
import { borderRadius, spacing } from "./tokens/spacing.js";
import { glowShadows, shadows } from "./tokens/shadows.js";

export const startupTheme = {
  name: "startup",
  mode: "dark",  // Startups often default to dark mode for drama

  colors: {
    brand: {
      primary:        "#6366f1",   // indigo-500 — electric
      primaryHover:   "#4f46e5",
      primaryActive:  "#4338ca",
      primarySubtle:  "rgba(99,102,241,0.10)",
      primaryMuted:   "rgba(99,102,241,0.15)",
      secondary:      "#a855f7",   // purple-500 — expressive
      secondaryHover: "#9333ea",
      accent:         "#06b6d4",   // cyan-500 — tech feel
      accentHover:    "#0891b2",
      cta:            "#6366f1",
      ctaHover:       "#818cf8",   // lighter on hover (dark bg)
    },

    // Dark-first backgrounds
    surface: {
      page:       "#050508",       // Near black
      subtle:     "#0d0d12",
      muted:      "#141420",
      card:       "#111118",
      cardHover:  "#18181f",
      overlay:    "rgba(0,0,0,0.80)",
      invert:     ramps.zinc[50],
    },

    text: {
      primary:    ramps.zinc[50],
      secondary:  ramps.zinc[400],
      muted:      ramps.zinc[500],
      disabled:   ramps.zinc[700],
      inverse:    ramps.zinc[900],
      link:       "#818cf8",
      linkHover:  "#a5b4fc",
      onBrand:    ramps.white,
    },

    border: {
      DEFAULT:  "rgba(255,255,255,0.08)",
      subtle:   "rgba(255,255,255,0.05)",
      strong:   "rgba(255,255,255,0.15)",
      focus:    "#6366f1",
      error:    ramps.rose[400],
      invert:   ramps.zinc[700],
      glow:     "rgba(99,102,241,0.40)",
    },

    // Brand gradient palette
    gradient: {
      hero:         "linear-gradient(135deg, #050508 0%, #0d0b1a 50%, #050a15 100%)",
      heroGlow:     "radial-gradient(ellipse at 50% 0%, rgba(99,102,241,0.25) 0%, transparent 60%)",
      ctaBg:        "linear-gradient(135deg, #4338ca 0%, #7c3aed 50%, #a855f7 100%)",
      card:         "linear-gradient(135deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.01) 100%)",
      textGradient: "linear-gradient(135deg, #818cf8 0%, #c084fc 50%, #22d3ee 100%)",
      border:       "linear-gradient(135deg, rgba(99,102,241,0.5) 0%, rgba(168,85,247,0.5) 100%)",
      mesh:         `
        radial-gradient(at 40% 20%, rgba(99,102,241,0.15) 0, transparent 50%),
        radial-gradient(at 80% 0%, rgba(168,85,247,0.10) 0, transparent 50%),
        radial-gradient(at 0% 50%, rgba(6,182,212,0.10) 0, transparent 50%),
        radial-gradient(at 80% 50%, rgba(99,102,241,0.10) 0, transparent 50%),
        radial-gradient(at 0% 100%, rgba(168,85,247,0.15) 0, transparent 50%)
      `.replace(/\n\s+/g, " "),
    },

    // Status colors stay readable on dark bg
    success: {
      DEFAULT:  ramps.emerald[400],
      subtle:   "rgba(52,211,153,0.10)",
      text:     ramps.emerald[300],
    },
    danger: {
      DEFAULT:  ramps.rose[400],
      subtle:   "rgba(244,63,94,0.10)",
      text:     ramps.rose[300],
    },
    warning: {
      DEFAULT:  ramps.amber[400],
      subtle:   "rgba(251,191,36,0.10)",
      text:     ramps.amber[300],
    },
  },

  typography: {
    fontFamily: {
      ...fontFamily,
      // Startups often use a bolder display font
      display: "var(--font-display, 'Cal Sans', 'Sora', 'Inter', system-ui, sans-serif)",
    },
    heroWeight:     fontWeight.extrabold,
    displayWeight:  fontWeight.black,
  },

  borderRadius: {
    ...borderRadius,
    button:  "0.5rem",
    input:   "0.5rem",
    card:    "1rem",      // 2xl — rounded for modern feel
    modal:   "1.5rem",    // 3xl
    badge:   "9999px",    // pill
  },

  components: {
    button: {
      // Primary — glowing indigo
      primaryBg:      "#6366f1",
      primaryBgHover: "#4f46e5",
      primaryShadow:  glowShadows.violet,
      primaryRadius:  "0.5rem",
      fontWeight:     fontWeight.semibold,

      // Outline style for secondary actions on dark bg
      outlineBorder:  "rgba(255,255,255,0.15)",
      outlineText:    ramps.zinc[100],
      outlineHoverBg: "rgba(255,255,255,0.05)",
    },

    hero: {
      gradientText:  "bg-gradient-to-r from-indigo-400 via-purple-400 to-cyan-400 bg-clip-text text-transparent",
      eyebrowBg:     "rgba(99,102,241,0.10)",
      eyebrowBorder: "rgba(99,102,241,0.25)",
      eyebrowText:   "#a5b4fc",
      glowBg:        "radial-gradient(ellipse at 50% 0%, rgba(99,102,241,0.25) 0%, transparent 60%)",
    },

    card: {
      bg:            "rgba(255,255,255,0.03)",
      border:        "rgba(255,255,255,0.08)",
      borderHover:   "rgba(99,102,241,0.40)",
      shadow:        shadows.lg,
      shadowHover:   glowShadows.violet,
      radius:        "1rem",
      backdropBlur:  "blur(12px)",
    },

    waitlist: {
      inputBg:       "rgba(255,255,255,0.05)",
      inputBorder:   "rgba(255,255,255,0.10)",
      inputFocus:    "rgba(99,102,241,0.50)",
      counterColor:  "#818cf8",
      counterBg:     "rgba(99,102,241,0.10)",
    },

    navbar: {
      bg:            "rgba(5,5,8,0.80)",
      border:        "rgba(255,255,255,0.06)",
      backdropBlur:  "blur(20px)",
      logo:          ramps.white,
      linkColor:     ramps.zinc[400],
      linkHover:     ramps.zinc[100],
    },

    badge: {
      // Glowing pill badge for "Coming soon", "Beta", "New"
      bg:      "rgba(99,102,241,0.15)",
      border:  "rgba(99,102,241,0.30)",
      text:    "#a5b4fc",
      glow:    "0 0 20px rgba(99,102,241,0.25)",
    },
  },

  // ── Tailwind class references ────────────────────────────────────────────
  tw: {
    page:            "bg-[#050508] text-zinc-50 antialiased",
    heroTitle:       "text-5xl sm:text-6xl lg:text-8xl font-extrabold tracking-tighter",
    heroGradientText:"bg-gradient-to-r from-indigo-400 via-purple-400 to-cyan-400 bg-clip-text text-transparent",
    heroSub:         "text-lg sm:text-xl text-zinc-400 leading-relaxed",
    eyebrow:         "inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium bg-indigo-500/10 text-indigo-300 border border-indigo-500/25 backdrop-blur-sm",
    card:            "rounded-2xl border border-white/[0.08] bg-white/[0.03] backdrop-blur-sm hover:border-indigo-500/40 transition-all duration-300",
    ctaButton:       "bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-lg shadow-[0_0_0_1px_rgba(99,102,241,0.15),0_8px_32px_-4px_rgba(99,102,241,0.50)] transition-all duration-200",
    outlineButton:   "border border-white/15 hover:border-white/25 hover:bg-white/5 text-zinc-100 font-medium rounded-lg transition-all duration-200",
    glowDot:         "w-2 h-2 rounded-full bg-indigo-400 animate-pulse shadow-[0_0_8px_rgba(99,102,241,0.8)]",
    sectionGlow:     "relative overflow-hidden before:absolute before:inset-0 before:bg-[radial-gradient(ellipse_at_50%_0%,rgba(99,102,241,0.15)_0%,transparent_60%)]",
    meshGradient:    "[background-image:radial-gradient(at_40%_20%,rgba(99,102,241,0.15)_0,transparent_50%),radial-gradient(at_80%_0%,rgba(168,85,247,0.1)_0,transparent_50%)]",
    counterBadge:    "inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/25 text-indigo-300 text-sm font-medium",
    waitlistInput:   "flex-1 px-4 py-3 rounded-lg bg-white/5 border border-white/10 text-white placeholder:text-zinc-500 focus:outline-none focus:border-indigo-500/50 focus:ring-2 focus:ring-indigo-500/25 transition-all",
    navLink:         "text-zinc-400 hover:text-zinc-100 text-sm font-medium transition-colors",
    divider:         "border-white/[0.06]",
  },
};