import { useState, useEffect, useRef, useCallback } from "react";
import { useThrottledCallback } from "./useThrottle.js";

/**
 * Track page scroll position, direction, progress, and sticky-header state.
 *
 * @param {object} [options]
 * @param {number} [options.throttle=16]    - Throttle interval in ms (~60fps)
 * @param {number} [options.stickyOffset=80] - px from top to consider "scrolled"
 * @param {HTMLElement|null} [options.target] - Scroll container (default window)
 *
 * @returns {{
 *   x:          number,   - Horizontal scroll position in px
 *   y:          number,   - Vertical scroll position in px
 *   direction:  "up"|"down"|"none",
 *   isTop:      boolean,  - True when within stickyOffset of the top
 *   isBottom:   boolean,  - True when at the very bottom
 *   progress:   number,   - 0–1 scroll progress through the document
 *   velocity:   number,   - px per ms (approximate scroll speed)
 * }}
 *
 * @example
 * const { y, direction, isTop, progress } = useScroll();
 *
 * // Sticky navbar that hides on scroll-down, shows on scroll-up
 * const navVisible = direction !== "down" || isTop;
 */
export function useScroll(options = {}) {
  const { throttle = 16, stickyOffset = 80, target = null } = options;

  const [state, setState] = useState({
    x:         0,
    y:         0,
    direction: "none",
    isTop:     true,
    isBottom:  false,
    progress:  0,
    velocity:  0,
  });

  const lastYRef    = useRef(0);
  const lastTimeRef = useRef(Date.now());

  const handler = useThrottledCallback(() => {
    const el = target ?? window;
    const isWindow = el === window;

    const x = isWindow ? window.scrollX : el.scrollLeft;
    const y = isWindow ? window.scrollY : el.scrollTop;

    const scrollHeight = isWindow
      ? document.documentElement.scrollHeight
      : el.scrollHeight;
    const clientHeight = isWindow ? window.innerHeight : el.clientHeight;

    const now       = Date.now();
    const elapsed   = now - lastTimeRef.current;
    const delta     = y - lastYRef.current;
    const velocity  = elapsed > 0 ? Math.abs(delta) / elapsed : 0;
    const direction = delta > 0 ? "down" : delta < 0 ? "up" : "none";
    const progress  = Math.min((y / Math.max(scrollHeight - clientHeight, 1)), 1);

    lastYRef.current    = y;
    lastTimeRef.current = now;

    setState({
      x,
      y,
      direction,
      isTop:    y < stickyOffset,
      isBottom: Math.ceil(y + clientHeight) >= scrollHeight,
      progress,
      velocity,
    });
  }, throttle);

  useEffect(() => {
    const el = target ?? window;
    el.addEventListener("scroll", handler, { passive: true });
    // Run once to initialize
    handler();
    return () => el.removeEventListener("scroll", handler);
  }, [target, handler]);

  return state;
}

/**
 * Returns only the vertical scroll position, throttled.
 * Lighter weight than useScroll when you only need the Y value.
 *
 * @param {number} [throttle=16]
 * @returns {number}
 */
export function useScrollY(throttle = 16) {
  const [y, setY] = useState(0);

  const handler = useThrottledCallback(() => {
    setY(window.scrollY);
  }, throttle);

  useEffect(() => {
    window.addEventListener("scroll", handler, { passive: true });
    return () => window.removeEventListener("scroll", handler);
  }, [handler]);

  return y;
}

/**
 * Returns scroll progress (0–1) for the full page.
 * Great for a reading-progress bar.
 *
 * @returns {number} 0 = top, 1 = bottom
 */
export function useScrollProgress() {
  const [progress, setProgress] = useState(0);

  const handler = useThrottledCallback(() => {
    const { scrollY, innerHeight } = window;
    const { scrollHeight } = document.documentElement;
    setProgress(Math.min(scrollY / Math.max(scrollHeight - innerHeight, 1), 1));
  }, 16);

  useEffect(() => {
    window.addEventListener("scroll", handler, { passive: true });
    return () => window.removeEventListener("scroll", handler);
  }, [handler]);

  return progress;
}