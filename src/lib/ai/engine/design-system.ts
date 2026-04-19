// src/lib/ai/engine/design-system.ts
// Stage 0: Design system bootstrap — deterministic theme detection and token generation.

export interface DesignSystem {
  colors: Record<string, string>;
  fonts: string;
  spacing: Record<string, string>;
  globalCss: string;
}

/**
 * Detect theme from prompt and return a coherent design system.
 * Pure deterministic function — no LLM calls.
 */
export function buildDesignSystem(prompt: string): DesignSystem {
  const isDark = /dark|night|black|minimal|saas|dashboard|modern|glass/i.test(prompt);
  const isRed = /red|crimson|scarlet|ruby|maroon/i.test(prompt);
  const isPurple = /purple|violet|indigo/i.test(prompt);
  const isGreen = /green|eco|nature|health/i.test(prompt);
  const isBlue = /blue|ocean|cyan|sky/i.test(prompt);

  const primaryColor = isRed ? "#DC2626"
    : isPurple ? "#8B5CF6"
    : isGreen ? "#10B981"
    : isBlue ? "#3B82F6"
    : "#6366F1";

  const bgColor = isDark ? "#0F0F17" : "#FFFFFF";
  const textColor = isDark ? "#F1F5F9" : "#0F172A";

  const colors = {
    primary: primaryColor,
    primaryHover: primaryColor + "CC",
    bg: bgColor,
    bgAlt: isDark ? "#171717" : "#F8FAFC",
    bgCard: isDark ? "#111111" : "#FFFFFF",
    text: textColor,
    textMuted: isDark ? "#A3A3A3" : "#64748B",
    border: isDark ? "#262626" : "#E2E8F0",
    success: "#10B981",
    warning: "#F59E0B",
    danger: "#EF4444",
  };

  const fonts = "Inter, system-ui, -apple-system, sans-serif";

  const spacing = {
    xs: "0.25rem",
    sm: "0.5rem",
    md: "1rem",
    lg: "1.5rem",
    xl: "2rem",
    "2xl": "3rem",
    "3xl": "4rem",
  };

  const globalCss = `
*, *::before, *::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  font-family: ${fonts};
  background: ${colors.bg};
  color: ${colors.text};
  line-height: 1.5;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

a {
  color: ${colors.primary};
  text-decoration: none;
  transition: color 0.15s ease;
}

a:hover {
  color: ${colors.primaryHover};
}

img, video, svg {
  max-width: 100%;
  height: auto;
  display: block;
}
`.trim();

  return { colors, fonts, spacing, globalCss };
}

/**
 * Format design system for inclusion in LLM prompts.
 */
export function designSystemToPromptFragment(ds: DesignSystem): string {
  const { colors, fonts, spacing } = ds;
  const colorEntries = Object.entries(colors)
    .map(([k, v]) => `  ${k}: ${v}`)
    .join("\n");
  const spacingEntries = Object.entries(spacing)
    .map(([k, v]) => `  ${k}: ${v}`)
    .join("\n");

  return `DESIGN SYSTEM
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Colors:
${colorEntries}

Typography:
  Font family: ${fonts}

Spacing scale:
${spacingEntries}`;
}

/**
 * Generate a Tailwind configuration snippet that extends the theme.
 */
export function designSystemToTailwindConfig(ds: DesignSystem): string {
  return `/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: '${ds.colors.primary}',
        'primary-hover': '${ds.colors.primaryHover}',
        bg: '${ds.colors.bg}',
        'bg-alt': '${ds.colors.bgAlt}',
        'bg-card': '${ds.colors.bgCard}',
        text: '${ds.colors.text}',
        'text-muted': '${ds.colors.textMuted}',
        border: '${ds.colors.border}',
        success: '${ds.colors.success}',
        warning: '${ds.colors.warning}',
        danger: '${ds.colors.danger}',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};`;
}
