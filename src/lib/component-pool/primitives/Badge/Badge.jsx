import { cn } from "../../utils/cn.js";

// ─────────────────────────────────────────────────────────────────────────────
// Variant map — background + text + border for every semantic state
// ─────────────────────────────────────────────────────────────────────────────
const VARIANTS = {
  default:  "bg-gray-100  text-gray-700  dark:bg-zinc-800  dark:text-zinc-300",
  primary:  "bg-blue-100  text-blue-700  dark:bg-blue-900  dark:text-blue-300",
  secondary:"bg-violet-100 text-violet-700 dark:bg-violet-900 dark:text-violet-300",
  success:  "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300",
  warning:  "bg-amber-100 text-amber-700  dark:bg-amber-900  dark:text-amber-300",
  danger:   "bg-red-100   text-red-700    dark:bg-red-900    dark:text-red-300",
  info:     "bg-sky-100   text-sky-700    dark:bg-sky-900    dark:text-sky-300",
  pink:     "bg-pink-100  text-pink-700   dark:bg-pink-900   dark:text-pink-300",
  orange:   "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300",
  // Solid (opaque, high contrast — good for CTA badges)
  "solid-primary": "bg-blue-600   text-white",
  "solid-success": "bg-emerald-600 text-white",
  "solid-danger":  "bg-red-600    text-white",
  "solid-warning": "bg-amber-500  text-white",
  "solid-dark":    "bg-gray-900   text-white  dark:bg-zinc-100 dark:text-zinc-900",
  // Outline
  "outline-primary": "border border-blue-400   text-blue-700  dark:text-blue-400  bg-transparent",
  "outline-success": "border border-emerald-400 text-emerald-700 dark:text-emerald-400 bg-transparent",
  "outline-danger":  "border border-red-400    text-red-700   dark:text-red-400   bg-transparent",
  "outline-default": "border border-gray-300   text-gray-700  dark:border-zinc-600 dark:text-zinc-400 bg-transparent",
};

// Dot colors that match each variant
const DOT_COLORS = {
  default:  "bg-gray-500",
  primary:  "bg-blue-600  dark:bg-blue-400",
  secondary:"bg-violet-600 dark:bg-violet-400",
  success:  "bg-emerald-600 dark:bg-emerald-400",
  warning:  "bg-amber-500  dark:bg-amber-400",
  danger:   "bg-red-600   dark:bg-red-400",
  info:     "bg-sky-500   dark:bg-sky-400",
  pink:     "bg-pink-600  dark:bg-pink-400",
  orange:   "bg-orange-500 dark:bg-orange-400",
};

const SIZES = {
  xs: "px-1.5 py-0.5 text-[10px] leading-4 gap-0.5",
  sm: "px-2   py-0.5 text-xs     leading-4 gap-1",
  md: "px-2.5 py-1   text-xs     leading-4 gap-1.5",
  lg: "px-3   py-1   text-sm     leading-5 gap-1.5",
};

const RADIUS = {
  full: "rounded-full",
  md:   "rounded-md",
  sm:   "rounded",
  none: "rounded-none",
};

/**
 * Badge — status label, count, category tag.
 *
 * @param {"default"|"primary"|"secondary"|"success"|"warning"|"danger"|"info"|"pink"|"orange"|"solid-primary"|"solid-success"|"solid-danger"|"solid-warning"|"solid-dark"|"outline-primary"|"outline-success"|"outline-danger"|"outline-default"} [variant="default"]
 * @param {"xs"|"sm"|"md"|"lg"} [size="sm"]
 * @param {"full"|"md"|"sm"|"none"} [radius="full"]
 * @param {boolean}          [dot=false]     - Colored dot indicator
 * @param {boolean}          [pulseDot=false]- Animated pulsing dot (live status)
 * @param {React.ReactNode}  [leftIcon]
 * @param {React.ReactNode}  [rightIcon]
 * @param {function}         [onDismiss]     - Shows × button when provided
 *
 * @example
 * <Badge variant="success" dot>Active</Badge>
 * <Badge variant="solid-primary" size="md">New</Badge>
 * <Badge variant="warning" pulseDot>Live</Badge>
 * <Badge variant="default" onDismiss={() => removeTag(tag)}>{tag}</Badge>
 */
export function Badge({
  variant    = "default",
  size       = "sm",
  radius     = "full",
  dot        = false,
  pulseDot   = false,
  leftIcon,
  rightIcon,
  onDismiss,
  children,
  className,
  ...props
}) {
  const showDot = dot || pulseDot;
  const dotColor = DOT_COLORS[variant] ?? DOT_COLORS.default;

  return (
    <span
      className={cn(
        "inline-flex items-center font-medium",
        VARIANTS[variant] ?? VARIANTS.default,
        SIZES[size]       ?? SIZES.sm,
        RADIUS[radius]    ?? RADIUS.full,
        className
      )}
      {...props}
    >
      {/* Dot indicator */}
      {showDot && (
        <span className="relative flex shrink-0 items-center justify-center">
          {pulseDot && (
            <span className={cn("absolute inline-flex h-full w-full rounded-full opacity-75 animate-ping", dotColor)} />
          )}
          <span className={cn("relative inline-block rounded-full w-1.5 h-1.5", dotColor)} />
        </span>
      )}

      {/* Left icon */}
      {leftIcon && <span className="shrink-0 -ml-0.5">{leftIcon}</span>}

      {/* Content */}
      {children}

      {/* Right icon */}
      {rightIcon && <span className="shrink-0 -mr-0.5">{rightIcon}</span>}

      {/* Dismiss button */}
      {onDismiss && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onDismiss(); }}
          className="shrink-0 -mr-0.5 rounded-full hover:opacity-75 focus:outline-none focus:ring-1 focus:ring-current"
          aria-label="Remove"
        >
          <svg viewBox="0 0 12 12" fill="currentColor" className="w-3 h-3">
            <path d="M6 4.94L9.47 1.47l1.06 1.06L7.06 6l3.47 3.47-1.06 1.06L6 7.06 2.53 10.53 1.47 9.47 4.94 6 1.47 2.53 2.53 1.47 6 4.94z"/>
          </svg>
        </button>
      )}
    </span>
  );
}

/**
 * CountBadge — numeric count, automatically abbreviates large numbers.
 * Commonly used on nav items, notification bells, cart icons.
 *
 * @param {number}  count
 * @param {number}  [max=99]      - Numbers above this show as "99+"
 * @param {"xs"|"sm"|"md"} [size="xs"]
 *
 * @example
 * <div className="relative">
 *   <BellIcon />
 *   <CountBadge count={unreadCount} className="absolute -top-1 -right-1" />
 * </div>
 */
export function CountBadge({ count, max = 99, size = "xs", className, ...props }) {
  if (!count || count < 1) return null;
  const display = count > max ? `${max}+` : String(count);

  return (
    <Badge
      variant="solid-danger"
      size={size}
      radius="full"
      className={cn("min-w-[1.25rem] justify-center tabular-nums", className)}
      {...props}
    >
      {display}
    </Badge>
  );
}