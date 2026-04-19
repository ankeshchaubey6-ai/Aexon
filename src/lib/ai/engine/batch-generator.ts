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
import { resolveProjectImages, pickImagesForRole, ProjectImages } from "@/lib/ai/context/image-resolver";
import { sanitizeOutput } from "@/lib/ai/sanitizeOutput";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface StreamFile {
  path:    string;
  content: string;
}

interface DesignTokens {
  projectType:    string;
  primary:        string;
  primaryLight:   string;
  primaryDark?:   string;
  accent:         string;
  accentLight?:   string;
  bg:             string;
  bgAlt:          string;
  bgCard:         string;
  bgSurface?:     string;
  bgHover?:       string;
  text:           string;
  textPrimary?:   string;
  textSecondary?: string;
  textMuted:      string;
  border:         string;
  borderSubtle?:  string;
  borderDefault?: string;
  borderStrong?:  string;
  success?:       string;
  warning?:       string;
  danger?:        string;
  info?:          string;
  gradient:       string;
  gradientHero:   string;
  gradientCard?:  string;
  glass:          string;
  glassBorder:    string;
  shadowSm?:      string;
  shadow:         string;
  shadowMd?:      string;
  shadowLg:       string;
  radiusSm?:      string;
  radius:         string;
  radiusMd?:      string;
  radiusLg:       string;
  radiusXl?:      string;
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
type FileTier = "infrastructure" | "layout" | "page" | "feature" | "shared";

const MAX_FILE_RETRIES   = 3;
const MAX_FILE_CHARS     = 14_000;
const MIN_FILE_CHARS     = 50;
const CODEGEN_MAX_TOKENS = 8000;
const PING_INTERVAL_MS   = 7_000;
const PARALLEL_BATCH     = 2;

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
const RL_MAX_RPM  = 10;
const RL_WINDOW   = 60_000;

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

function withSurfaceTokens(tokens: DesignTokens): DesignTokens {
  return {
    ...tokens,
    primaryDark: tokens.primaryDark ?? tokens.primary,
    accentLight: tokens.accentLight ?? tokens.accent,
    bgSurface: tokens.bgSurface ?? tokens.bgCard,
    bgHover: tokens.bgHover ?? tokens.bgAlt,
    textPrimary: tokens.textPrimary ?? tokens.text,
    textSecondary: tokens.textSecondary ?? tokens.textMuted,
    borderSubtle: tokens.borderSubtle ?? tokens.border,
    borderDefault: tokens.borderDefault ?? tokens.border,
    borderStrong: tokens.borderStrong ?? tokens.border,
    success: tokens.success ?? "#10B981",
    warning: tokens.warning ?? "#F59E0B",
    danger: tokens.danger ?? "#EF4444",
    info: tokens.info ?? "#3B82F6",
    shadowSm: tokens.shadowSm ?? "0 1px 3px rgba(0,0,0,0.4)",
    shadowMd: tokens.shadowMd ?? tokens.shadow,
    radiusSm: tokens.radiusSm ?? "4px",
    radiusMd: tokens.radiusMd ?? tokens.radius,
    radiusXl: tokens.radiusXl ?? tokens.radiusLg,
    gradientCard: tokens.gradientCard ?? `linear-gradient(135deg, ${tokens.primary}18 0%, ${tokens.accent}0d 100%)`,
  };
}

function getFileTier(filePath: string): FileTier {
  if (
    filePath.includes("types/") ||
    filePath.includes("utils") ||
    filePath.includes("hooks/") ||
    filePath.includes("data/") ||
    filePath.includes("tailwind.config")
  ) {
    return "infrastructure";
  }
  if (filePath.includes("Layout") || filePath.includes("Navbar") || filePath.includes("Sidebar") || filePath.includes("Footer")) {
    return "layout";
  }
  if (filePath.includes("pages/") || filePath.includes("Page")) {
    return "page";
  }
  if (filePath.includes("components/") || filePath.includes("sections/") || filePath.includes("features/")) {
    return "feature";
  }
  return "shared";
}

const TIER_ORDER: FileTier[] = ["infrastructure", "layout", "page", "feature", "shared"];

function sortByDependencyOrder(files: ComponentSpec[]): ComponentSpec[] {
  return [...files].sort((a, b) => {
    const tierA = TIER_ORDER.indexOf(getFileTier(a.path));
    const tierB = TIER_ORDER.indexOf(getFileTier(b.path));
    if (tierA !== tierB) return tierA - tierB;
    return a.path.localeCompare(b.path);
  });
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
  const isMarketplace = /marketplace|listing|seller|buyer|vendor|auction|classified/i.test(p);
  const isTravel      = /travel|booking|hotel|flight|tour|destination|itinerary|trip/i.test(p);
  const isPortfolio   = /portfolio|personal.?site|resume|showcase|freelance|designer|developer.?site/i.test(p);
  const isRealEstate  = /real.?estate|property|rental|apartment|listing|mortgage|realtor/i.test(p);

  if (isMarketplace) return withSurfaceTokens({
    projectType: "marketplace", primary: "#E11D48", primaryLight: "#FB7185", primaryDark: "#9F1239", accent: "#F59E0B", accentLight: "#FCD34D",
    bg: "#0C0A09", bgAlt: "#1C1917", bgCard: "#292524", bgSurface: "#44403C", bgHover: "#57534E", text: "#FAFAF9", textPrimary: "#FAFAF9", textSecondary: "#A8A29E", textMuted: "#78716C", border: "#44403C",
    gradient: "linear-gradient(135deg, #E11D48 0%, #F59E0B 100%)", gradientHero: "radial-gradient(ellipse 80% 60% at 50% -10%, rgba(225,29,72,0.3) 0%, transparent 70%)", gradientCard: "linear-gradient(135deg, rgba(225,29,72,0.08) 0%, rgba(245,158,11,0.04) 100%)",
    glass: "rgba(255,255,255,0.04)", glassBorder: "rgba(255,255,255,0.1)", shadow: "0 4px 16px rgba(0,0,0,0.5)", shadowLg: "0 8px 32px rgba(0,0,0,0.6)", radius: "8px", radiusLg: "16px",
    displayFont: "'Syne', sans-serif", bodyFont: "'DM Sans', sans-serif", animEase: "cubic-bezier(0.16, 1, 0.3, 1)",
  });

  if (isTravel) return withSurfaceTokens({
    projectType: "travel", primary: "#FF6B35", primaryLight: "#FF8C5A", primaryDark: "#E04E1A", accent: "#004E89", accentLight: "#0369A1",
    bg: "#0A0E1A", bgAlt: "#0F1629", bgCard: "#1A2540", bgSurface: "#253358", bgHover: "#2D3D6A", text: "#F8FAFC", textPrimary: "#F8FAFC", textSecondary: "#94A3B8", textMuted: "#64748B", border: "#253358",
    gradient: "linear-gradient(135deg, #FF6B35 0%, #004E89 100%)", gradientHero: "radial-gradient(ellipse 80% 60% at 50% -10%, rgba(255,107,53,0.28) 0%, transparent 70%)", gradientCard: "linear-gradient(135deg, rgba(255,107,53,0.08) 0%, rgba(0,78,137,0.04) 100%)",
    glass: "rgba(255,255,255,0.04)", glassBorder: "rgba(255,255,255,0.1)", shadow: "0 4px 16px rgba(0,0,0,0.5)", shadowLg: "0 8px 32px rgba(0,0,0,0.6)", radius: "8px", radiusLg: "16px",
    displayFont: "'Manrope', sans-serif", bodyFont: "'DM Sans', sans-serif", animEase: "cubic-bezier(0.16, 1, 0.3, 1)",
  });

  if (isPortfolio) return withSurfaceTokens({
    projectType: "portfolio", primary: "#00FF87", primaryLight: "#4DFFA3", primaryDark: "#00CC6A", accent: "#7C3AED", accentLight: "#A78BFA",
    bg: "#0A0A0A", bgAlt: "#111111", bgCard: "#1A1A1A", bgSurface: "#222222", bgHover: "#2A2A2A", text: "#FFFFFF", textPrimary: "#FFFFFF", textSecondary: "#888888", textMuted: "#555555", border: "#333333",
    gradient: "linear-gradient(135deg, #00FF87 0%, #7C3AED 100%)", gradientHero: "radial-gradient(ellipse 60% 50% at 50% 0%, rgba(0,255,135,0.15) 0%, transparent 60%)", gradientCard: "linear-gradient(135deg, rgba(0,255,135,0.05) 0%, rgba(124,58,237,0.03) 100%)",
    glass: "rgba(255,255,255,0.03)", glassBorder: "rgba(0,255,135,0.12)", shadow: "0 4px 16px rgba(0,255,135,0.1)", shadowLg: "0 8px 32px rgba(0,255,135,0.15)", radius: "4px", radiusLg: "8px",
    displayFont: "'Space Grotesk', sans-serif", bodyFont: "'Space Grotesk', sans-serif", animEase: "cubic-bezier(0.16, 1, 0.3, 1)",
  });

  if (isRealEstate) return withSurfaceTokens({
    projectType: "realestate", primary: "#1B5E20", primaryLight: "#2E7D32", primaryDark: "#145216", accent: "#FFC107", accentLight: "#FFD54F",
    bg: "#0D1B0E", bgAlt: "#132015", bgCard: "#1A2E1C", bgSurface: "#243D26", bgHover: "#2E4D30", text: "#F1F8E9", textPrimary: "#F1F8E9", textSecondary: "#A5D6A7", textMuted: "#66BB6A", border: "#243D26",
    gradient: "linear-gradient(135deg, #1B5E20 0%, #FFC107 100%)", gradientHero: "radial-gradient(ellipse 80% 60% at 50% -10%, rgba(27,94,32,0.35) 0%, transparent 70%)", gradientCard: "linear-gradient(135deg, rgba(27,94,32,0.1) 0%, rgba(255,193,7,0.04) 100%)",
    glass: "rgba(255,255,255,0.04)", glassBorder: "rgba(165,214,167,0.12)", shadow: "0 4px 16px rgba(0,0,0,0.5)", shadowLg: "0 8px 32px rgba(0,0,0,0.6)", radius: "8px", radiusLg: "12px",
    displayFont: "'Libre Baskerville', serif", bodyFont: "'DM Sans', sans-serif", animEase: "cubic-bezier(0.22, 1, 0.36, 1)",
  });

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

// ─── Prop Safety Fixes ────────────────────────────────────────────────────────

function applyPropSafetyFixes(content: string, filePath: string): string {
  let result = content;

  // FIX 1: Add default values to destructured object props in function signatures
  // Pattern: function Name({ propName }) → function Name({ propName = {} })
  // Pattern: function Name({ propName, other }) → function Name({ propName = {}, other = {} })
  // BUT: skip props that already have defaults (= something)
  // AND: skip props named children, className, style, key, ref (these are special)
  const SKIP_PROPS = new Set(['children', 'className', 'style', 'key', 'ref', 'id']);
  
  result = result.replace(
    /function\s+([A-Z][a-zA-Z0-9]*)\s*\(\s*\{([^}]+)\}\s*(?:=\s*\{\})?\s*\)/g,
    (match, funcName, paramsStr) => {
      const params = paramsStr.split(',').map((p: string) => p.trim()).filter(Boolean);
      const fixedParams = params.map((param: string) => {
        // Already has a default value
        if (param.includes('=')) return param;
        // Get just the param name (handle rename: alias: name)
        const paramName = param.includes(':') ? param.split(':')[0].trim() : param.trim();
        // Skip special props
        if (SKIP_PROPS.has(paramName)) return param;
        // Add safe default based on name heuristics
        if (/items?|list|data|cards?|images?|photos?|posts?|products?|results?|entries|rows?/i.test(paramName)) {
          return `${param} = []`;
        }
        return `${param} = {}`;
      });
      return `function ${funcName}({ ${fixedParams.join(', ')} })`;
    }
  );

  // Same fix for arrow function components: const Name = ({ propName }) =>
  result = result.replace(
    /const\s+([A-Z][a-zA-Z0-9]*)\s*=\s*\(\s*\{([^}]+)\}\s*(?:=\s*\{\})?\s*\)\s*=>/g,
    (match, funcName, paramsStr) => {
      const params = paramsStr.split(',').map((p: string) => p.trim()).filter(Boolean);
      const fixedParams = params.map((param: string) => {
        if (param.includes('=')) return param;
        const paramName = param.includes(':') ? param.split(':')[0].trim() : param.trim();
        if (SKIP_PROPS.has(paramName)) return param;
        if (/items?|list|data|cards?|images?|photos?|posts?|products?|results?|entries|rows?/i.test(paramName)) {
          return `${param} = []`;
        }
        return `${param} = {}`;
      });
      return `const ${funcName} = ({ ${fixedParams.join(', ')} }) =>`;
    }
  );

  // FIX 2: Wrap unsafe .map() calls
  // Pattern: someVar.map( where someVar is NOT already wrapped in (someVar || [])
  result = result.replace(
    /(?<!\|\|\s*\[\]\s*\)\.|\?\s*)((?:[a-zA-Z_$][a-zA-Z0-9_$]*\.)*[a-zA-Z_$][a-zA-Z0-9_$]*)\.map\s*\(/g,
    (match, varPath) => {
      // Skip if already safe patterns
      if (match.startsWith('(') || varPath === 'Array' || varPath === 'Object') return match;
      return `(${varPath} || []).map(`;
    }
  );

  // FIX 3: Wrap unsafe .filter() calls similarly
  result = result.replace(
    /(?<!\|\|\s*\[\]\s*\)\.|\?\s*)((?:[a-zA-Z_$][a-zA-Z0-9_$]*\.)*[a-zA-Z_$][a-zA-Z0-9_$]*)\.filter\s*\(/g,
    (match, varPath) => {
      if (match.startsWith('(') || varPath === 'Array' || varPath === 'Object') return match;
      return `(${varPath} || []).filter(`;
    }
  );

  // FIX 4: Add optional chaining to common property access patterns on props
  // Pattern: propName.src → propName?.src (when propName is a known object prop name)
  // Only apply inside JSX attribute values: src={image.src} → src={image?.src}
  result = result.replace(
    /(\{)\s*([a-zA-Z_$][a-zA-Z0-9_$]*)\.(src|href|url|title|name|alt|label|text|description|id|value|content|path)\s*(\})/g,
    (match, open, varName, prop, close) => {
      // Skip if already using optional chaining
      if (match.includes('?.')) return match;
      return `${open}${varName}?.${prop}${close}`;
    }
  );

  return result;
}

// ─── Fallback component ───────────────────────────────────────────────────────

function makeFallback(spec: ComponentSpec, tokens: DesignTokens): StreamFile {
  const rawName  = spec.path.split("/").pop()?.replace(/\.[^.]+$/, "") ?? "Component";
  const safeName = rawName.replace(/[^a-zA-Z0-9_$]/g, "").replace(/^\d+/, "") || "Component";
  const compName = safeName.charAt(0).toUpperCase() + safeName.slice(1);

  // Use proxied URL for the fallback image to ensure it works in COEP-restricted iframes
  const fallbackImageUrl = "/api/image?url=" + 
    encodeURIComponent("https://images.unsplash.com/photo-1507525428034-b723cf961d3e");

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
        <img
          src="${fallbackImageUrl}"
          alt="fallback"
          style={{
            width: '300px',
            height: '200px',
            objectFit: 'cover',
            borderRadius: '8px',
            marginTop: '1rem'
          }}
        />
      </div>
    </section>
  );
}

export default ${compName};`
  );

  return { path: spec.path, content };
}

// ─── Component role instructions ─────────────────────────────────────────────

function getRoleInstructions(
  spec: ComponentSpec,
  tokens: DesignTokens,
  projectImages?: ProjectImages,
): string {
  const p = (spec.path + " " + spec.description).toLowerCase();

  const { inlineHint, images } = projectImages
    ? pickImagesForRole(spec.path, spec.description, projectImages)
    : { inlineHint: "", images: [] };

  // Wrap image URLs in proxy format for COEP-restricted iframes
  const proxyUrl = (url: string) => `/api/image?url=${encodeURIComponent(url)}`;
  
  const imageUsage = images && images.length
    ? `Use these images (REQUIRED):\n${images.map((i: any) => proxyUrl(i.url)).join("\n")}`
    : `Use fallback image:\n${proxyUrl("https://images.unsplash.com/photo-1507525428034-b723cf961d3e")}`;

  const selfContainedDataRule = `SELF-CONTAINED DATA RULE:
This component will be rendered as <ComponentName /> with NO props from parent.
Define ALL data (images array, testimonials array, nav links, etc.) as const arrays INSIDE the component function body.
Use optional chaining (?.) when accessing object properties.
Use (array || []).map() for all array iterations.

`;

  const mandatoryImageRule = `MANDATORY IMAGE RULE:

* This component MUST render at least one <img> tag with the proxied URL (includes /api/image?url=)
* NEVER return empty UI without images
* NEVER rely only on background images
* ALWAYS use provided image URLs or fallback — do NOT modify or strip the /api/image?url= prefix
* Image must be visible in JSX

${imageUsage}`;

  if (/nav|header|navbar/.test(p)) return `
NAVBAR: Fixed top, full width, z-index 1000.
- Glassmorphism bg: background '${tokens.glass}', backdropFilter 'blur(20px)', borderBottom '1px solid ${tokens.glassBorder}'
- Logo left (display font, gradient text), nav links center (with hover underline), CTA button right
- useState for mobile menu toggle with hamburger SVG
- Animate in: fadeInDown${inlineHint}

${selfContainedDataRule}${mandatoryImageRule}`;

  if (/hero/.test(p)) return `
HERO: Full viewport height (minHeight '100vh'), centered, position relative.
- Two animated blobs in background: absolute, large circles, primary color at low opacity, filter blur 120-140px, animation blob 10s infinite
- Eyebrow label (inline-block, primary bg at 15% opacity, rounded, uppercase, small font)
- Main heading: 4-6rem, display font, fontWeight 800. Use gradient text on key words.
- Subheading: 1.2rem, textMuted, maxWidth 560px, auto margin
- Two CTA buttons: glow primary + outline ghost
- Staggered fadeInUp on all elements (0s, 0.15s, 0.3s, 0.45s)${inlineHint}

${selfContainedDataRule}${mandatoryImageRule}`;

  if (/feature/.test(p)) return `
FEATURES: 3 or 6 cards in CSS grid.
- Section eyebrow label + large centered heading (gradient word)
- Cards: bgCard bg, 1px border, radius, padding 1.75rem
- Each card: SVG icon in colored circle (primary color), title, description
- Hover: translateY(-6px), shadowLg, border color → primary
- Staggered fadeInUp on cards${inlineHint}

${selfContainedDataRule}${mandatoryImageRule}`;

  if (/pricing/.test(p)) return `
PRICING: 3 tiers — Starter, Pro (featured), Enterprise.
- Monthly/Annual toggle (useState) with 20% annual discount shown
- Featured tier: gradient border via outline, scale 1.04, shadowLg
- "Most popular" badge: gradient bg, absolute positioned
- Feature list: SVG checkmarks in primary color
- CTA buttons per card
- Animate in with scaleIn + stagger${inlineHint}

${selfContainedDataRule}${mandatoryImageRule}`;

  if (/testimonial|review/.test(p)) return `
TESTIMONIALS: 3-4 cards in grid.
- Each: large decorative quote mark (primary, low opacity), quote text, avatar (gradient circle + initials), name, role, 5 star SVG rating
- Cards: glassmorphism or bgCard
- Hover: subtle lift
- Stagger fadeInUp${inlineHint}

${selfContainedDataRule}${mandatoryImageRule}`;

  if (/stat|metric|count/.test(p)) return `
STATS: 4-6 numbers in horizontal row.
- Each: animated count-up with useState + useEffect (0 → target over 2s)
- Numbers: huge font (5xl+), display font, gradient text
- Labels below in textMuted
- Background bgAlt or subtle gradient
- Animation: countUp on each stat${inlineHint}

${selfContainedDataRule}${mandatoryImageRule}`;

  if (/footer/.test(p)) return `
FOOTER: Full-width, dark bg.
- Logo + tagline | 3-4 nav columns (Product, Company, Resources, Legal) | social SVG icons
- Bottom bar: copyright + links, border-top separator
- Link hover: color → primary with transition${inlineHint}

${selfContainedDataRule}${mandatoryImageRule}`;

  if (/cta|call.to.action|banner/.test(p)) return `
CTA SECTION: High-impact conversion section.
- Gradient sweep background or strong gradient overlay
- Centered: eyebrow + large heading + subtext + two buttons
- Blob decorations in corners
- scaleIn animation${inlineHint}

${mandatoryImageRule}`;

  return `
COMPONENT: Premium visual quality matching ${tokens.projectType} design.
- Use design tokens throughout: colors, gradients, fonts, glass effects
- Staggered entry animations with fadeInUp
- Display font (${tokens.displayFont}) for headings, body font (${tokens.bodyFont}) for text
- Real, specific content — no placeholders
- Hover states on all interactive elements with useState${inlineHint}

${selfContainedDataRule}${mandatoryImageRule}`;
}

// ─── Prompt builders ──────────────────────────────────────────────────────────

function buildCssVariablesBlock(tokens: DesignTokens): string {
  const t = withSurfaceTokens(tokens);
  return `
CSS CUSTOM PROPERTIES FOR THIS PROJECT - use these variable names for ALL colors, never hardcode hex:

:root {
  --primary:        ${t.primary};
  --primary-light:  ${t.primaryLight};
  --primary-dark:   ${t.primaryDark};
  --accent:         ${t.accent};
  --accent-light:   ${t.accentLight};
  --bg:             ${t.bg};
  --bg-alt:         ${t.bgAlt};
  --bg-card:        ${t.bgCard};
  --bg-surface:     ${t.bgSurface};
  --bg-hover:       ${t.bgHover};
  --text-primary:   ${t.textPrimary};
  --text-secondary: ${t.textSecondary};
  --text-muted:     ${t.textMuted};
  --border-subtle:  ${t.borderSubtle};
  --border-default: ${t.borderDefault};
  --border-strong:  ${t.borderStrong};
  --success:        ${t.success};
  --warning:        ${t.warning};
  --danger:         ${t.danger};
  --info:           ${t.info};
  --shadow-sm:      ${t.shadowSm};
  --shadow-md:      ${t.shadowMd};
  --shadow-lg:      ${t.shadowLg};
  --radius-sm:      ${t.radiusSm};
  --radius-md:      ${t.radiusMd};
  --radius-lg:      ${t.radiusLg};
  --radius-xl:      ${t.radiusXl};
  --gradient:       ${t.gradient};
  --gradient-hero:  ${t.gradientHero};
  --gradient-card:  ${t.gradientCard};
}
`;
}

function buildSystemPrompt(
  plan: ProjectPlan,
  tokens: DesignTokens,
  generatedSoFar: StreamFile[],
  projectImages?: ProjectImages,
): string {
  const cssVariablesBlock = buildCssVariablesBlock(tokens);
  const generatedList = generatedSoFar
    .filter((f) => f.path.endsWith(".jsx") || f.path.endsWith(".js"))
    .map((f) => {
      const name    = f.path.split("/").pop()!.replace(/\.[^.]+$/, "");
      const relPath = "./" + f.path.replace(/^src\//, "").replace(/\.[^.]+$/, "") + ".jsx";
      return `  ${name} → '${relPath}'`;
    })
    .join("\n") || "  (none yet)";

  const imageSection = projectImages?.contextBlock
    ? `\n${projectImages.contextBlock}\n`
    : `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
IMAGES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
No image API keys available. Use gradients, solid colors, or SVG backgrounds for visual appeal.
`;

  return `You are an elite React engineer building production-grade websites with extraordinary visual quality.
Output ONLY raw file content. The VERY FIRST character of your response = first character of the file.
NO markdown. NO backticks. NO explanations. NO preamble. NO TypeScript.

${cssVariablesBlock}

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
${imageSection}
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
12. PROP SAFETY: Every component that receives an object prop and accesses its properties MUST use optional chaining:
    WRONG: function Card({ image }) { return <img src={image.src} /> }
    RIGHT: function Card({ image = {} }) { return <img src={image?.src} /> }
13. ARRAY PROP SAFETY: Every component that receives an array prop MUST default it to []:
    WRONG: function Grid({ items }) { return items.map(...) }
    RIGHT: function Grid({ items = [] }) { return (items || []).map(...) }
14. APP.JSX RENDERING: Components rendered in App.jsx receive NO props from parent.
    Every component must be fully self-contained with its own internal data/state.
    NEVER design a component that requires props to be passed from App.jsx.
    If a component needs data, define that data as a const INSIDE the component function.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
IMAGE ENFORCEMENT (CRITICAL)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
* EVERY component MUST include at least one <img>
* NEVER generate empty sections without visual content
* NEVER skip images or defer them to background-only treatment
* ALWAYS use Unsplash/Pexels URLs from roleInstructions (they are pre-wrapped in /api/image?url=)
* If no image provided, use fallback image: /api/image?url=https%3A%2F%2Fimages.unsplash.com%2Fphoto-1507525428034-b723cf961d3e
* Image must be visible in JSX — not just CSS background
* NEVER strip the /api/image?url= prefix or images will fail in the WebContainer iframe

AVAILABLE PACKAGES: react@18, react-dom@18 only`;
}

function buildFileUserPrompt(
  spec:           ComponentSpec,
  plan:           ProjectPlan,
  tokens:         DesignTokens,
  generatedSoFar: StreamFile[],
  projectImages?: ProjectImages,
): string {
  const genMap     = new Map(generatedSoFar.map((f) => [f.path, f.content]));
  const isDataFile = /\/(utils?|data|lib)\//i.test(spec.path);
  const isHookFile = /\/hooks?\//i.test(spec.path);
  const isAppFile  = spec.path === "src/App.jsx";

  // Calculate relative import path from current file to target file
  const getRelativePath = (from: string, to: string): string => {
    const fromParts = from.split("/").slice(0, -1); // Remove filename
    const toParts = to.replace(".jsx", "").split("/");
    
    // Count how many directories up we need to go
    let commonLen = 0;
    for (let i = 0; i < Math.min(fromParts.length, toParts.length); i++) {
      if (fromParts[i] === toParts[i]) commonLen++;
      else break;
    }
    
    const ups = fromParts.length - commonLen;
    const downs = toParts.slice(commonLen).join("/");
    const rel = (ups > 0 ? "../".repeat(ups) : "./") + downs + ".jsx";
    return rel;
  };

  const depContext = (spec.dependencies ?? [])
    .map((dep) => {
      const content = genMap.get(dep);
      if (!content) return null;
      const importPath = getRelativePath(spec.path, dep);
      return `// ── IMPORT: import ComponentName from '${importPath}' ──\n// ── CONTENT: ${dep} ──\n${content.split("\n").slice(0, 40).join("\n")}`;
    })
    .filter(Boolean)
    .join("\n\n");

  let task = "";

  if (isAppFile) {
    const renderables = generatedSoFar
      .filter((f) => f.path.endsWith(".jsx") && f.path !== "src/App.jsx" && !/\/(hooks?|utils?|data|lib)\//i.test(f.path))
      .map((f) => {
        const name    = f.path.split("/").pop()!.replace(".jsx", "");
        const relPath = getRelativePath(spec.path, f.path);
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
    const roleInstructions = getRoleInstructions(spec, tokens, projectImages);
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

${depContext ? `━━━ DEPENDENCY CONTEXT (with correct import paths) ━━━\n${depContext}\n` : ""}
Start NOW. First char = first char of file. No explanation. No markdown.`;
}

// ─── Core file generator ──────────────────────────────────────────────────────

async function generateSingleFile(
  spec:           ComponentSpec,
  plan:           ProjectPlan,
  tokens:         DesignTokens,
  generatedSoFar: StreamFile[],
  onPing?:        () => void,
  projectImages?: ProjectImages,
): Promise<StreamFile> {
  const models = getHealthyModels();
  if (models.length === 0) {
    console.warn("[batch-generator] All models unhealthy — fallback");
    return makeFallback(spec, tokens);
  }

  const system     = buildSystemPrompt(plan, tokens, generatedSoFar, projectImages);
  const userPrompt = buildFileUserPrompt(spec, plan, tokens, generatedSoFar, projectImages);

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
        if (spec.path.endsWith(".jsx")) content = applyPropSafetyFixes(content, spec.path);

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

/**
 * Determines if a file should have its image URLs sanitized
 * Sanitization applies to files that may contain HTML/JSX with image elements
 */
function shouldSanitizeFile(path: string): boolean {
  // Sanitize JSX, HTML, and JS files, but not CSS or config files
  const sanitizableExtensions = ['.jsx', '.js', '.html', '.tsx', '.ts'];
  const isConfigFile = path.includes('vite.config') || path.includes('tailwind') || path.includes('postcss');
  
  if (isConfigFile) return false;
  
  return sanitizableExtensions.some(ext => path.endsWith(ext));
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function generateAllFiles(
  plan:    ProjectPlan,
  _ds:     DesignSystem,
  onPing?: () => void,
): Promise<StreamFile[]> {
  modelFailures.clear();

  const tokens    = withSurfaceTokens(resolveTokens(plan));
  const specs     = sortByDependencyOrder(plan.components);
  const appSpec   = specs.find((s) => s.path === "src/App.jsx");
  const nonApp    = specs.filter((s) => s.path !== "src/App.jsx");
  const generated: StreamFile[] = [];

  console.log(`[batch-generator] Generating ${specs.length} files (type: ${tokens.projectType}, models: ${getHealthyModels().map(mlabel).join(",")})`);

  // Fetch images (optional enhancement, non-fatal)
  let projectImages: ProjectImages | undefined;
  try {
    console.log("[batch-generator] Fetching project images...");
    projectImages = await resolveProjectImages(plan.description, tokens.projectType, {
      unsplashKey: process.env.VITE_UNSPLASH_ACCESS_KEY,
      pexelsKey: process.env.VITE_PEXELS_API_KEY,
    });
    console.log("[batch-generator] Images resolved");
  } catch (e) {
    console.log("[batch-generator] Image fetch failed (non-fatal) — continuing with gradients");
    projectImages = undefined;
  }

  const infraFiles = nonApp.filter((s) => getFileTier(s.path) === "infrastructure");
  const uiFiles = nonApp.filter((s) => getFileTier(s.path) !== "infrastructure");

  if (infraFiles.length > 0) {
    console.log(`[batch-generator] Infrastructure batch: ${infraFiles.map((s) => s.path).join(", ")}`);
    const results = await Promise.all(
      infraFiles.map((spec) => generateSingleFile(spec, plan, tokens, generated, onPing, projectImages))
    );
    generated.push(...results);
  }

  for (let i = 0; i < uiFiles.length; i += PARALLEL_BATCH) {
    const batch = uiFiles.slice(i, i + PARALLEL_BATCH);
    console.log(`[batch-generator] UI batch ${Math.floor(i / PARALLEL_BATCH) + 1}: ${batch.map((s) => s.path).join(", ")}`);
    const results = await Promise.all(
      batch.map((spec) => generateSingleFile(spec, plan, tokens, generated, onPing, projectImages))
    );
    generated.push(...results);
  }

  if (appSpec) {
    console.log(`[batch-generator] Generating src/App.jsx (final, context of ${generated.length} files)`);
    const appFile = await generateSingleFile(appSpec, plan, tokens, generated, onPing, projectImages);
    generated.push(appFile);
  }

  console.log(`[batch-generator] ✓ Done — ${generated.length} files`);
  
  // Sanitize all generated files to handle image URLs for COEP/iframe environments
  const sanitized = generated.map((file) => ({
    ...file,
    content: shouldSanitizeFile(file.path) ? sanitizeOutput(file.content, file.path) : file.content,
  }));
  
  return sanitized;
}

// ─── Compat exports ───────────────────────────────────────────────────────────

export function buildBatchSystemPrompt(plan: ProjectPlan): string {
  return `[batch-generator v20] System prompt for ${plan.projectName}. See generateAllFiles().`;
}

export function buildBatchUserPrompt(plan: ProjectPlan): string {
  return `[batch-generator v20] User prompt for ${plan.projectName}. See generateAllFiles().`;
}
