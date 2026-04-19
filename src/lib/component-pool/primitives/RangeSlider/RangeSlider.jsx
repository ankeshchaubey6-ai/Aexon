import { useState, useRef, useCallback, useId } from "react";
import { cn } from "../../utils/cn.js";

/**
 * RangeSlider — single-thumb or dual-thumb (range) slider.
 *
 * @param {number}   [value]          - Single value (controlled)
 * @param {[number,number]} [range]   - [min, max] pair for range mode (controlled)
 * @param {number}   [defaultValue=0]
 * @param {[number,number]} [defaultRange=[0,100]]
 * @param {number}   [min=0]
 * @param {number}   [max=100]
 * @param {number}   [step=1]
 * @param {function} [onChange]       - (value: number) => void
 * @param {function} [onRangeChange]  - ([min, max]: [number, number]) => void
 * @param {boolean}  [showTooltip=true]
 * @param {boolean}  [showLabels=false]  - Min/max labels at ends
 * @param {boolean}  [showValue=false]   - Current value text above thumb
 * @param {string}   [label]
 * @param {"sm"|"md"|"lg"} [size="md"]
 * @param {string}   [color]          - Tailwind bg class for filled track
 * @param {function} [formatValue]    - (v) => string
 *
 * @example
 * // Single
 * <RangeSlider label="Volume" value={vol} onChange={setVol} showTooltip />
 *
 * // Dual range (price filter)
 * <RangeSlider
 *   label="Price range"
 *   range={[min, max]}
 *   onRangeChange={([lo, hi]) => setRange(lo, hi)}
 *   min={0} max={1000}
 *   formatValue={v => `$${v}`}
 *   showLabels
 * />
 */
export function RangeSlider({
  value,
  range,
  defaultValue    = 0,
  defaultRange    = [0, 100],
  min             = 0,
  max             = 100,
  step            = 1,
  onChange,
  onRangeChange,
  showTooltip     = true,
  showLabels      = false,
  showValue       = false,
  label,
  size            = "md",
  color           = "bg-blue-600 dark:bg-blue-500",
  formatValue     = (v) => String(v),
  disabled        = false,
  id: idProp,
  className,
}) {
  const autoId   = useId();
  const inputId  = idProp ?? autoId;
  const isRange  = range !== undefined || onRangeChange !== undefined;

  const [singleVal, setSingleVal] = useState(value ?? defaultValue);
  const [rangeVal,  setRangeVal]  = useState(range  ?? defaultRange);

  const currentSingle = value   !== undefined ? value   : singleVal;
  const currentRange  = range   !== undefined ? range   : rangeVal;

  const trackHeight = { sm: "h-1", md: "h-1.5", lg: "h-2" }[size] ?? "h-1.5";
  const thumbSize   = { sm: "w-3.5 h-3.5", md: "w-4 h-4", lg: "w-5 h-5" }[size] ?? "w-4 h-4";

  const pct = (v) => ((v - min) / (max - min)) * 100;

  const handleSingle = useCallback((e) => {
    const v = Number(e.target.value);
    if (value === undefined) setSingleVal(v);
    onChange?.(v);
  }, [value, onChange]);

  const handleRangeLow = useCallback((e) => {
    const lo = Math.min(Number(e.target.value), currentRange[1] - step);
    const next = [lo, currentRange[1]];
    if (range === undefined) setRangeVal(next);
    onRangeChange?.(next);
  }, [range, currentRange, step, onRangeChange]);

  const handleRangeHigh = useCallback((e) => {
    const hi = Math.max(Number(e.target.value), currentRange[0] + step);
    const next = [currentRange[0], hi];
    if (range === undefined) setRangeVal(next);
    onRangeChange?.(next);
  }, [range, currentRange, step, onRangeChange]);

  const sliderBase = cn(
    "absolute w-full appearance-none bg-transparent cursor-pointer",
    "focus:outline-none",
    "[&::-webkit-slider-thumb]:appearance-none",
    `[&::-webkit-slider-thumb]:${thumbSize}`,
    "[&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white",
    "[&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-blue-600",
    "[&::-webkit-slider-thumb]:shadow-md [&::-webkit-slider-thumb]:cursor-pointer",
    "[&::-webkit-slider-thumb]:transition-transform [&::-webkit-slider-thumb]:duration-100",
    "[&::-webkit-slider-thumb:hover]:scale-110",
    "dark:[&::-webkit-slider-thumb]:border-blue-400",
    disabled && "cursor-not-allowed opacity-50",
  );

  return (
    <div className={cn("w-full", className)}>
      {/* Label row */}
      {(label || showValue) && (
        <div className="flex items-center justify-between mb-3">
          {label && <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{label}</span>}
          {showValue && !isRange && (
            <span className="text-sm font-semibold text-blue-600 dark:text-blue-400 tabular-nums">
              {formatValue(currentSingle)}
            </span>
          )}
          {showValue && isRange && (
            <span className="text-sm font-semibold text-blue-600 dark:text-blue-400 tabular-nums">
              {formatValue(currentRange[0])} – {formatValue(currentRange[1])}
            </span>
          )}
        </div>
      )}

      {/* Track area */}
      <div className={cn("relative flex items-center", trackHeight, "w-full")}>
        {/* Base track */}
        <div className={cn("absolute w-full rounded-full bg-gray-200 dark:bg-zinc-700", trackHeight)} />

        {/* Filled track */}
        {!isRange ? (
          <div
            className={cn("absolute rounded-full pointer-events-none", trackHeight, color)}
            style={{ left: 0, width: `${pct(currentSingle)}%` }}
          />
        ) : (
          <div
            className={cn("absolute rounded-full pointer-events-none", trackHeight, color)}
            style={{
              left:  `${pct(currentRange[0])}%`,
              width: `${pct(currentRange[1]) - pct(currentRange[0])}%`,
            }}
          />
        )}

        {/* Single thumb */}
        {!isRange && (
          <input
            id={inputId}
            type="range"
            min={min} max={max} step={step}
            value={currentSingle}
            onChange={handleSingle}
            disabled={disabled}
            className={cn(sliderBase, "h-full")}
            aria-valuenow={currentSingle}
            aria-valuemin={min}
            aria-valuemax={max}
          />
        )}

        {/* Range — low thumb */}
        {isRange && (
          <>
            <input
              type="range"
              min={min} max={max} step={step}
              value={currentRange[0]}
              onChange={handleRangeLow}
              disabled={disabled}
              className={cn(sliderBase, "h-full")}
              aria-label="Minimum value"
              aria-valuenow={currentRange[0]}
            />
            <input
              type="range"
              min={min} max={max} step={step}
              value={currentRange[1]}
              onChange={handleRangeHigh}
              disabled={disabled}
              className={cn(sliderBase, "h-full")}
              aria-label="Maximum value"
              aria-valuenow={currentRange[1]}
            />
          </>
        )}
      </div>

      {/* End labels */}
      {showLabels && (
        <div className="flex justify-between mt-1.5">
          <span className="text-xs text-gray-400 dark:text-zinc-500">{formatValue(min)}</span>
          <span className="text-xs text-gray-400 dark:text-zinc-500">{formatValue(max)}</span>
        </div>
      )}
    </div>
  );
}