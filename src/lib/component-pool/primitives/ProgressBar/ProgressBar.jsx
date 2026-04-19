import { cn } from "../../utils/cn.js";

/**
 * ProgressBar — animated horizontal progress indicator.
 *
 * @param {number}  value           - 0–100
 * @param {number}  [max=100]
 * @param {"xs"|"sm"|"md"|"lg"|"xl"} [size="md"]
 * @param {"primary"|"success"|"warning"|"danger"|"gradient"} [color="primary"]
 * @param {boolean} [striped=false]  - CSS striped pattern
 * @param {boolean} [animated=false] - Animate stripes (loading-state)
 * @param {boolean} [showLabel=false]- Show percentage inside/beside bar
 * @param {"inside"|"right"|"top"}  [labelPosition="right"]
 * @param {string}  [label]          - Custom label text
 * @param {boolean} [indeterminate=false] - Infinite animation (unknown progress)
 *
 * @example
 * <ProgressBar value={75} color="primary" showLabel />
 * <ProgressBar value={45} color="success" size="sm" label="Upload: 45%" />
 * <ProgressBar indeterminate size="xs" color="primary" />
 */

const HEIGHTS = {
  xs: "h-1",
  sm: "h-1.5",
  md: "h-2.5",
  lg: "h-4",
  xl: "h-6",
};

const COLORS = {
  primary:  "bg-blue-600   dark:bg-blue-500",
  success:  "bg-emerald-500 dark:bg-emerald-400",
  warning:  "bg-amber-500  dark:bg-amber-400",
  danger:   "bg-red-500    dark:bg-red-400",
  info:     "bg-sky-500    dark:bg-sky-400",
  gradient: "bg-gradient-to-r from-blue-500 to-violet-500",
};

export function ProgressBar({
  value          = 0,
  max            = 100,
  size           = "md",
  color          = "primary",
  striped        = false,
  animated       = false,
  showLabel      = false,
  labelPosition  = "right",
  label,
  indeterminate  = false,
  radius         = "full",
  className,
  trackClassName,
  ...props
}) {
  const pct  = Math.min(Math.max((value / max) * 100, 0), 100);
  const text = label ?? `${Math.round(pct)}%`;

  const radiusClass = {
    none: "rounded-none",
    sm:   "rounded",
    full: "rounded-full",
  }[radius] ?? "rounded-full";

  const barEl = (
    <div className={cn("w-full overflow-hidden bg-gray-100 dark:bg-zinc-800", radiusClass, HEIGHTS[size] ?? HEIGHTS.md, trackClassName)}>
      <div
        role="progressbar"
        aria-valuenow={indeterminate ? undefined : Math.round(pct)}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-label={label ?? `${Math.round(pct)}% complete`}
        className={cn(
          "h-full transition-all duration-500 ease-out",
          radiusClass,
          COLORS[color] ?? COLORS.primary,
          striped && [
            "bg-stripes",
            "bg-[length:1rem_1rem]",
            "[background-image:linear-gradient(45deg,rgba(255,255,255,.15)_25%,transparent_25%,transparent_50%,rgba(255,255,255,.15)_50%,rgba(255,255,255,.15)_75%,transparent_75%,transparent)]",
          ],
          animated && "animate-[progress-stripes_1s_linear_infinite]",
          indeterminate && "w-1/3 animate-[indeterminate_1.5s_ease-in-out_infinite]",
        )}
        style={!indeterminate ? { width: `${pct}%` } : undefined}
      />
      <style>{`
        @keyframes progress-stripes { 0%{background-position:1rem 0} 100%{background-position:0 0} }
        @keyframes indeterminate    { 0%{transform:translateX(-100%)} 100%{transform:translateX(400%)} }
      `}</style>
    </div>
  );

  if (!showLabel && !label) return <div className={cn("w-full", className)} {...props}>{barEl}</div>;

  return (
    <div className={cn("w-full", className)} {...props}>
      {labelPosition === "top" && (
        <div className="flex justify-between mb-1">
          <span className="text-xs font-medium text-gray-600 dark:text-zinc-400">{label ?? "Progress"}</span>
          <span className="text-xs font-semibold text-gray-800 dark:text-zinc-200">{text}</span>
        </div>
      )}
      <div className={cn("flex items-center gap-3", labelPosition === "right" && "")}>
        <div className="flex-1">{barEl}</div>
        {labelPosition === "right" && (
          <span className="shrink-0 text-xs font-semibold text-gray-700 dark:text-zinc-300 tabular-nums w-10 text-right">
            {text}
          </span>
        )}
      </div>
    </div>
  );
}

/**
 * StackedBar — a multi-segment progress bar (e.g. disk usage by category).
 *
 * @param {{ label: string, value: number, color?: string }[]} segments
 * @param {"sm"|"md"|"lg"} [size="md"]
 * @param {boolean} [showLegend=true]
 *
 * @example
 * <StackedBar segments={[
 *   { label: "Images",    value: 40, color: "bg-blue-500"   },
 *   { label: "Videos",    value: 30, color: "bg-violet-500" },
 *   { label: "Documents", value: 20, color: "bg-emerald-500"},
 * ]} />
 */
export function StackedBar({ segments = [], size = "md", showLegend = true, className }) {
  const total = segments.reduce((s, seg) => s + seg.value, 0) || 1;

  return (
    <div className={cn("w-full", className)}>
      <div className={cn("flex w-full overflow-hidden rounded-full", HEIGHTS[size] ?? HEIGHTS.md)}>
        {segments.map((seg, i) => (
          <div
            key={i}
            title={`${seg.label}: ${seg.value}`}
            className={cn("h-full transition-all duration-500", seg.color ?? "bg-blue-500")}
            style={{ width: `${(seg.value / total) * 100}%` }}
          />
        ))}
      </div>
      {showLegend && (
        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
          {segments.map((seg, i) => (
            <div key={i} className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-zinc-400">
              <span className={cn("inline-block w-2.5 h-2.5 rounded-full", seg.color ?? "bg-blue-500")} />
              {seg.label} ({Math.round((seg.value / total) * 100)}%)
            </div>
          ))}
        </div>
      )}
    </div>
  );
}