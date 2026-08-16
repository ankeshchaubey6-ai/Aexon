import { useEffect, useRef, useCallback } from "react";

/**
 * Bind keyboard shortcuts with modifier support.
 *
 * Key format (case-insensitive):
 *   "Escape", "Enter", "ArrowUp", "k", "ctrl+k", "cmd+shift+p", "meta+k"
 *
 * Modifiers: ctrl, meta, shift, alt
 * "cmd" is an alias for "meta"
 * "mod" matches ctrl on Windows/Linux and meta on Mac
 *
 * @param {Record<string, (event: KeyboardEvent) => void>} keyMap
 *   Object mapping key combo strings to handler functions.
 * @param {object} [options]
 * @param {boolean}     [options.enabled=true]      - Toggle all listeners
 * @param {"keydown"|"keyup"|"keypress"} [options.event="keydown"]
 * @param {HTMLElement} [options.target]             - Element to attach to (default document)
 * @param {boolean}     [options.preventDefault=true] - Call e.preventDefault() on match
 *
 * @example
 * useKeyboard({
 *   "Escape":   () => setOpen(false),
 *   "ctrl+k":   () => openSearch(),
 *   "mod+Enter":() => submitForm(),      // ctrl on Win, cmd on Mac
 *   "ArrowUp":  () => moveSelection(-1),
 *   "ArrowDown":() => moveSelection(1),
 * });
 *
 * // Scoped to an element (e.g. a listbox):
 * useKeyboard({ "Enter": selectItem }, { target: listRef.current });
 */
export function useKeyboard(keyMap, options = {}) {
  const {
    enabled        = true,
    event          = "keydown",
    target,
    preventDefault = true,
  } = options;

  const keyMapRef = useRef(keyMap);
  useEffect(() => { keyMapRef.current = keyMap; });

  useEffect(() => {
    if (!enabled) return;

    const el = target ?? document;

    const handler = (e) => {
      const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/i.test(navigator.platform);

      // Build combo string from event
      const parts = [];
      if (e.ctrlKey)  parts.push("ctrl");
      if (e.metaKey)  parts.push("meta");
      if (e.shiftKey) parts.push("shift");
      if (e.altKey)   parts.push("alt");
      parts.push(e.key.length === 1 ? e.key.toLowerCase() : e.key);
      const combo = parts.join("+");

      // Normalize the keyMap keys and find a match
      for (const [rawKey, fn] of Object.entries(keyMapRef.current)) {
        const normalized = rawKey
          .toLowerCase()
          .replace("cmd",  "meta")
          .replace("mod",  isMac ? "meta" : "ctrl")
          .split("+")
          .sort()    // sort modifiers so order doesn't matter
          .join("+");

        const comboNorm = combo
          .toLowerCase()
          .split("+")
          .sort()
          .join("+");

        if (comboNorm === normalized) {
          if (preventDefault) e.preventDefault();
          fn(e);
          return;
        }
      }
    };

    el.addEventListener(event, handler);
    return () => el.removeEventListener(event, handler);
  }, [enabled, event, target, preventDefault]);
}

/**
 * Listen for a single key press (no combos, no modifiers required).
 * Convenience wrapper around useKeyboard.
 *
 * @param {string}   key     - e.g. "Escape", "Enter"
 * @param {function} handler
 * @param {boolean}  [enabled=true]
 *
 * @example
 * useKey("Escape", () => closeModal(), isOpen);
 */
export function useKey(key, handler, enabled = true) {
  useKeyboard({ [key]: handler }, { enabled });
}

/**
 * Trap focus within an element using Tab / Shift+Tab.
 * Exported here because it's keyboard-driven.
 *
 * @param {React.RefObject} containerRef
 * @param {boolean}         active
 *
 * @example
 * useFocusTrap(modalRef, isOpen);
 */
export function useFocusTrap(containerRef, active) {
  const FOCUSABLE = [
    "a[href]",
    "button:not([disabled])",
    "input:not([disabled])",
    "select:not([disabled])",
    "textarea:not([disabled])",
    '[tabindex]:not([tabindex="-1"])',
  ].join(", ");

  useEffect(() => {
    if (!active || !containerRef.current) return;

    const container = containerRef.current;
    const getFocusable = () => Array.from(container.querySelectorAll(FOCUSABLE));

    // Focus first element
    const focusable = getFocusable();
    focusable[0]?.focus();

    const handler = (e) => {
      if (e.key !== "Tab") return;
      const els   = getFocusable();
      const first = els[0];
      const last  = els[els.length - 1];

      if (!els.length) { e.preventDefault(); return; }

      if (e.shiftKey) {
        if (document.activeElement === first) { e.preventDefault(); last?.focus(); }
      } else {
        if (document.activeElement === last)  { e.preventDefault(); first?.focus(); }
      }
    };

    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [active, containerRef]);
}