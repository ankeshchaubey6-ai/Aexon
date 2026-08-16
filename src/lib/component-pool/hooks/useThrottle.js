import { useState, useEffect, useRef, useCallback } from "react";

/**
 * Throttle a rapidly-changing value.
 * Returns a value that updates at most once every `limit` ms.
 *
 * @param {T}      value - The value to throttle
 * @param {number} limit - Throttle interval in ms (default 200)
 * @returns {T} throttled value
 *
 * @example
 * const throttledScrollY = useThrottle(scrollY, 100);
 */
export function useThrottle(value, limit = 200) {
  const [throttled, setThrottled] = useState(value);
  const lastUpdated = useRef(Date.now());
  const timerRef    = useRef(null);

  useEffect(() => {
    const now = Date.now();
    const remaining = limit - (now - lastUpdated.current);

    if (remaining <= 0) {
      clearTimeout(timerRef.current);
      lastUpdated.current = now;
      setThrottled(value);
    } else {
      clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        lastUpdated.current = Date.now();
        setThrottled(value);
      }, remaining);
    }

    return () => clearTimeout(timerRef.current);
  }, [value, limit]);

  return throttled;
}

/**
 * Throttle a callback function.
 * Guarantees the function fires at most once per `limit` ms.
 * Always fires on the leading edge; optionally on trailing too.
 *
 * @param {function} fn    - Function to throttle
 * @param {number}   limit - Throttle interval in ms (default 200)
 * @param {object}   [opts]
 * @param {boolean}  [opts.leading=true]  - Fire on the leading edge
 * @param {boolean}  [opts.trailing=true] - Fire on the trailing edge
 * @returns {function} throttled function with `.cancel()` method
 *
 * @example
 * const handleScroll = useThrottledCallback(() => {
 *   updateParallax();
 * }, 16); // ~60fps
 *
 * useEffect(() => {
 *   window.addEventListener("scroll", handleScroll, { passive: true });
 *   return () => window.removeEventListener("scroll", handleScroll);
 * }, [handleScroll]);
 */
export function useThrottledCallback(fn, limit = 200, opts = {}) {
  const { leading = true, trailing = true } = opts;
  const fnRef       = useRef(fn);
  const lastCallRef = useRef(0);
  const timerRef    = useRef(null);
  const lastArgsRef = useRef(null);

  useEffect(() => { fnRef.current = fn; });

  const throttled = useCallback((...args) => {
    const now = Date.now();
    lastArgsRef.current = args;

    if (!lastCallRef.current && !leading) {
      lastCallRef.current = now;
    }

    const remaining = limit - (now - lastCallRef.current);

    if (remaining <= 0 || remaining > limit) {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      lastCallRef.current = now;
      fnRef.current(...args);
    } else if (!timerRef.current && trailing) {
      timerRef.current = setTimeout(() => {
        lastCallRef.current = leading ? Date.now() : 0;
        timerRef.current = null;
        fnRef.current(...lastArgsRef.current);
      }, remaining);
    }
  }, [limit, leading, trailing]);

  throttled.cancel = useCallback(() => {
    clearTimeout(timerRef.current);
    timerRef.current    = null;
    lastCallRef.current = 0;
    lastArgsRef.current = null;
  }, []);

  useEffect(() => () => throttled.cancel(), [throttled]);

  return throttled;
}