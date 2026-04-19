import { useEffect, useCallback } from "react";
import { useLocalStorage } from "./useLocalStorage.js";

/**
 * Dark mode manager.
 *
 * - Persists preference to localStorage under the key "color-scheme"
 * - Syncs with the OS/browser "prefers-color-scheme" when mode is "system"
 * - Applies the `dark` class and `data-theme` attribute to <html>
 * - Cross-tab sync via useLocalStorage's storage event listener
 *
 * @param {object} [options]
 * @param {"light"|"dark"|"system"} [options.defaultMode="system"] - Initial mode
 * @param {string}  [options.storageKey="color-scheme"] - localStorage key
 * @param {string}  [options.darkClass="dark"]  - Class applied to <html> in dark mode
 * @param {string}  [options.lightClass=""]     - Class applied to <html> in light mode
 *
 * @returns {{
 *   isDark:   boolean,
 *   mode:     "light"|"dark"|"system",
 *   setMode:  (m: "light"|"dark"|"system") => void,
 *   toggle:   () => void,
 * }}
 *
 * @example
 * const { isDark, mode, setMode, toggle } = useDarkMode();
 *
 * // In a theme toggle button:
 * <button onClick={toggle}>{isDark ? "Light" : "Dark"} mode</button>
 *
 * // Cycle through all three modes:
 * const cycle = () => setMode(mode === "light" ? "dark" : mode === "dark" ? "system" : "light");
 */
export function useDarkMode(options = {}) {
  const {
    defaultMode = "system",
    storageKey  = "color-scheme",
    darkClass   = "dark",
    lightClass  = "",
  } = options;

  const [mode, setMode] = useLocalStorage(storageKey, defaultMode);

  // Resolve whether dark is actually active
  const resolveIsDark = useCallback((currentMode) => {
    if (currentMode === "dark")  return true;
    if (currentMode === "light") return false;
    // "system"
    if (typeof window === "undefined") return false;
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  }, []);

  const isDark = resolveIsDark(mode);

  // Apply/remove class and attribute on <html>
  useEffect(() => {
    if (typeof document === "undefined") return;
    const root = document.documentElement;

    if (isDark) {
      if (darkClass)  root.classList.add(darkClass);
      if (lightClass) root.classList.remove(lightClass);
      root.setAttribute("data-theme", "dark");
      root.style.colorScheme = "dark";
    } else {
      if (darkClass)  root.classList.remove(darkClass);
      if (lightClass) root.classList.add(lightClass);
      root.setAttribute("data-theme", "light");
      root.style.colorScheme = "light";
    }
  }, [isDark, darkClass, lightClass]);

  // When mode is "system", listen for OS changes and re-apply
  useEffect(() => {
    if (mode !== "system" || typeof window === "undefined") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => {
      const root = document.documentElement;
      const nowDark = mq.matches;
      if (nowDark) {
        if (darkClass)  root.classList.add(darkClass);
        if (lightClass) root.classList.remove(lightClass);
        root.setAttribute("data-theme", "dark");
        root.style.colorScheme = "dark";
      } else {
        if (darkClass)  root.classList.remove(darkClass);
        if (lightClass) root.classList.add(lightClass);
        root.setAttribute("data-theme", "light");
        root.style.colorScheme = "light";
      }
    };
    if (mq.addEventListener) {
      mq.addEventListener("change", handler);
      return () => mq.removeEventListener("change", handler);
    }
    mq.addListener(handler);
    return () => mq.removeListener(handler);
  }, [mode, darkClass, lightClass]);

  /** Toggle between light and dark (skips "system") */
  const toggle = useCallback(() => {
    setMode((prev) => {
      const resolved = resolveIsDark(prev);
      return resolved ? "light" : "dark";
    });
  }, [setMode, resolveIsDark]);

  return { isDark, mode, setMode, toggle };
}