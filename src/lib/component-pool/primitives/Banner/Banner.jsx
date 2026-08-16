import { useState } from "react";
import { cn } from "../../utils/cn.js";

/**
 * Banner — a full-width site-level announcement strip.
 * Typically placed above the Navbar or at the very top of the page.
 * Different from Alert (which is inline, contextual).
 *
 * @param {"info"|"success"|"warning"|"danger"|"brand"|"dark"} [variant="brand"]
 * @param {boolean}          [dismissible=true]
 * @param {function}         [onDismiss]
 * @param {React.ReactNode}  [action]   - CTA link or button
 * @param {React.ReactNode}  [icon]     - Custom icon
 * @param {boolean}          [sticky=false] - position: sticky + z-index
 *
 * @example
 * <Banner
 *   variant="brand"
 *   action={<a href="/sale" className="font-bold underline ml-1">Shop now →</a>}
 *   dismissible
 * >
 *   🎉 Summer sale — 30% off all plans this week.
 * </Banner>
 */
const VARIANTS = {
  brand:   "bg-gradient-to-r from-blue-600 to-violet-600 text-white",
  info:    "bg-sky-600   text-white",
  success: "bg-emerald-600 text-white",
  warning: "bg-amber-500 text-white",
  danger:  "bg-red-600   text-white",
  dark:    "bg-gray-900  text-gray-100 dark:bg-zinc-800",
  light:   "bg-gray-100  text-gray-800 border-b border-gray-200",
};

export function Banner({
  variant     = "brand",
  dismissible = true,
  onDismiss,
  action,
  icon,
  sticky      = false,
  children,
  className,
  ...props
}) {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;

  const handleDismiss = () => { setDismissed(true); onDismiss?.(); };

  return (
    <div
      role="banner"
      className={cn(
        "relative w-full py-2.5 px-4",
        VARIANTS[variant] ?? VARIANTS.brand,
        sticky && "sticky top-0 z-30",
        className,
      )}
      {...props}
    >
      <div className="flex items-center justify-center gap-2 text-sm font-medium max-w-7xl mx-auto pr-8">
        {icon && <span className="shrink-0">{icon}</span>}
        <span className="text-center leading-snug">{children}</span>
        {action && <span className="shrink-0 ml-1">{action}</span>}
      </div>

      {dismissible && (
        <button
          type="button"
          onClick={handleDismiss}
          className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center justify-center w-7 h-7 rounded-lg opacity-70 hover:opacity-100 transition-opacity focus:outline-none focus:ring-2 focus:ring-white/50"
          aria-label="Dismiss banner"
        >
          <svg viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4">
            <path d="M3.72 3.72a.75.75 0 011.06 0L8 6.94l3.22-3.22a.75.75 0 111.06 1.06L9.06 8l3.22 3.22a.75.75 0 11-1.06 1.06L8 9.06l-3.22 3.22a.75.75 0 01-1.06-1.06L6.94 8 3.72 4.78a.75.75 0 010-1.06z"/>
          </svg>
        </button>
      )}
    </div>
  );
}