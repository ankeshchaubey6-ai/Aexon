import { useState, useCallback, useRef } from "react";

/**
 * Copy text to the clipboard with automatic "copied" state feedback.
 *
 * @param {object} [options]
 * @param {number}   [options.timeout=2000]   - How long "copied" stays true (ms)
 * @param {function} [options.onSuccess]      - Called after successful copy
 * @param {function} [options.onError]        - Called if copy fails
 *
 * @returns {{
 *   copy:    (text: string) => Promise<boolean>,
 *   copied:  boolean,
 *   error:   Error | null,
 *   reset:   () => void,
 * }}
 *
 * @example
 * const { copy, copied } = useClipboard();
 *
 * <button onClick={() => copy(codeSnippet)}>
 *   {copied ? "Copied!" : "Copy"}
 * </button>
 *
 * // With value bound at init:
 * const { copy, copied } = useClipboard({ timeout: 3000 });
 * const copyUrl = () => copy(window.location.href);
 */
export function useClipboard(options = {}) {
  const { timeout = 2000, onSuccess, onError } = options;

  const [copied, setCopied] = useState(false);
  const [error,  setError]  = useState(null);
  const timerRef = useRef(null);

  const reset = useCallback(() => {
    clearTimeout(timerRef.current);
    setCopied(false);
    setError(null);
  }, []);

  const copy = useCallback(async (text) => {
    clearTimeout(timerRef.current);
    setError(null);

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        // Legacy fallback for older browsers / non-HTTPS contexts
        const el = document.createElement("textarea");
        el.value = text;
        el.style.cssText = "position:fixed;opacity:0;pointer-events:none;top:-9999px;left:-9999px;";
        document.body.appendChild(el);
        el.focus();
        el.select();
        const success = document.execCommand("copy");
        document.body.removeChild(el);
        if (!success) throw new Error("execCommand copy failed");
      }

      setCopied(true);
      onSuccess?.();
      timerRef.current = setTimeout(() => setCopied(false), timeout);
      return true;
    } catch (err) {
      const copyError = err instanceof Error ? err : new Error("Copy failed");
      setError(copyError);
      onError?.(copyError);
      return false;
    }
  }, [timeout, onSuccess, onError]);

  return { copy, copied, error, reset };
}

/**
 * Read the current clipboard content (requires user permission on most browsers).
 *
 * @returns {{ read: () => Promise<string>, value: string | null, error: Error | null }}
 */
export function useClipboardRead() {
  const [value, setValue] = useState(null);
  const [error, setError] = useState(null);

  const read = useCallback(async () => {
    try {
      const text = await navigator.clipboard.readText();
      setValue(text);
      setError(null);
      return text;
    } catch (err) {
      const e = err instanceof Error ? err : new Error("Read failed");
      setError(e);
      return null;
    }
  }, []);

  return { read, value, error };
}