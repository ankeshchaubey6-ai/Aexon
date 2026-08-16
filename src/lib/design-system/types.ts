/**
 * Design System Types — CSS Variable Tokens and Themes
 * 
 * Defines the closed set of CSS variable names that can appear in the system.
 * Every generated component must use ONLY these tokens, never hardcoded values.
 */

export type ColorToken =
  | "--color-bg-primary"
  | "--color-bg-secondary"
  | "--color-bg-elevated"
  | "--color-bg-hover"
  | "--color-fg-primary"
  | "--color-fg-secondary"
  | "--color-fg-muted"
  | "--color-accent-primary"
  | "--color-accent-secondary"
  | "--color-border-default"
  | "--color-border-strong"
  | "--color-border-subtle"
  | "--color-success"
  | "--color-warning"
  | "--color-danger"
  | "--color-info";

export type TypographyToken =
  | "--font-family-sans"
  | "--font-family-serif"
  | "--font-family-mono"
  | "--font-size-xs"
  | "--font-size-sm"
  | "--font-size-base"
  | "--font-size-lg"
  | "--font-size-xl"
  | "--font-size-2xl"
  | "--font-size-3xl"
  | "--font-size-4xl"
  | "--font-size-5xl"
  | "--font-size-6xl"
  | "--font-weight-normal"
  | "--font-weight-medium"
  | "--font-weight-semibold"
  | "--font-weight-bold"
  | "--line-height-tight"
  | "--line-height-normal"
  | "--line-height-loose";

export type SpacingToken =
  | "--space-0"
  | "--space-1"
  | "--space-2"
  | "--space-3"
  | "--space-4"
  | "--space-6"
  | "--space-8"
  | "--space-12"
  | "--space-16"
  | "--space-20"
  | "--space-24"
  | "--space-32";

export type RadiusToken =
  | "--radius-none"
  | "--radius-sm"
  | "--radius-md"
  | "--radius-lg"
  | "--radius-full";

export type ShadowToken =
  | "--shadow-none"
  | "--shadow-sm"
  | "--shadow-md"
  | "--shadow-lg"
  | "--shadow-xl"
  | "--shadow-2xl";

export type MotionToken =
  | "--duration-fast"
  | "--duration-normal"
  | "--duration-slow"
  | "--easing-standard"
  | "--easing-emphasized";

export type TokenName = ColorToken | TypographyToken | SpacingToken | RadiusToken | ShadowToken | MotionToken;

/**
 * CSSVariableManifest — The resolved token values for a specific theme
 * Maps each token name to its actual CSS value
 */
export interface CSSVariableManifest {
  colors: Record<ColorToken, string>;
  typography: Record<TypographyToken, string>;
  spacing: Record<SpacingToken, string>;
  radius: Record<RadiusToken, string>;
  shadows: Record<ShadowToken, string>;
  motion: Record<MotionToken, string>;
}

/**
 * Theme definition: named preset with token values
 */
export interface Theme {
  name: string;
  mode: "light" | "dark";
  manifest: CSSVariableManifest;
}

/**
 * Centralized token taxonomy — the closed set
 */
export const TOKEN_TAXONOMY = {
  colors: [
    "--color-bg-primary",
    "--color-bg-secondary",
    "--color-bg-elevated",
    "--color-bg-hover",
    "--color-fg-primary",
    "--color-fg-secondary",
    "--color-fg-muted",
    "--color-accent-primary",
    "--color-accent-secondary",
    "--color-border-default",
    "--color-border-strong",
    "--color-border-subtle",
    "--color-success",
    "--color-warning",
    "--color-danger",
    "--color-info",
  ] as const,
  typography: [
    "--font-family-sans",
    "--font-family-serif",
    "--font-family-mono",
    "--font-size-xs",
    "--font-size-sm",
    "--font-size-base",
    "--font-size-lg",
    "--font-size-xl",
    "--font-size-2xl",
    "--font-size-3xl",
    "--font-size-4xl",
    "--font-size-5xl",
    "--font-size-6xl",
    "--font-weight-normal",
    "--font-weight-medium",
    "--font-weight-semibold",
    "--font-weight-bold",
    "--line-height-tight",
    "--line-height-normal",
    "--line-height-loose",
  ] as const,
  spacing: [
    "--space-0",
    "--space-1",
    "--space-2",
    "--space-3",
    "--space-4",
    "--space-6",
    "--space-8",
    "--space-12",
    "--space-16",
    "--space-20",
    "--space-24",
    "--space-32",
  ] as const,
  radius: [
    "--radius-none",
    "--radius-sm",
    "--radius-md",
    "--radius-lg",
    "--radius-full",
  ] as const,
  shadows: [
    "--shadow-none",
    "--shadow-sm",
    "--shadow-md",
    "--shadow-lg",
    "--shadow-xl",
    "--shadow-2xl",
  ] as const,
  motion: [
    "--duration-fast",
    "--duration-normal",
    "--duration-slow",
    "--easing-standard",
    "--easing-emphasized",
  ] as const,
};

/**
 * Check if a token name is in the closed set
 */
export function isValidToken(name: string): boolean {
  for (const category of Object.values(TOKEN_TAXONOMY)) {
    if ((category as readonly string[]).includes(name)) {
      return true;
    }
  }
  return false;
}
