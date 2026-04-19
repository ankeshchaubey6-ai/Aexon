import { useState, useEffect, useRef, useCallback } from "react";

/**
 * Debounce a rapidly-changing value.
 * Returns the value only after it has been stable for `delay` ms.
 *
 * @param {T}      value  - The value to debounce
 * @param {number} delay  - Debounce delay in ms (default 300)
 * @returns {T} debounced value
 *
 * @example
 * const [query, setQuery] = useState("");
 * const debouncedQuery = useDebounce(query, 400);
 *
 * useEffect(() => {
 *   if (debouncedQuery) search(debouncedQuery);
 * }, [debouncedQuery]);
 */
export function useDebounce(value, delay = 300) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
}

/**
 * Debounce a callback function.
 * The returned function will only fire after `delay` ms of inactivity.
 * The latest arguments are always used when it finally fires.
 *
 * @param {function} fn    - Function to debounce
 * @param {number}   delay - Debounce delay in ms (default 300)
 * @param {object}   [opts]
 * @param {boolean}  [opts.leading=false]  - Fire on the leading edge instead
 * @param {boolean}  [opts.trailing=true]  - Fire on the trailing edge
 * @returns {function} debounced function with a `.cancel()` method
 *
 * @example
 * const handleSearch = useDebouncedCallback((query) => {
 *   fetchResults(query);
 * }, 400);
 */
export function useDebouncedCallback(fn, delay = 300, opts = {}) {
  const { leading = false, trailing = true } = opts;
  const timerRef    = useRef(null);
  const fnRef       = useRef(fn);
  const leadingFired= useRef(false);

  // Always call the latest fn without re-creating the debounced wrapper
  useEffect(() => { fnRef.current = fn; });

  const debounced = useCallback((...args) => {
    const callNow = leading && !timerRef.current;

    clearTimeout(timerRef.current);

    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      leadingFired.current = false;
      if (trailing && !callNow) fnRef.current(...args);
    }, delay);

    if (callNow && !leadingFired.current) {
      leadingFired.current = true;
      fnRef.current(...args);
    }
  }, [delay, leading, trailing]);

  debounced.cancel = useCallback(() => {
    clearTimeout(timerRef.current);
    timerRef.current = null;
    leadingFired.current = false;
  }, []);

  // Cancel on unmount
  useEffect(() => () => debounced.cancel(), [debounced]);

  return debounced;
}