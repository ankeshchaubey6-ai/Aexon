import { useState, useEffect, useCallback, useRef } from "react";

/**
 * useState backed by localStorage with JSON serialization.
 *
 * Features:
 *  - SSR safe (no window access during server render)
 *  - Cross-tab synchronization via the "storage" event
 *  - Handles JSON parse errors gracefully (falls back to initialValue)
 *  - Returns a stable `remove` function to delete the key
 *  - Optional serializer/deserializer for custom formats
 *
 * @param {string} key           - localStorage key
 * @param {T}      initialValue  - Value used when key is missing or invalid
 * @param {object} [options]
 * @param {(v:T)=>string}      [options.serialize]   - Custom serializer (default JSON.stringify)
 * @param {(s:string)=>T}      [options.deserialize] - Custom deserializer (default JSON.parse)
 * @param {boolean}            [options.syncTabs=true] - Sync state across browser tabs
 *
 * @returns {[T, (value: T | ((prev: T) => T)) => void, () => void]}
 *   [storedValue, setValue, remove]
 *
 * @example
 * const [theme, setTheme, removeTheme] = useLocalStorage("color-scheme", "light");
 *
 * const [cart, setCart] = useLocalStorage("cart", []);
 * setCart(prev => [...prev, newItem]);
 */
export function useLocalStorage(key, initialValue, options = {}) {
  const {
    serialize   = JSON.stringify,
    deserialize = JSON.parse,
    syncTabs    = true,
  } = options;

  const serializeRef   = useRef(serialize);
  const deserializeRef = useRef(deserialize);
  serializeRef.current   = serialize;
  deserializeRef.current = deserialize;

  // Lazy initial state — reads from localStorage only once
  const [storedValue, setStoredValue] = useState(() => {
    if (typeof window === "undefined") return initialValue;
    try {
      const raw = window.localStorage.getItem(key);
      return raw !== null ? deserializeRef.current(raw) : initialValue;
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
          window.localStorage.setItem(key, serializeRef.current(next));
          // Dispatch a custom event so other hooks on the same key in the same
          // tab also update (the native "storage" event doesn't fire in the
          // originating tab).
          window.dispatchEvent(
            new CustomEvent("local-storage", { detail: { key } })
          );
        }
      } catch (err) {
        console.warn(`[useLocalStorage] Failed to set key "${key}":`, err);
      }
    },
    [key, storedValue]
  );

  const remove = useCallback(() => {
    try {
      setStoredValue(initialValue);
      if (typeof window !== "undefined") {
        window.localStorage.removeItem(key);
        window.dispatchEvent(new CustomEvent("local-storage", { detail: { key } }));
      }
    } catch {}
  }, [key, initialValue]);

  // Cross-tab sync via the native "storage" event
  useEffect(() => {
    if (!syncTabs || typeof window === "undefined") return;

    const handleNativeStorage = (e) => {
      if (e.key !== key) return;
      try {
        const next = e.newValue !== null
          ? deserializeRef.current(e.newValue)
          : initialValue;
        setStoredValue(next);
      } catch {
        setStoredValue(initialValue);
      }
    };

    // Same-tab custom event
    const handleCustomEvent = (e) => {
      if (e.detail?.key !== key) return;
      try {
        const raw = window.localStorage.getItem(key);
        setStoredValue(raw !== null ? deserializeRef.current(raw) : initialValue);
      } catch {
        setStoredValue(initialValue);
      }
    };

    window.addEventListener("storage", handleNativeStorage);
    window.addEventListener("local-storage", handleCustomEvent);
    return () => {
      window.removeEventListener("storage", handleNativeStorage);
      window.removeEventListener("local-storage", handleCustomEvent);
    };
  }, [key, initialValue, syncTabs]);

  return [storedValue, setValue, remove];
}