import { useState, useCallback, useRef } from "react";

/**
 * Boolean state toggle with stable open/close/toggle actions.
 *
 * @param {boolean} [initialValue=false]
 * @returns {[boolean, { toggle, open, close, set }]}
 *
 * @example
 * const [isOpen, { toggle, open, close }] = useToggle(false);
 *
 * <button onClick={toggle}>Menu</button>
 * <button onClick={close}>Close</button>
 * <button onClick={open}>Open</button>
 * <Modal open={isOpen} onClose={close} />
 */
export function useToggle(initialValue = false) {
  const [on, setOn] = useState(initialValue);

  const toggle = useCallback(() => setOn(v => !v), []);
  const open   = useCallback(() => setOn(true),    []);
  const close  = useCallback(() => setOn(false),   []);
  const set    = setOn;

  return [on, { toggle, open, close, set }];
}

/**
 * Manage a set of toggleable IDs (e.g. accordion items, selected rows).
 * Two modes: "single" (only one at a time) or "multi" (multiple simultaneously).
 *
 * @param {object} [options]
 * @param {"single"|"multi"} [options.mode="single"]
 * @param {string|string[]}  [options.initialOpen=[]]
 *
 * @returns {{
 *   openIds:  string[],
 *   isOpen:   (id: string) => boolean,
 *   toggle:   (id: string) => void,
 *   open:     (id: string) => void,
 *   close:    (id: string) => void,
 *   closeAll: () => void,
 *   openAll:  (ids: string[]) => void,
 * }}
 *
 * @example
 * // Accordion — single mode
 * const accordion = useToggleGroup({ mode: "single" });
 * items.map(item => (
 *   <div key={item.id}>
 *     <button onClick={() => accordion.toggle(item.id)}>{item.title}</button>
 *     {accordion.isOpen(item.id) && <div>{item.content}</div>}
 *   </div>
 * ))
 *
 * // Multi-select rows
 * const selection = useToggleGroup({ mode: "multi" });
 */
export function useToggleGroup(options = {}) {
  const { mode = "single", initialOpen = [] } = options;

  const [openIds, setOpenIds] = useState(() => {
    const initial = Array.isArray(initialOpen) ? initialOpen : [initialOpen];
    return mode === "single" ? initial.slice(0, 1) : initial;
  });

  const isOpen = useCallback((id) => openIds.includes(id), [openIds]);

  const toggle = useCallback((id) => {
    setOpenIds(prev => {
      const isCurrentlyOpen = prev.includes(id);
      if (mode === "single") {
        return isCurrentlyOpen ? [] : [id];
      }
      return isCurrentlyOpen ? prev.filter(x => x !== id) : [...prev, id];
    });
  }, [mode]);

  const open = useCallback((id) => {
    setOpenIds(prev => {
      if (prev.includes(id)) return prev;
      return mode === "single" ? [id] : [...prev, id];
    });
  }, [mode]);

  const close = useCallback((id) => {
    setOpenIds(prev => prev.filter(x => x !== id));
  }, []);

  const closeAll = useCallback(() => setOpenIds([]), []);

  const openAll = useCallback((ids) => {
    setOpenIds(mode === "single" ? ids.slice(0, 1) : ids);
  }, [mode]);

  return { openIds, isOpen, toggle, open, close, closeAll, openAll };
}

/**
 * Manage a counter (increment / decrement / reset).
 *
 * @param {number} [initial=0]
 * @param {object} [options]
 * @param {number} [options.min]  - Minimum value
 * @param {number} [options.max]  - Maximum value
 * @param {number} [options.step=1]
 *
 * @returns {{ count, increment, decrement, reset, set }}
 *
 * @example
 * const { count, increment, decrement } = useCounter(0, { min: 0, max: 10 });
 */
export function useCounter(initial = 0, options = {}) {
  const { min = -Infinity, max = Infinity, step = 1 } = options;
  const [count, setCount] = useState(Math.min(Math.max(initial, min), max));

  const increment = useCallback(() => setCount(c => Math.min(c + step, max)), [step, max]);
  const decrement = useCallback(() => setCount(c => Math.max(c - step, min)), [step, min]);
  const reset     = useCallback(() => setCount(initial), [initial]);
  const set       = useCallback((v) => setCount(Math.min(Math.max(v, min), max)), [min, max]);

  return { count, increment, decrement, reset, set };
}