import { useState, useEffect, useCallback } from "react";

/**
 * Subscribe to a CSS media query and return whether it currently matches.
 * SSR safe — returns `defaultValue` (false by default) on the server.
 *
 * @param {string}  query        - CSS media query string e.g. "(min-width: 768px)"
 * @param {boolean} [defaultValue=false] - Value to return during SSR
 * @returns {boolean}
 *
 * @example
 * const isLargeScreen = useMediaQuery("(min-width: 1024px)");
 * const prefersDark   = useMediaQuery("(prefers-color-scheme: dark)");
 * const prefersMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
 */
export function useMediaQuery(query, defaultValue = false) {
  const getMatches = useCallback(() => {
    if (typeof window === "undefined") return defaultValue;
    return window.matchMedia(query).matches;
  }, [query, defaultValue]);

  const [matches, setMatches] = useState(getMatches);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia(query);
    // Sync on mount (handles the SSR→hydration mismatch)
    setMatches(mq.matches);

    const handler = (e) => setMatches(e.matches);
    // Use addEventListener where supported, addListener as fallback
    if (mq.addEventListener) {
      mq.addEventListener("change", handler);
      return () => mq.removeEventListener("change", handler);
    } else {
      mq.addListener(handler);
      return () => mq.removeListener(handler);
    }
  }, [query]);

  return matches;
}

// ─────────────────────────────────────────────────────────────────────────────
// Breakpoint shortcuts — match Tailwind's default screen sizes
// ─────────────────────────────────────────────────────────────────────────────

/** True when viewport width ≥ 480px */
export const useIsXs      = () => useMediaQuery("(min-width: 480px)");
/** True when viewport width ≥ 640px */
export const useIsSm      = () => useMediaQuery("(min-width: 640px)");
/** True when viewport width ≥ 768px */
export const useIsMd      = () => useMediaQuery("(min-width: 768px)");
/** True when viewport width ≥ 1024px */
export const useIsLg      = () => useMediaQuery("(min-width: 1024px)");
/** True when viewport width ≥ 1280px */
export const useIsXl      = () => useMediaQuery("(min-width: 1280px)");
/** True when viewport width ≥ 1536px */
export const useIs2Xl     = () => useMediaQuery("(min-width: 1536px)");

/** True on mobile-sized viewports (< 640px) */
export const useIsMobile  = () => useMediaQuery("(max-width: 639px)");
/** True on tablet-sized viewports (640px – 1023px) */
export const useIsTablet  = () => useMediaQuery("(min-width: 640px) and (max-width: 1023px)");
/** True on desktop-sized viewports (≥ 1024px) */
export const useIsDesktop = () => useMediaQuery("(min-width: 1024px)");
/** True on touch devices */
export const useIsTouch   = () => useMediaQuery("(hover: none) and (pointer: coarse)");

// ─────────────────────────────────────────────────────────────────────────────
// Preference shortcuts
// ─────────────────────────────────────────────────────────────────────────────

/** True if user's OS is in dark mode */
export const usePrefersDark         = () => useMediaQuery("(prefers-color-scheme: dark)");
/** True if user prefers reduced motion */
export const usePrefersReducedMotion= () => useMediaQuery("(prefers-reduced-motion: reduce)");
/** True if user prefers high contrast */
export const usePrefersHighContrast = () => useMediaQuery("(prefers-contrast: high)");

// ─────────────────────────────────────────────────────────────────────────────
// Current breakpoint hook
// Returns the active named breakpoint ("xs"|"sm"|"md"|"lg"|"xl"|"2xl")
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns the current active Tailwind breakpoint name.
 * Useful for conditional rendering that depends on more than one breakpoint.
 *
 * @returns {"xs"|"sm"|"md"|"lg"|"xl"|"2xl"}
 *
 * @example
 * const bp = useBreakpoint();
 * const cols = { xs: 1, sm: 2, lg: 3 }[bp] ?? 3;
 */
export function useBreakpoint() {
  const is2Xl = useMediaQuery("(min-width: 1536px)");
  const isXl  = useMediaQuery("(min-width: 1280px)");
  const isLg  = useMediaQuery("(min-width: 1024px)");
  const isMd  = useMediaQuery("(min-width: 768px)");
  const isSm  = useMediaQuery("(min-width: 640px)");

  if (is2Xl) return "2xl";
  if (isXl)  return "xl";
  if (isLg)  return "lg";
  if (isMd)  return "md";
  if (isSm)  return "sm";
  return "xs";
}