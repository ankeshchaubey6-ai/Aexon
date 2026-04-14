// src/lib/ai/engine/batch-generator.ts
// v20.0 — FILE-BY-FILE GENERATOR · DESIGN TOKEN INJECTION · ROLE-AWARE PROMPTS
//
// This module mirrors the prompt quality improvements from stream-pipeline v20.
// It is the backend used by generate-code.ts / the non-streaming code path.
//
// KEY CHANGES FROM v19:
//   • Imports resolveDesignTokens() logic inline (copy to avoid circular dep)
//   • buildSystemPrompt() injects full 30-token design system + animation library
//   • buildFileUserPrompt() uses getComponentRoleInstructions() for rich per-type prompts
//   • CODEGEN_MAX_TOKENS raised to 6000
//   • makeFallback() uses design tokens for colored safe components

import OpenAI from "openai";
import { ProjectPlan, ComponentSpec } from "./project-planner-v2";
import { DesignSystem } from "./design-system";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface StreamFile {
  path:    string;
  content: string;
}

interface DesignTokens {
  projectType:    string;
  primary:        string;
  primaryLight:   string;
  accent:         string;
  bg:             string;
  bgAlt:          string;
  bgCard:         string;
  text:           string;
  textMuted:      string;
  border:         string;
  gradient:       string;
  gradientHero:   string;
  glass:          string;
  glassBorder:    string;
  shadow:         string;
  shadowLg:       string;
  radius:         string;
  radiusLg:       string;
  displayFont:    string;
  bodyFont:       string;
  animEase:       string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const NVIDIA_BASE_URL = "https://integrate.api.nvidia.com/v1";

const CODEGEN_MODELS = [
  "qwen/qwen3-coder-480b-a35b-instruct",
  "mistralai/devstral-2-123b-instruct-2512",
  "meta/llama-3.3-70b-instruct",
] as const;

type CodegenModel = typeof CODEGEN_MODELS[number];

const MAX_FILE_RETRIES   = 3;
const MAX_FILE_CHARS     = 14_000;
const MIN_FILE_CHARS     = 50;
const CODEGEN_MAX_TOKENS = 6000;
const PING_INTERVAL_MS   = 7_000;
const PARALLEL_BATCH     = 3;

const BANNED_PACKAGES = [
  "framer-motion", "lucide-react", "react-router-dom", "react-router",
  "axios", "three", "@react-three/fiber", "@react-three/drei",
  "gsap", "zustand", "recharts", "preact", "styled-components",
  "@emotion/react", "@emotion/styled", "clsx", "classnames",
  "@tanstack/react-query", "next", "next/image", "next/link",
  "next/router", "next/navigation",
];

// ─── NVIDIA client ────────────────────────────────────────────────────────────

const client = new OpenAI({
  apiKey:  process.env.NVIDIA_API_KEY!,
  baseURL: NVIDIA_BASE_URL,
});

// ─── Model health ─────────────────────────────────────────────────────────────

const modelFailures = new Map<string, number>();
const FAILURE_THRESHOLD = 3;
function recordSuccess(m: string):     void    { modelFailures.delete(m); }
function recordFailure(m: string):     void    { modelFailures.set(m, (modelFailures.get(m) ?? 0) + 1); }
function isHealthy(m: string):         boolean { return (modelFailures.get(m) ?? 0) < FAILURE_THRESHOLD; }
function getHealthyModels():           CodegenModel[] { return CODEGEN_MODELS.filter(isHealthy); }

// ─── Rate limiter ─────────────────────────────────────────────────────────────

const rlTimestamps: number[] = [];
const RL_MAX_RPM  = 5;
const RL_WINDOW   = 62_000;

async function waitForRateLimit(label: string, onPing?: () => void): Promise<void> {
  const now     = Date.now();
  const trimmed = rlTimestamps.filter((t) => now - t < RL_WINDOW);
  rlTimestamps.length = 0;
  rlTimestamps.push(...trimmed);
  if (rlTimestamps.length < RL_MAX_RPM) { rlTimestamps.push(now); return; }
  const waitMs = RL_WINDOW - (now - rlTimestamps[0]) + 300;
  console.log(`[batch-generator][RL] Waiting ${(waitMs / 1000).toFixed(1)}s for ${label}`);
  await sleepWithPing(waitMs, onPing);
  await waitForRateLimit(label, onPing);
}

// ─── Utilities ────────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> { return new Promise((r) => setTimeout(r, ms)); }
function mlabel(model: string): string { return model.split("/")[1] ?? model; }
function backoffMs(attempt: number): number { return Math.min(1200 * Math.pow(2, attempt), 20_000); }

async function sleepWithPing(ms: number, onPing?: () => void): Promise<void> {
  if (!onPing || ms <= PING_INTERVAL_MS) return sleep(ms);
  const end = Date.now() + ms;
  while (Date.now() < end) {
    await sleep(Math.min(PING_INTERVAL_MS, end - Date.now()));
    if (Date.now() < end) onPing();
  }
}

function stripMarkdown(text: string): string {
  return text
    .replace(/^```(?:jsx?|javascript|typescript|tsx?|json)?\s*/gim, "")
    .replace(/^```\s*$/gim, "")
    .replace(/^["']use (?:client|server)["'];\s*\n*/m, "")
    .trim();
}

function fixTokenCorruption(code: string): string {
  let c = code;
  c = c.replace(/(\)|\])\s*=\s*\/\s*>/g, "$1 =>");
  c = c.replace(/(?<![=!<>])=\s*\/\s*>/g, "=>");
  c = c.replace(/\b(useState|useReducer)\s*\(\s*<REDACTED[^>]*>\s*\)/g, "$1(null)");
  c = c.replace(/=\s*\{\s*<REDACTED[^>]*>\s*\}/g, "={null}");
  c = c.replace(/\[REDACTED[^\]]*\]/g, "''");
  c = c.replace(/"<REDACTED[^>]*>"/g, "''");
  c = c.replace(/'<REDACTED[^>]*>'/g, "''");
  return c;
}

function stripBannedImports(content: string): string {
  const lines: string[] = [];
  for (const line of content.split("\n")) {
    const t = line.trim();
    if (!t.startsWith("import ")) { lines.push(line); continue; }
    if (/['"][^'"]*\.css['"]/.test(t)) continue;
    const m = t.match(/from\s+['"]([^'"]+)['"]/);
    if (!m) { lines.push(line); continue; }
    if (BANNED_PACKAGES.some((b) => m[1] === b || m[1].startsWith(b + "/"))) continue;
    lines.push(line);
  }
  let result = lines.join("\n");
  if (/<Link[\s>]/.test(result) || /<\/Link>/.test(result)) {
    result = result
      .replace(/<Link\s+to=(['"])/g, "<a href=$1")
      .replace(/<Link\s+href=(['"])/g, "<a href=$1")
      .replace(/<Link(\s[^>]*)?>/g, "<a$1>")
      .replace(/<\/Link>/g, "</a>");
  }
  return result;
}

function ensureReactImport(content: string): string {
  if (/\bimport\s+React\b/.test(content)) return content;
  if (/<[A-Za-z]/.test(content)) return `import React from 'react';\n${content}`;
  return content;
}

function ensureDefaultExport(content: string, componentName: string): string {
  const matches = (content.match(/\bexport\s+default\b/g) ?? []).length;
  if (matches === 1) return content;
  if (matches === 0) {
    const safe = componentName.replace(/[^a-zA-Z0-9_$]/g, "").replace(/^\d+/, "") || "Component";
    return `${content}\n\nexport default ${safe};\n`;
  }
  let count = 0;
  return content.replace(/\bexport\s+default\b/g, (m) => { count++; return count < matches ? "" : m; });
}

function deduplicateImports(content: string): string {
  const seen = new Set<string>();
  return content.split("\n").filter((line) => {
    const t = line.trim();
    if (!t.startsWith("import ")) return true;
    if (seen.has(t)) return false;
    seen.add(t);
    return true;
  }).join("\n");
}

function cleanOutput(content: string): string {
  return content.replace(/[ \t]+$/gm, "").replace(/\n{4,}/g, "\n\n\n").trimEnd() + "\n";
}

// ─── Design Token Resolver ────────────────────────────────────────────────────

function resolveTokens(plan: ProjectPlan): DesignTokens {
  const p = (plan.projectName + " " + plan.description).toLowerCase();

  const isSaas        = /saas|dashboard|analytics|crm|productivity|workspace|admin|platform/i.test(p);
  const isEcommerce   = /shop|store|ecommerce|product|cart|checkout|fashion/i.test(p);
  const isFinance     = /finance|fintech|bank|invest|crypto|wallet|trading/i.test(p);
  const isCreative    = /creative|agency|portfolio|design|art|studio|gallery/i.test(p);
  const isStreaming   = /streaming|music|podcast|audio|video|media|entertainment/i.test(p);
  const isHealthcare  = /health|medical|clinic|fitness|wellness/i.test(p);
  const isEducation   = /education|learning|course|tutor|school|academy/i.test(p);

  if (isSaas) return {
    projectType: "saas", primary: "#6366F1", primaryLight: "#818CF8", accent: "#06B6D4",
    bg: "#030712", bgAlt: "#0F172A", bgCard: "#111827", text: "#F9FAFB", textMuted: "#6B7280", border: "#1F2937",
    gradient: "linear-gradient(135deg, #6366F1 0%, #06B6D4 100%)",
    gradientHero: "radial-gradient(ellipse 80% 60% at 50% -10%, rgba(99,102,241,0.35) 0%, transparent 70%)",
    glass: "rgba(255,255,255,0.03)", glassBorder: "rgba(255,255,255,0.08)",
    shadow: "0 4px 24px rgba(99,102,241,0.15)", shadowLg: "0 20px 60px rgba(99,102,241,0.25)",
    radius: "12px", radiusLg: "20px",
    displayFont: "'Syne', sans-serif", bodyFont: "'DM Sans', sans-serif",
    animEase: "cubic-bezier(0.16, 1, 0.3, 1)",
  };

  if (isFinance) return {
    projectType: "finance", primary: "#10B981", primaryLight: "#34D399", accent: "#F59E0B",
    bg: "#030B0F", bgAlt: "#061019", bgCard: "#0A1628", text: "#ECF0F1", textMuted: "#5D7A8A", border: "#0F2030",
    gradient: "linear-gradient(135deg, #10B981 0%, #0EA5E9 100%)",
    gradientHero: "radial-gradient(ellipse 80% 60% at 50% -10%, rgba(16,185,129,0.25) 0%, transparent 70%)",
    glass: "rgba(16,185,129,0.04)", glassBorder: "rgba(16,185,129,0.12)",
    shadow: "0 4px 24px rgba(16,185,129,0.12)", shadowLg: "0 20px 60px rgba(16,185,129,0.2)",
    radius: "8px", radiusLg: "16px",
    displayFont: "'Libre Baskerville', serif", bodyFont: "'DM Sans', sans-serif",
    animEase: "cubic-bezier(0.22, 1, 0.36, 1)",
  };

  if (isEcommerce) return {
    projectType: "ecommerce", primary: "#E11D48", primaryLight: "#FB7185", accent: "#F59E0B",
    bg: "#FAFAF9", bgAlt: "#F5F5F4", bgCard: "#FFFFFF", text: "#1C1917", textMuted: "#78716C", border: "#E7E5E4",
    gradient: "linear-gradient(135deg, #E11D48 0%, #F59E0B 100%)",
    gradientHero: "linear-gradient(160deg, #FFF1F2 0%, #FEF3C7 100%)",
    glass: "rgba(255,255,255,0.8)", glassBorder: "rgba(0,0,0,0.06)",
    shadow: "0 4px 20px rgba(0,0,0,0.08)", shadowLg: "0 20px 60px rgba(0,0,0,0.12)",
    radius: "10px", radiusLg: "18px",
    displayFont: "'Playfair Display', serif", bodyFont: "'Lato', sans-serif",
    animEase: "cubic-bezier(0.34, 1.56, 0.64, 1)",
  };

  if (isCreative) return {
    projectType: "creative", primary: "#FF3D00", primaryLight: "#FF7043", accent: "#FFD600",
    bg: "#0A0A0A", bgAlt: "#111111", bgCard: "#181818", text: "#F5F5F5", textMuted: "#888888", border: "#222222",
    gradient: "linear-gradient(135deg, #FF3D00 0%, #FFD600 100%)",
    gradientHero: "radial-gradient(ellipse 70% 50% at 50% 0%, rgba(255,61,0,0.3) 0%, transparent 60%)",
    glass: "rgba(255,255,255,0.03)", glassBorder: "rgba(255,255,255,0.1)",
    shadow: "0 4px 24px rgba(255,61,0,0.15)", shadowLg: "0 20px 60px rgba(255,61,0,0.2)",
    radius: "4px", radiusLg: "8px",
    displayFont: "'Bebas Neue', cursive", bodyFont: "'Outfit', sans-serif",
    animEase: "cubic-bezier(0.16, 1, 0.3, 1)",
  };

  if (isStreaming) return {
    projectType: "streaming", primary: "#A855F7", primaryLight: "#C084FC", accent: "#F43F5E",
    bg: "#09090B", bgAlt: "#18181B", bgCard: "#1C1C1E", text: "#FAFAFA", textMuted: "#71717A", border: "#27272A",
    gradient: "linear-gradient(135deg, #A855F7 0%, #F43F5E 100%)",
    gradientHero: "radial-gradient(ellipse 80% 60% at 50% -5%, rgba(168,85,247,0.4) 0%, transparent 65%)",
    glass: "rgba(255,255,255,0.04)", glassBorder: "rgba(255,255,255,0.1)",
    shadow: "0 4px 24px rgba(168,85,247,0.2)", shadowLg: "0 20px 60px rgba(168,85,247,0.3)",
    radius: "14px", radiusLg: "24px",
    displayFont: "'Space Grotesk', sans-serif", bodyFont: "'Space Grotesk', sans-serif",
    animEase: "cubic-bezier(0.16, 1, 0.3, 1)",
  };

  if (isHealthcare) return {
    projectType: "healthcare", primary: "#0EA5E9", primaryLight: "#38BDF8", accent: "#10B981",
    bg: "#F8FAFC", bgAlt: "#F1F5F9", bgCard: "#FFFFFF", text: "#0F172A", textMuted: "#64748B", border: "#E2E8F0",
    gradient: "linear-gradient(135deg, #0EA5E9 0%, #10B981 100%)",
    gradientHero: "linear-gradient(160deg, #EFF6FF 0%, #ECFDF5 100%)",
    glass: "rgba(255,255,255,0.9)", glassBorder: "rgba(14,165,233,0.15)",
    shadow: "0 4px 20px rgba(14,165,233,0.1)", shadowLg: "0 20px 60px rgba(14,165,233,0.15)",
    radius: "14px", radiusLg: "24px",
    displayFont: "'Nunito', sans-serif", bodyFont: "'Source Sans 3', sans-serif",
    animEase: "cubic-bezier(0.34, 1.56, 0.64, 1)",
  };

  if (isEducation) return {
    projectType: "education", primary: "#7C3AED", primaryLight: "#A78BFA", accent: "#F59E0B",
    bg: "#0D0D1A", bgAlt: "#13132A", bgCard: "#1A1A35", text: "#EDE9FE", textMuted: "#7C7C99", border: "#252550",
    gradient: "linear-gradient(135deg, #7C3AED 0%, #DB2777 100%)",
    gradientHero: "radial-gradient(ellipse 80% 60% at 50% -10%, rgba(124,58,237,0.35) 0%, transparent 70%)",
    glass: "rgba(255,255,255,0.04)", glassBorder: "rgba(124,58,237,0.2)",
    shadow: "0 4px 24px rgba(124,58,237,0.2)", shadowLg: "0 20px 60px rgba(124,58,237,0.3)",
    radius: "12px", radiusLg: "20px",
    displayFont: "'Lexend', sans-serif", bodyFont: "'Plus Jakarta Sans', sans-serif",
    animEase: "cubic-bezier(0.16, 1, 0.3, 1)",
  };

  // Default dark modern
  return {
    projectType: "modern", primary: "#6366F1", primaryLight: "#818CF8", accent: "#F59E0B",
    bg: "#030712", bgAlt: "#0F172A", bgCard: "#111827", text: "#F9FAFB", textMuted: "#6B7280", border: "#1F2937",
    gradient: "linear-gradient(135deg, #6366F1 0%, #EC4899 100%)",
    gradientHero: "radial-gradient(ellipse 80% 60% at 50% -10%, rgba(99,102,241,0.35) 0%, transparent 70%)",
    glass: "rgba(255,255,255,0.03)", glassBorder: "rgba(255,255,255,0.08)",
    shadow: "0 4px 24px rgba(99,102,241,0.15)", shadowLg: "0 20px 60px rgba(99,102,241,0.25)",
    radius: "12px", radiusLg: "20px",
    displayFont: "'Syne', sans-serif", bodyFont: "'DM Sans', sans-serif",
    animEase: "cubic-bezier(0.16, 1, 0.3, 1)",
  };
}

// ─── Fallback component ───────────────────────────────────────────────────────

function makeFallback(spec: ComponentSpec, tokens: DesignTokens): StreamFile {
  const rawName  = spec.path.split("/").pop()?.replace(/\.[^.]+$/, "") ?? "Component";
  const safeName = rawName.replace(/[^a-zA-Z0-9_$]/g, "").replace(/^\d+/, "") || "Component";
  const compName = safeName.charAt(0).toUpperCase() + safeName.slice(1);

  const content = cleanOutput(
    `import React from 'react';

function ${compName}() {
  return (
    <section style={{
      padding: '5rem 2rem',
      textAlign: 'center',
      background: '${tokens.bgCard}',
      minHeight: '220px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    }}>
      <div>
        <h2 style={{ fontSize: '1.75rem', fontWeight: 700, color: '${tokens.text}', margin: '0 0 0.75rem', fontFamily: '${tokens.displayFont}' }}>
          ${compName}
        </h2>
        <p style={{ color: '${tokens.textMuted}', marginTop: '0.75rem', fontSize: '0.95rem', margin: 0 }}>
          ${spec.description}
        </p>
      </div>
    </section>
  );
}

export default ${compName};`
  );

  return { path: spec.path, content };
}

// ─── Component role instructions ─────────────────────────────────────────────

function getRoleInstructions(spec: ComponentSpec, tokens: DesignTokens): string {
  const p = (spec.path + " " + spec.description).toLowerCase();

  if (/nav|header|navbar/.test(p)) return `
NAVBAR: Fixed top, full width, z-index 1000.
- Glassmorphism bg: background '${tokens.glass}', backdropFilter 'blur(20px)', borderBottom '1px solid ${tokens.glassBorder}'
- Logo left (display font, gradient text), nav links center (with hover underline), CTA button right
- useState for mobile menu toggle with hamburger SVG
- Animate in: fadeInDown`;

  if (/hero/.test(p)) return `
HERO: Full viewport height (minHeight '100vh'), centered, position relative.
- Two animated blobs in background: absolute, large circles, primary color at low opacity, filter blur 120-140px, animation blob 10s infinite
- Eyebrow label (inline-block, primary bg at 15% opacity, rounded, uppercase, small font)
- Main heading: 4-6rem, display font, fontWeight 800. Use gradient text on key words.
- Subheading: 1.2rem, textMuted, maxWidth 560px, auto margin
- Two CTA buttons: glow primary + outline ghost
- Staggered fadeInUp on all elements (0s, 0.15s, 0.3s, 0.45s)`;

  if (/feature/.test(p)) return `
FEATURES: 3 or 6 cards in CSS grid.
- Section eyebrow label + large centered heading (gradient word)
- Cards: bgCard bg, 1px border, radius, padding 1.75rem
- Each card: SVG icon in colored circle (primary color), title, description
- Hover: translateY(-6px), shadowLg, border color → primary
- Staggered fadeInUp on cards`;

  if (/pricing/.test(p)) return `
PRICING: 3 tiers — Starter, Pro (featured), Enterprise.
- Monthly/Annual toggle (useState) with 20% annual discount shown
- Featured tier: gradient border via outline, scale 1.04, shadowLg
- "Most popular" badge: gradient bg, absolute positioned
- Feature list: SVG checkmarks in primary color
- CTA buttons per card
- Animate in with scaleIn + stagger`;

  if (/testimonial|review/.test(p)) return `
TESTIMONIALS: 3-4 cards in grid.
- Each: large decorative quote mark (primary, low opacity), quote text, avatar (gradient circle + initials), name, role, 5 star SVG rating
- Cards: glassmorphism or bgCard
- Hover: subtle lift
- Stagger fadeInUp`;

  if (/stat|metric|count/.test(p)) return `
STATS: 4-6 numbers in horizontal row.
- Each: animated count-up with useState + useEffect (0 → target over 2s)
- Numbers: huge font (5xl+), display font, gradient text
- Labels below in textMuted
- Background bgAlt or subtle gradient
- Animation: countUp on each stat`;

  if (/footer/.test(p)) return `
FOOTER: Full-width, dark bg.
- Logo + tagline | 3-4 nav columns (Product, Company, Resources, Legal) | social SVG icons
- Bottom bar: copyright + links, border-top separator
- Link hover: color → primary with transition`;

  if (/cta|call.to.action|banner/.test(p)) return `
CTA SECTION: High-impact conversion section.
- Gradient sweep background or strong gradient overlay
- Centered: eyebrow + large heading + subtext + two buttons
- Blob decorations in corners
- scaleIn animation`;

  return `
COMPONENT: Premium visual quality matching ${tokens.projectType} design.
- Use design tokens throughout: colors, gradients, fonts, glass effects
- Staggered entry animations with fadeInUp
- Display font (${tokens.displayFont}) for headings, body font (${tokens.bodyFont}) for text
- Real, specific content — no placeholders
- Hover states on all interactive elements with useState`;
}

// ─── Prompt builders ──────────────────────────────────────────────────────────

function buildSystemPrompt(plan: ProjectPlan, tokens: DesignTokens, generatedSoFar: StreamFile[]): string {
  const generatedList = generatedSoFar
    .filter((f) => f.path.endsWith(".jsx") || f.path.endsWith(".js"))
    .map((f) => {
      const name    = f.path.split("/").pop()!.replace(/\.[^.]+$/, "");
      const relPath = "./" + f.path.replace(/^src\//, "").replace(/\.[^.]+$/, "") + ".jsx";
      return `  ${name} → '${relPath}'`;
    })
    .join("\n") || "  (none yet)";

  return `You are an elite React engineer building production-grade websites with extraordinary visual quality.
Output ONLY raw file content. The VERY FIRST character of your response = first character of the file.
NO markdown. NO backticks. NO explanations. NO preamble. NO TypeScript.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
DESIGN TOKENS — use these in every component
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Project type:   ${tokens.projectType}
Project name:   ${plan.projectName}
Description:    ${plan.description}

Colors:
  primary:        ${tokens.primary}
  primaryLight:   ${tokens.primaryLight}
  accent:         ${tokens.accent}
  bg:             ${tokens.bg}
  bgAlt:          ${tokens.bgAlt}
  bgCard:         ${tokens.bgCard}
  text:           ${tokens.text}
  textMuted:      ${tokens.textMuted}
  border:         ${tokens.border}

Visual effects:
  gradient:       ${tokens.gradient}
  gradientHero:   ${tokens.gradientHero}
  glass bg:       ${tokens.glass}
  glass border:   ${tokens.glassBorder}
  shadow:         ${tokens.shadow}
  shadowLg:       ${tokens.shadowLg}
  radius:         ${tokens.radius}
  radiusLg:       ${tokens.radiusLg}

Typography:
  displayFont:    ${tokens.displayFont}
  bodyFont:       ${tokens.bodyFont}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ANIMATION KEYFRAMES — available in DOM, use in style={{ animation: ... }}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
fadeInUp, fadeInDown, slideInLeft, slideInRight, scaleIn
float (infinite levitate), pulseGlow (infinite glow), shimmer (gradient sweep)
spin (rotate), blob (organic morph), marquee (ticker), countUp (stat number)

STAGGER: style={{ animation: 'fadeInUp 0.6s ${tokens.animEase} 0.1s both' }}
         add 0.1s delay per child element for staggered reveal

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
UI PATTERNS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Glass card:
  style={{ background: '${tokens.glass}', backdropFilter: 'blur(20px)', border: '1px solid ${tokens.glassBorder}', borderRadius: '${tokens.radiusLg}', padding: '2rem' }}

Gradient text:
  style={{ background: '${tokens.gradient}', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}

Glow button:
  style={{ background: '${tokens.gradient}', color: '#fff', border: 'none', borderRadius: '${tokens.radius}', padding: '0.85rem 2.2rem', fontSize: '1rem', fontWeight: 600, cursor: 'pointer', boxShadow: '${tokens.shadow}', transition: 'all 0.2s ease' }}

Section label (eyebrow):
  style={{ display: 'inline-block', background: '${tokens.primary}22', color: '${tokens.primaryLight}', borderRadius: 99, padding: '0.35rem 1rem', fontSize: '0.8rem', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' }}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ALREADY GENERATED
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${generatedList}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ABSOLUTE RULES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. Styling: inline style={{}} ONLY — no className, no CSS files, no Tailwind
2. Imports: react, react-dom, relative .jsx/.js only
3. BANNED: ${BANNED_PACKAGES.slice(0, 6).join(", ")} (and more)
4. Icons: inline SVG only
5. Matching JSX open/close tags
6. Exactly ONE export default
7. Default export MUST return JSX
8. NO TypeScript syntax
9. "=>" only, NEVER "= />"
10. Complete files — no truncation, no placeholders
11. Real content — no lorem ipsum

AVAILABLE PACKAGES: react@18, react-dom@18 only`;
}

function buildFileUserPrompt(
  spec:           ComponentSpec,
  plan:           ProjectPlan,
  tokens:         DesignTokens,
  generatedSoFar: StreamFile[],
): string {
  const genMap     = new Map(generatedSoFar.map((f) => [f.path, f.content]));
  const isDataFile = /\/(utils?|data|lib)\//i.test(spec.path);
  const isHookFile = /\/hooks?\//i.test(spec.path);
  const isAppFile  = spec.path === "src/App.jsx";

  const depContext = (spec.dependencies ?? [])
    .map((dep) => {
      const content = genMap.get(dep);
      if (!content) return null;
      return `// ── DEP: ${dep} ──\n${content.split("\n").slice(0, 50).join("\n")}`;
    })
    .filter(Boolean)
    .join("\n\n");

  let task = "";

  if (isAppFile) {
    const renderables = generatedSoFar
      .filter((f) => f.path.endsWith(".jsx") && f.path !== "src/App.jsx" && !/\/(hooks?|utils?|data|lib)\//i.test(f.path))
      .map((f) => {
        const name    = f.path.split("/").pop()!.replace(".jsx", "");
        const relPath = "./" + f.path.replace(/^src\//, "").replace(".jsx", "") + ".jsx";
        return { name, relPath };
      });
    const imports = renderables.map((c) => `import ${c.name} from '${c.relPath}';`).join("\n");
    const renders = renderables.map((c) => `      <${c.name} />`).join("\n");
    task = `Write src/App.jsx that composes all components.
Use useEffect to inject global animation CSS:
useEffect(() => {
  const el = document.createElement('style'); el.id = 'ga';
  el.textContent = '@keyframes fadeInUp{from{opacity:0;transform:translateY(32px)}to{opacity:1;transform:translateY(0)}}@keyframes fadeInDown{from{opacity:0;transform:translateY(-24px)}to{opacity:1;transform:translateY(0)}}@keyframes scaleIn{from{opacity:0;transform:scale(.88)}to{opacity:1;transform:scale(1)}}@keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-12px)}}@keyframes pulseGlow{0%,100%{box-shadow:0 0 20px ${tokens.primary}66}50%{box-shadow:0 0 40px ${tokens.primary}cc}}@keyframes blob{0%,100%{transform:translate(0,0) scale(1)}33%{transform:translate(30px,-20px) scale(1.08)}66%{transform:translate(-20px,20px) scale(.94)}}@keyframes countUp{from{opacity:0;transform:translateY(16px) scale(.9)}to{opacity:1;transform:translateY(0) scale(1)}}@keyframes spin{to{transform:rotate(360deg)}}';
  if(!document.getElementById('ga')) document.head.appendChild(el);
  return()=>{const s=document.getElementById('ga');if(s)s.remove();};
}, []);

Imports:
import React, { useEffect } from 'react';
${imports}

Render in this order:
<div style={{ minHeight: '100vh', background: '${tokens.bg}', fontFamily: '${tokens.bodyFont}', overflowX: 'hidden' }}>
${renders}
</div>`;
  } else if (isDataFile || isHookFile) {
    task = `Write a complete JavaScript ${isHookFile ? "custom React hook" : "data/utility"} file.
Named OR default exports. NO JSX. Pure JS only.
${isDataFile ? "Real, specific data — at least 6-8 items." : "Clean, reusable hook with proper cleanup."}`;
  } else {
    const roleInstructions = getRoleInstructions(spec, tokens);
    task = `Write a COMPLETE, production-quality React component.
${roleInstructions}

MANDATORY:
- Use design tokens (colors, gradients, fonts) from system prompt
- At least one staggered entry animation
- Display font (${tokens.displayFont}) for headings
- Body font (${tokens.bodyFont}) for text
- Real, specific content for "${plan.projectName}"
- useState hover states on interactive elements`;
  }

  return `Write the COMPLETE file: ${spec.path}
Component: ${spec.name}
Purpose: ${spec.description}

${task}

${depContext ? `━━━ DEPENDENCY CONTEXT ━━━\n${depContext}\n` : ""}
Start NOW. First char = first char of file. No explanation. No markdown.`;
}

// ─── Core file generator ──────────────────────────────────────────────────────

async function generateSingleFile(
  spec:           ComponentSpec,
  plan:           ProjectPlan,
  tokens:         DesignTokens,
  generatedSoFar: StreamFile[],
  onPing?:        () => void,
): Promise<StreamFile> {
  const models = getHealthyModels();
  if (models.length === 0) {
    console.warn("[batch-generator] All models unhealthy — fallback");
    return makeFallback(spec, tokens);
  }

  const system     = buildSystemPrompt(plan, tokens, generatedSoFar);
  const userPrompt = buildFileUserPrompt(spec, plan, tokens, generatedSoFar);

  for (let mi = 0; mi < models.length; mi++) {
    const model = models[mi];

    for (let attempt = 0; attempt < MAX_FILE_RETRIES; attempt++) {
      await waitForRateLimit(`${mlabel(model)}/${spec.path}`, onPing);
      onPing?.();

      const abortCtrl = new AbortController();
      const timeout   = setTimeout(() => abortCtrl.abort(), 90_000);

      try {
        const temperature = 0.25 + attempt * 0.08;
        console.log(`[batch-generator] ${mlabel(model)} → ${spec.path} (attempt ${attempt + 1}, t=${temperature.toFixed(2)})`);

        const res = await client.chat.completions.create(
          {
            model, temperature,
            max_tokens: CODEGEN_MAX_TOKENS,
            messages: [
              { role: "system", content: system     },
              { role: "user",   content: userPrompt },
            ],
          },
          { signal: abortCtrl.signal },
        );

        clearTimeout(timeout);
        recordSuccess(model);

        const raw     = fixTokenCorruption(res.choices[0]?.message?.content ?? "");
        let   content = stripMarkdown(raw);

        if (content.trim().length < MIN_FILE_CHARS) throw new Error(`Too short: ${content.trim().length}c`);
        if (/=\s*\/\s*>/.test(content) || /<REDACTED/.test(content)) throw new Error("Token corruption");

        content = stripBannedImports(content);

        if (spec.path.endsWith(".jsx")) {
          content = ensureReactImport(content);
          content = ensureDefaultExport(content, spec.name);
        }

        content = deduplicateImports(content);

        if (content.length > MAX_FILE_CHARS) {
          const trunc = content.slice(0, MAX_FILE_CHARS);
          const lb    = trunc.lastIndexOf("\n}");
          content     = lb > MAX_FILE_CHARS * 0.6 ? trunc.slice(0, lb + 2) : trunc;
          if (spec.path.endsWith(".jsx")) content = ensureDefaultExport(content, spec.name);
        }

        content = cleanOutput(content);

        if (spec.path.endsWith(".jsx")) {
          if (!/\bexport\s+default\b/.test(content)) throw new Error("No export default");
          if (!/return\s*\(?\s*</.test(content))     throw new Error("No JSX return");
        }

        console.log(`[batch-generator] ✓ ${spec.path} (${content.length}c)`);
        return { path: spec.path, content };

      } catch (e: unknown) {
        clearTimeout(timeout);
        recordFailure(model);
        const status = (e as { status?: number })?.status ?? 0;
        const msg    = (e as Error)?.message ?? String(e);
        if (status === 401 || status === 403) { console.error("[batch-generator] Auth error"); return makeFallback(spec, tokens); }
        console.warn(`[batch-generator] ${mlabel(model)} ${spec.path} attempt ${attempt + 1} failed: ${msg}`);
        if (attempt < MAX_FILE_RETRIES - 1) await sleepWithPing(backoffMs(attempt), onPing);
      }
    }

    console.warn(`[batch-generator] ${mlabel(model)} exhausted for ${spec.path}`);
  }

  console.error(`[batch-generator] All models failed for ${spec.path} — fallback`);
  return makeFallback(spec, tokens);
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function generateAllFiles(
  plan:    ProjectPlan,
  _ds:     DesignSystem,
  onPing?: () => void,
): Promise<StreamFile[]> {
  modelFailures.clear();

  const tokens    = resolveTokens(plan);
  const specs     = plan.components;
  const appSpec   = specs.find((s) => s.path === "src/App.jsx");
  const nonApp    = specs.filter((s) => s.path !== "src/App.jsx");
  const generated: StreamFile[] = [];

  console.log(`[batch-generator] Generating ${specs.length} files (type: ${tokens.projectType}, models: ${getHealthyModels().map(mlabel).join(",")})`);

  for (let i = 0; i < nonApp.length; i += PARALLEL_BATCH) {
    const batch = nonApp.slice(i, i + PARALLEL_BATCH);
    console.log(`[batch-generator] Batch ${Math.floor(i / PARALLEL_BATCH) + 1}: ${batch.map((s) => s.path).join(", ")}`);
    const results = await Promise.all(
      batch.map((spec) => generateSingleFile(spec, plan, tokens, generated, onPing))
    );
    generated.push(...results);
  }

  if (appSpec) {
    console.log(`[batch-generator] Generating src/App.jsx (final, context of ${generated.length} files)`);
    const appFile = await generateSingleFile(appSpec, plan, tokens, generated, onPing);
    generated.push(appFile);
  }

  console.log(`[batch-generator] ✓ Done — ${generated.length} files`);
  return generated;
}

// ─── Compat exports ───────────────────────────────────────────────────────────

export function buildBatchSystemPrompt(plan: ProjectPlan): string {
  return `[batch-generator v20] System prompt for ${plan.projectName}. See generateAllFiles().`;
}

export function buildBatchUserPrompt(plan: ProjectPlan): string {
  return `[batch-generator v20] User prompt for ${plan.projectName}. See generateAllFiles().`;
}