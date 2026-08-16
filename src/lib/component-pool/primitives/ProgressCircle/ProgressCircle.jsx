import { cn } from "../../utils/cn.js";

/**
 * ProgressCircle — SVG-based circular progress ring.
 *
 * @param {number}  value           - 0–100
 * @param {number}  [size=64]       - px diameter
 * @param {number}  [strokeWidth=6]
 * @param {"primary"|"success"|"warning"|"danger"} [color="primary"]
 * @param {boolean} [showValue=true] - Display percentage in center
 * @param {string}  [label]          - Custom center text (overrides %)
 * @param {boolean} [indeterminate=false]
 * @param {"round"|"square"|"butt"} [linecap="round"]
 *
 * @example
 * <ProgressCircle value={75} size={80} color="success" />
 * <ProgressCircle value={33} size={120} strokeWidth={8} label="33%" />
 */

const STROKE_COLORS = {
  primary: "stroke-blue-600   dark:stroke-blue-400",
  success: "stroke-emerald-500 dark:stroke-emerald-400",
  warning: "stroke-amber-500  dark:stroke-amber-400",
  danger:  "stroke-red-500    dark:stroke-red-400",
  info:    "stroke-sky-500    dark:stroke-sky-400",
};

const TEXT_COLORS = {
  primary: "fill-blue-600   dark:fill-blue-400",
  success: "fill-emerald-500 dark:fill-emerald-400",
  warning: "fill-amber-500  dark:fill-amber-400",
  danger:  "fill-red-500    dark:fill-red-400",
  info:    "fill-sky-500    dark:fill-sky-400",
};

export function ProgressCircle({
  value         = 0,
  size          = 64,
  strokeWidth   = 6,
  color         = "primary",
  showValue     = true,
  label,
  indeterminate = false,
  linecap       = "round",
  className,
  children,
  ...props
}) {
  const pct    = Math.min(Math.max(value, 0), 100);
  const radius = (size - strokeWidth) / 2;
  const circ   = 2 * Math.PI * radius;
  const offset = circ - (pct / 100) * circ;

  return (
    <div
      className={cn("relative inline-flex items-center justify-center", className)}
      style={{ width: size, height: size }}
      role="progressbar"
      aria-valuenow={indeterminate ? undefined : Math.round(pct)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label ?? `${Math.round(pct)}% complete`}
      {...props}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className={cn(indeterminate && "animate-spin")}
      >
        {/* Track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          className="stroke-gray-100 dark:stroke-zinc-800"
        />
        {/* Progress */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          strokeLinecap={linecap}
          strokeDasharray={circ}
          strokeDashoffset={indeterminate ? circ * 0.75 : offset}
          className={cn(
            "transition-[stroke-dashoffset] duration-500 ease-out",
            STROKE_COLORS[color] ?? STROKE_COLORS.primary,
          )}
          style={{ transform: "rotate(-90deg)", transformOrigin: "50% 50%" }}
        />
        {/* Center label */}
        {showValue && !children && (
          <text
            x="50%" y="50%"
            dominantBaseline="middle"
            textAnchor="middle"
            fontSize={size * 0.22}
            fontWeight={600}
            className={TEXT_COLORS[color] ?? TEXT_COLORS.primary}
          >
            {label ?? `${Math.round(pct)}%`}
          </text>
        )}
      </svg>
      {/* Custom children in center */}
      {children && (
        <div className="absolute inset-0 flex items-center justify-center">
          {children}
        </div>
      )}
    </div>
  );
}