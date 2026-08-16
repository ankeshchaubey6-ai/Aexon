import { useState } from "react";
import { cn } from "../../utils/cn.js";

/**
 * Rating — star rating display or interactive picker.
 *
 * @param {number}   [value=0]         - Current rating (supports half steps)
 * @param {number}   [max=5]           - Total stars
 * @param {boolean}  [readOnly=false]  - Display-only mode
 * @param {boolean}  [allowHalf=false] - Allow 0.5 increments
 * @param {function} [onChange]        - (value: number) => void
 * @param {"xs"|"sm"|"md"|"lg"|"xl"} [size="md"]
 * @param {string}   [color]           - Tailwind text color class for filled stars
 * @param {boolean}  [showValue=false] - Show numeric value beside stars
 * @param {number}   [count]           - Review count shown beside stars
 *
 * @example
 * // Display only
 * <Rating value={4.5} readOnly allowHalf showValue count={128} />
 *
 * // Interactive picker
 * <Rating value={rating} onChange={setRating} size="lg" />
 */
export function Rating({
  value      = 0,
  max        = 5,
  readOnly   = false,
  allowHalf  = false,
  onChange,
  size       = "md",
  color      = "text-amber-400",
  showValue  = false,
  count,
  className,
  ...props
}) {
  const [hovered, setHovered] = useState(null);

  const starSize = { xs:"w-3 h-3", sm:"w-4 h-4", md:"w-5 h-5", lg:"w-6 h-6", xl:"w-8 h-8" }[size] ?? "w-5 h-5";
  const gapSize  = { xs:"gap-0.5", sm:"gap-0.5", md:"gap-1", lg:"gap-1", xl:"gap-1.5" }[size] ?? "gap-1";

  const displayValue = hovered ?? value;

  const handleMouseMove = (e, i) => {
    if (readOnly) return;
    if (allowHalf) {
      const { left, width } = e.currentTarget.getBoundingClientRect();
      const x = e.clientX - left;
      setHovered(x < width / 2 ? i - 0.5 : i);
    } else {
      setHovered(i);
    }
  };

  const handleClick = (e, i) => {
    if (readOnly) return;
    let v;
    if (allowHalf) {
      const { left, width } = e.currentTarget.getBoundingClientRect();
      const x = e.clientX - left;
      v = x < width / 2 ? i - 0.5 : i;
    } else {
      v = i;
    }
    onChange?.(v === value ? 0 : v);
  };

  const getFill = (i) => {
    const d = displayValue - (i - 1);
    if (d >= 1)    return "full";
    if (d >= 0.5)  return "half";
    return "empty";
  };

  return (
    <div
      className={cn("inline-flex items-center gap-2", className)}
      onMouseLeave={() => !readOnly && setHovered(null)}
      {...props}
    >
      <div className={cn("flex items-center", gapSize)}>
        {Array.from({ length: max }, (_, i) => i + 1).map((i) => {
          const fill = getFill(i);
          return (
            <button
              key={i}
              type="button"
              disabled={readOnly}
              onMouseMove={(e) => handleMouseMove(e, i)}
              onClick={(e) => handleClick(e, i)}
              aria-label={`Rate ${i} out of ${max}`}
              className={cn(
                "relative focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded-sm",
                !readOnly && "cursor-pointer hover:scale-110 transition-transform",
                readOnly  && "cursor-default",
                starSize,
              )}
            >
              {/* Background (empty) star */}
              <svg viewBox="0 0 24 24" className={cn("absolute inset-0", starSize, "text-gray-200 dark:text-zinc-700")}>
                <path fill="currentColor" d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
              </svg>
              {/* Filled star (clipped for half) */}
              <svg
                viewBox="0 0 24 24"
                className={cn("absolute inset-0", starSize, fill !== "empty" ? color : "text-transparent")}
                style={fill === "half" ? { clipPath: "inset(0 50% 0 0)" } : undefined}
              >
                <path fill="currentColor" d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
              </svg>
            </button>
          );
        })}
      </div>

      {(showValue || count != null) && (
        <span className="text-sm text-gray-600 dark:text-zinc-400">
          {showValue && <span className="font-semibold text-gray-900 dark:text-zinc-100 mr-1">{value}</span>}
          {count != null && `(${count.toLocaleString()})`}
        </span>
      )}
    </div>
  );
}