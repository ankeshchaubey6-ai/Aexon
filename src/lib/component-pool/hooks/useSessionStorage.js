import { useState, useCallback, useRef } from "react";

/**
 * useState backed by sessionStorage with JSON serialization.
 * Data is cleared when the browser tab/session ends.
 * SSR safe — returns initialValue during server render.
 *
 * @param {string} key           - sessionStorage key
 * @param {T}      initialValue  - Fallback when key is missing or parse fails
 * @param {object} [options]
 * @param {(v:T)=>string}   [options.serialize]   - Custom serializer
 * @param {(s:string)=>T}   [options.deserialize] - Custom deserializer
 *
 * @returns {[T, (value: T | ((prev: T) => T)) => void, () => void]}
 *   [storedValue, setValue, remove]
 *
 * @example
 * // Persist wizard step across soft navigations within the same tab
 * const [step, setStep, clearStep] = useSessionStorage("wizard-step", 0);
 */
export function useSessionStorage(key, initialValue, options = {}) {
  const {
    serialize   = JSON.stringify,
    deserialize = JSON.parse,
  } = options;

  const serRef = useRef(serialize);
  const desRef = useRef(deserialize);
  serRef.current = serialize;
  desRef.current = deserialize;

  const [storedValue, setStoredValue] = useState(() => {
    if (typeof window === "undefined") return initialValue;
    try {
      const raw = window.sessionStorage.getItem(key);
      return raw !== null ? desRef.current(raw) : initialValue;
    } catch {
      return initialValue;
    }
  });

  const setValue = useCallback(
    (value) => {
      try {
        const next = typeof value === "function" ? value(storedValue) : value;
        setStoredValue(next);
        if (typeof window !== "undefined") {
          window.sessionStorage.setItem(key, serRef.current(next));
        }
      } catch (err) {
        console.warn(`[useSessionStorage] Failed to set key "${key}":`, err);
      }
    },
    [key, storedValue]
  );

  const remove = useCallback(() => {
    try {
      setStoredValue(initialValue);
      if (typeof window !== "undefined") {
        window.sessionStorage.removeItem(key);
      }
    } catch {}
  }, [key, initialValue]);

  return [storedValue, setValue, remove];
}