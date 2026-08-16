import { useState } from "react";
import { cn } from "../../utils/cn.js";

// ─────────────────────────────────────────────────────────────────────────────
// Variant map
// ─────────────────────────────────────────────────────────────────────────────
const VARIANTS = {
  info: {
    wrapper: "bg-sky-50    border-sky-200    dark:bg-sky-950    dark:border-sky-800",
    icon:    "text-sky-600  dark:text-sky-400",
    title:   "text-sky-900  dark:text-sky-100",
    body:    "text-sky-800  dark:text-sky-200",
    dismiss: "text-sky-500  hover:text-sky-700  dark:text-sky-400  dark:hover:text-sky-200",
    svg: (
      <path d="M12 2a10 10 0 110 20A10 10 0 0112 2zm0 4a1 1 0 100 2 1 1 0 000-2zm-1 4v6h2v-6h-2z"/>
    ),
  },
  success: {
    wrapper: "bg-emerald-50  border-emerald-200  dark:bg-emerald-950  dark:border-emerald-800",
    icon:    "text-emerald-600 dark:text-emerald-400",
    title:   "text-emerald-900 dark:text-emerald-100",
    body:    "text-emerald-800 dark:text-emerald-200",
    dismiss: "text-emerald-500 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-200",
    svg: (
      <path d="M12 2a10 10 0 110 20A10 10 0 0112 2zm-1.5 13.5l-3-3 1.4-1.4 1.6 1.6 4.6-4.6 1.4 1.4-6 6z"/>
    ),
  },
  warning: {
    wrapper: "bg-amber-50  border-amber-200  dark:bg-amber-950  dark:border-amber-800",
    icon:    "text-amber-600 dark:text-amber-400",
    title:   "text-amber-900 dark:text-amber-100",
    body:    "text-amber-800 dark:text-amber-200",
    dismiss: "text-amber-500 hover:text-amber-700 dark:text-amber-400 dark:hover:text-amber-200",
    svg: (
      <path d="M12 2L1 21h22L12 2zm0 3.5L21 19H3L12 5.5zM11 10v4h2v-4h-2zm0 6v2h2v-2h-2z"/>
    ),
  },
  danger: {
    wrapper: "bg-red-50   border-red-200   dark:bg-red-950   dark:border-red-800",
    icon:    "text-red-600  dark:text-red-400",
    title:   "text-red-900  dark:text-red-100",
    body:    "text-red-800  dark:text-red-200",
    dismiss: "text-red-500  hover:text-red-700  dark:text-red-400  dark:hover:text-red-200",
    svg: (
      <path d="M12 2a10 10 0 110 20A10 10 0 0112 2zm-1 5v6h2V7h-2zm0 8v2h2v-2h-2z"/>
    ),
  },
  default: {
    wrapper: "bg-gray-50  border-gray-200  dark:bg-zinc-900  dark:border-zinc-700",
    icon:    "text-gray-500 dark:text-zinc-400",
    title:   "text-gray-900 dark:text-zinc-100",
    body:    "text-gray-700 dark:text-zinc-300",
    dismiss: "text-gray-400 hover:text-gray-600 dark:text-zinc-500 dark:hover:text-zinc-300",
    svg: (
      <path d="M12 2a10 10 0 110 20A10 10 0 0112 2zm0 4a1 1 0 100 2 1 1 0 000-2zm-1 4v6h2v-6h-2z"/>
    ),
  },
};

/**
 * Alert — inline status message for forms, pages, and panels.
 *
 * @param {"info"|"success"|"warning"|"danger"|"default"} [variant="info"]
 * @param {string}          [title]
 * @param {string}          [className]
 * @param {boolean}         [dismissible=false]
 * @param {function}        [onDismiss]        - Called when × clicked; if not provided, component auto-hides
 * @param {React.ReactNode} [action]           - Optional action button/link
 * @param {"sm"|"md"}       [size="md"]
 * @param {boolean}         [bordered=true]    - Show left accent border
 *
 * @example
 * <Alert variant="success" title="Payment successful">
 *   Your order has been confirmed. Check your email for details.
 * </Alert>
 *
 * <Alert variant="warning" dismissible action={<a href="/upgrade">Upgrade →</a>}>
 *   You are approaching your API rate limit.
 * </Alert>
 */
export function Alert({
  variant    = "info",
  title,
  children,
  dismissible = false,
  onDismiss,
  action,
  size       = "md",
  bordered   = true,
  className,
  ...props
}) {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  const v = VARIANTS[variant] ?? VARIANTS.info;

  const handleDismiss = () => {
    setDismissed(true);
    onDismiss?.();
  };

  const iconSize = size === "sm" ? "w-4 h-4" : "w-5 h-5";

  return (
    <div
      role="alert"
      className={cn(
        "flex items-start gap-3 rounded-xl border p-4",
        bordered && "border-l-4",
        v.wrapper,
        size === "sm" && "p-3",
        className,
      )}
      {...props}
    >
      {/* Icon */}
      <svg viewBox="0 0 24 24" fill="currentColor" className={cn("shrink-0 mt-0.5", iconSize, v.icon)}>
        {v.svg}
      </svg>

      {/* Body */}
      <div className="flex-1 min-w-0">
        {title && (
          <p className={cn("font-semibold leading-tight", size === "sm" ? "text-xs" : "text-sm", v.title)}>
            {title}
          </p>
        )}
        {children && (
          <p className={cn("leading-relaxed", size === "sm" ? "text-xs mt-0.5" : "text-sm", title && "mt-1", v.body)}>
            {children}
          </p>
        )}
        {action && (
          <div className="mt-2">{action}</div>
        )}
      </div>

      {/* Dismiss */}
      {dismissible && (
        <button
          type="button"
          onClick={handleDismiss}
          className={cn("shrink-0 flex items-center justify-center w-5 h-5 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors", v.dismiss)}
          aria-label="Dismiss"
        >
          <svg viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5">
            <path d="M3.72 3.72a.75.75 0 011.06 0L8 6.94l3.22-3.22a.75.75 0 111.06 1.06L9.06 8l3.22 3.22a.75.75 0 11-1.06 1.06L8 9.06l-3.22 3.22a.75.75 0 01-1.06-1.06L6.94 8 3.72 4.78a.75.75 0 010-1.06z"/>
          </svg>
        </button>
      )}
    </div>
  );
}