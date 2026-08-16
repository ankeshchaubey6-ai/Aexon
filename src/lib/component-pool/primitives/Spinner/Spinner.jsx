import { cn } from "../../utils/cn.js";

const SIZES = {
  "2xs": "w-3 h-3",
  xs:    "w-3.5 h-3.5",
  sm:    "w-4 h-4",
  md:    "w-6 h-6",
  lg:    "w-8 h-8",
  xl:    "w-10 h-10",
  "2xl": "w-14 h-14",
};

const TRACK_COLORS = {
  primary: "text-blue-600",
  white:   "text-white",
  gray:    "text-gray-400 dark:text-zinc-500",
  inherit: "text-current",
};

/**
 * Spinner — circular loading indicator.
 *
 * @param {"2xs"|"xs"|"sm"|"md"|"lg"|"xl"|"2xl"} [size="md"]
 * @param {"primary"|"white"|"gray"|"inherit"}    [color="primary"]
 * @param {string} [label="Loading"]  - Screen-reader text
 * @param {number} [strokeWidth=4]
 *
 * @example
 * <Spinner size="md" color="primary" />
 * <Spinner size="sm" color="white" />   // on dark buttons
 *
 * // Full-screen overlay
 * <div className="flex items-center justify-center min-h-screen">
 *   <Spinner size="xl" />
 * </div>
 */
export function Spinner({
  size        = "md",
  color       = "primary",
  label       = "Loading",
  strokeWidth = 4,
  className,
  ...props
}) {
  return (
    <svg
      className={cn(
        "animate-spin",
        SIZES[size]        ?? SIZES.md,
        TRACK_COLORS[color]?? TRACK_COLORS.primary,
        className,
      )}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      role="status"
      aria-label={label}
      {...props}
    >
      <circle
        cx="12" cy="12" r="10"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        className="opacity-20"
      />
      <path
        fill="currentColor"
        className="opacity-80"
        d={`M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z`}
      />
    </svg>
  );
}

/**
 * SpinnerOverlay — a full-panel loading overlay.
 * Drop inside any relative-positioned container.
 *
 * @param {boolean} [show=true]
 * @param {string}  [label]
 *
 * @example
 * <div className="relative min-h-[200px]">
 *   <SpinnerOverlay show={isLoading} label="Fetching data…" />
 *   {data && <DataTable rows={data} />}
 * </div>
 */
export function SpinnerOverlay({ show = true, label, className }) {
  if (!show) return null;
  return (
    <div
      className={cn(
        "absolute inset-0 z-10 flex flex-col items-center justify-center gap-3",
        "bg-white/70 dark:bg-zinc-900/70 backdrop-blur-sm rounded-inherit",
        className,
      )}
      role="status"
      aria-live="polite"
    >
      <Spinner size="lg" />
      {label && <p className="text-sm text-gray-600 dark:text-zinc-300 font-medium">{label}</p>}
    </div>
  );
}