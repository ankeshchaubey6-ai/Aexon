import { useEffect, useRef, useCallback } from "react";

/**
 * Call a handler when a pointer or keyboard event occurs outside the
 * referenced element. Used by Dropdown, Popover, ColorPicker, DatePicker.
 *
 * @param {React.RefObject | React.RefObject[]} ref
 *   A single ref or array of refs — all are considered "inside".
 * @param {(event: MouseEvent | TouchEvent) => void} handler
 *   Called when an outside interaction is detected.
 * @param {object} [options]
 * @param {boolean} [options.enabled=true]     - Toggle the listener on/off
 * @param {boolean} [options.mousedown=true]   - Listen to mousedown
 * @param {boolean} [options.touchstart=true]  - Listen to touchstart
 * @param {boolean} [options.pointerdown=false]- Listen to pointerdown (replaces mouse+touch)
 *
 * @example
 * const ref = useRef(null);
 * useClickOutside(ref, () => setOpen(false));
 *
 * // Multiple refs (e.g. trigger + floating panel):
 * useClickOutside([triggerRef, panelRef], () => setOpen(false));
 */
export function useClickOutside(ref, handler, options = {}) {
  const {
    enabled    = true,
    mousedown  = true,
    touchstart = true,
    pointerdown = false,
  } = options;

  // Store handler in ref so the effect doesn't re-run on every render
  const handlerRef = useRef(handler);
  useEffect(() => { handlerRef.current = handler; });

  useEffect(() => {
    if (!enabled) return;

    const refs = Array.isArray(ref) ? ref : [ref];

    const listener = (event) => {
      const isInside = refs.some((r) => {
        const el = r?.current;
        return el && (el === event.target || el.contains(event.target));
      });
      if (!isInside) handlerRef.current(event);
    };

    const events = pointerdown
      ? ["pointerdown"]
      : [mousedown && "mousedown", touchstart && "touchstart"].filter(Boolean);

    events.forEach((evt) => document.addEventListener(evt, listener, { passive: true }));
    return () => events.forEach((evt) => document.removeEventListener(evt, listener));
  }, [enabled, mousedown, touchstart, pointerdown, ref]);
}

/**
 * Returns a ref and a boolean indicating whether the element is "active"
 * (no outside click has been detected since the last time it was set active).
 * Useful for building toggle components without manual state.
 *
 * @param {boolean} [initialState=false]
 * @returns {{ ref, isActive, setActive }}
 */
export function useClickOutsideToggle(initialState = false) {
  const ref = useRef(null);
  const [isActive, setActive] = useStateRef(initialState);

  useClickOutside(ref, () => { if (isActive) setActive(false); }, { enabled: isActive });

  return { ref, isActive, setActive };
}

// Tiny internal helper (not exported)
function useStateRef(initial) {
  const [state, setState_] = useStateImpl(initial);
  const stateRef = useRef(state);
  const setState = useCallback((v) => {
    const next = typeof v === "function" ? v(stateRef.current) : v;
    stateRef.current = next;
    setState_(next);
  }, []);
  return [state, setState];
}

// pull in useState without circular import issues
import { useState as useStateImpl } from "react";