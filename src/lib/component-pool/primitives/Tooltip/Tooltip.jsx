import { useState, useRef, useCallback } from "react";
import { cn } from "../../utils/cn.js";

// ─────────────────────────────────────────────────────────────────────────────
// Placement classes
// ─────────────────────────────────────────────────────────────────────────────
const TIP_PLACEMENT = {
  top:          "bottom-full left-1/2 -translate-x-1/2 mb-2",
  "top-start":  "bottom-full left-0 mb-2",
  "top-end":    "bottom-full right-0 mb-2",
  bottom:       "top-full left-1/2 -translate-x-1/2 mt-2",
  "bottom-start":"top-full left-0 mt-2",
  "bottom-end": "top-full right-0 mt-2",
  left:         "right-full top-1/2 -translate-y-1/2 mr-2",
  right:        "left-full top-1/2 -translate-y-1/2 ml-2",
};

const ARROW_PLACEMENT = {
  top:          "top-full left-1/2 -translate-x-1/2 border-l-transparent border-r-transparent border-b-transparent border-t-gray-900 dark:border-t-zinc-700",
  "top-start":  "top-full left-3 border-l-transparent border-r-transparent border-b-transparent border-t-gray-900 dark:border-t-zinc-700",
  "top-end":    "top-full right-3 border-l-transparent border-r-transparent border-b-transparent border-t-gray-900 dark:border-t-zinc-700",
  bottom:       "bottom-full left-1/2 -translate-x-1/2 border-l-transparent border-r-transparent border-t-transparent border-b-gray-900 dark:border-b-zinc-700",
  "bottom-start":"bottom-full left-3 border-l-transparent border-r-transparent border-t-transparent border-b-gray-900 dark:border-b-zinc-700",
  "bottom-end": "bottom-full right-3 border-l-transparent border-r-transparent border-t-transparent border-b-gray-900 dark:border-b-zinc-700",
  left:         "left-full top-1/2 -translate-y-1/2 border-t-transparent border-b-transparent border-r-transparent border-l-gray-900 dark:border-l-zinc-700",
  right:        "right-full top-1/2 -translate-y-1/2 border-t-transparent border-b-transparent border-l-transparent border-r-gray-900 dark:border-r-zinc-700",
};

/**
 * Tooltip — a small floating label that appears on hover/focus.
 * Uses CSS positioning (no external library).
 *
 * @param {React.ReactNode}  children      - The element that triggers the tooltip
 * @param {React.ReactNode}  content       - Tooltip text or rich content
 * @param {"top"|"top-start"|"top-end"|"bottom"|"bottom-start"|"bottom-end"|"left"|"right"} [placement="top"]
 * @param {number}           [delay=400]   - Show delay in ms
 * @param {number}           [hideDelay=0] - Hide delay in ms
 * @param {boolean}          [arrow=true]  - Show pointer arrow
 * @param {"dark"|"light"}   [theme="dark"]
 * @param {boolean}          [disabled=false]
 * @param {number}           [maxWidth=240] - px
 *
 * @example
 * <Tooltip content="Copy to clipboard">
 *   <IconButton icon={<CopyIcon/>} label="Copy" />
 * </Tooltip>
 *
 * // Rich content tooltip
 * <Tooltip content={<div><strong>Pro tip:</strong> Press ⌘K to search</div>} theme="light">
 *   <InfoIcon className="text-gray-400"/>
 * </Tooltip>
 */
export function Tooltip({
  children,
  content,
  placement  = "top",
  delay      = 400,
  hideDelay  = 0,
  arrow      = true,
  theme      = "dark",
  disabled   = false,
  maxWidth   = 240,
  className,
}) {
  const [visible, setVisible] = useState(false);
  const showTimer = useRef(null);
  const hideTimer = useRef(null);

  const show = useCallback(() => {
    if (disabled || !content) return;
    clearTimeout(hideTimer.current);
    showTimer.current = setTimeout(() => setVisible(true), delay);
  }, [disabled, content, delay]);

  const hide = useCallback(() => {
    clearTimeout(showTimer.current);
    hideTimer.current = setTimeout(() => setVisible(false), hideDelay);
  }, [hideDelay]);

  const tipClasses = {
    dark:  "bg-gray-900 dark:bg-zinc-700 text-white",
    light: "bg-white dark:bg-zinc-800 text-gray-900 dark:text-white border border-gray-200 dark:border-zinc-700 shadow-lg",
  }[theme] ?? "bg-gray-900 text-white";

  return (
    <span
      className={cn("relative inline-flex", className)}
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
    >
      {children}

      {visible && content && (
        <span
          role="tooltip"
          className={cn(
            "absolute z-50 px-2.5 py-1.5 rounded-lg text-xs font-medium",
            "whitespace-nowrap pointer-events-none select-none",
            "animate-in fade-in zoom-in-95 duration-100",
            tipClasses,
            TIP_PLACEMENT[placement] ?? TIP_PLACEMENT.top,
          )}
          style={{ maxWidth }}
        >
          {content}
          {arrow && (
            <span
              className={cn(
                "absolute w-0 h-0 border-4",
                ARROW_PLACEMENT[placement] ?? ARROW_PLACEMENT.top,
              )}
              aria-hidden="true"
            />
          )}
        </span>
      )}
    </span>
  );
}