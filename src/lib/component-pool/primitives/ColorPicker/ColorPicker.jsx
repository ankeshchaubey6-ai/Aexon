import { useState, useRef, useCallback, useId } from "react";
import { cn } from "../../utils/cn.js";
import { useClickOutside } from "../../hooks/useClickOutside.js";
import { isHexColor } from "../../utils/validators.js";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
function hexToHsl(hex) {
  let r = 0, g = 0, b = 0;
  const clean = hex.replace("#", "");
  if (clean.length === 3) {
    r = parseInt(clean[0] + clean[0], 16);
    g = parseInt(clean[1] + clean[1], 16);
    b = parseInt(clean[2] + clean[2], 16);
  } else if (clean.length === 6) {
    r = parseInt(clean.slice(0, 2), 16);
    g = parseInt(clean.slice(2, 4), 16);
    b = parseInt(clean.slice(4, 6), 16);
  }
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0, l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }
  return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
}

function hslToHex(h, s, l) {
  s /= 100; l /= 100;
  const a = s * Math.min(l, 1 - l);
  const f = (n) => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color).toString(16).padStart(2, "0");
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

const DEFAULT_PRESETS = [
  "#ef4444","#f97316","#f59e0b","#22c55e","#06b6d4",
  "#3b82f6","#8b5cf6","#ec4899","#ffffff","#6b7280","#111827",
];

/**
 * ColorPicker — a full-featured color selector.
 *
 * Features:
 * - Hue slider
 * - Saturation × Lightness 2D canvas pad
 * - Hex text input
 * - Opacity slider (optional)
 * - Preset swatches
 *
 * @param {string}   [value="#3b82f6"]   - Hex color string
 * @param {function} [onChange]           - (hex: string) => void
 * @param {string[]} [presets]            - Preset swatch colors
 * @param {boolean}  [opacity=false]      - Show opacity slider
 * @param {boolean}  [inline=false]       - Render picker without popover trigger
 * @param {string}   [label]
 *
 * @example
 * <ColorPicker
 *   label="Brand color"
 *   value={color}
 *   onChange={setColor}
 *   presets={["#3b82f6","#8b5cf6","#22c55e"]}
 * />
 *
 * // Inline (always visible)
 * <ColorPicker value={color} onChange={setColor} inline />
 */
export function ColorPicker({
  value    = "#3b82f6",
  onChange,
  presets  = DEFAULT_PRESETS,
  opacity  = false,
  inline   = false,
  label,
  className,
}) {
  const id           = useId();
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);

  useClickOutside(containerRef, () => setOpen(false), { enabled: open && !inline });

  const hsl = hexToHsl(value);

  const [hexInput, setHexInput] = useState(value);
  const [alpha, setAlpha]       = useState(100);

  const updateFromHsl = useCallback((h, s, l) => {
    const hex = hslToHex(h, s, l);
    setHexInput(hex);
    onChange?.(hex);
  }, [onChange]);

  const handleHexInput = (raw) => {
    setHexInput(raw);
    const hex = raw.startsWith("#") ? raw : `#${raw}`;
    if (isHexColor(hex)) onChange?.(hex);
  };

  // 2D saturation+lightness pad interaction
  const padRef = useRef(null);
  const handlePadInteraction = useCallback((e) => {
    const el = padRef.current;
    if (!el) return;
    const { left, top, width, height } = el.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    const s = Math.round(Math.max(0, Math.min(1, (clientX - left) / width)) * 100);
    const l = Math.round(Math.max(0, Math.min(1, 1 - (clientY - top) / height)) * 100);
    updateFromHsl(hsl.h, s, l);
  }, [hsl.h, updateFromHsl]);

  const picker = (
    <div className={cn("flex flex-col gap-3 p-4 w-64")}>
      {/* 2D pad */}
      <div
        ref={padRef}
        className="relative w-full h-36 rounded-lg cursor-crosshair select-none touch-none"
        style={{
          background: `
            linear-gradient(to top, #000, transparent),
            linear-gradient(to right, #fff, hsl(${hsl.h}, 100%, 50%))
          `,
        }}
        onMouseDown={(e) => {
          handlePadInteraction(e);
          const move = (ev) => handlePadInteraction(ev);
          const up   = () => { window.removeEventListener("mousemove", move); window.removeEventListener("mouseup", up); };
          window.addEventListener("mousemove", move);
          window.addEventListener("mouseup", up);
        }}
        onTouchStart={handlePadInteraction}
        onTouchMove={handlePadInteraction}
      >
        {/* Thumb */}
        <div
          className="absolute w-4 h-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-md pointer-events-none"
          style={{
            left:   `${hsl.s}%`,
            top:    `${100 - hsl.l}%`,
            background: value,
          }}
        />
      </div>

      {/* Hue slider */}
      <div className="flex items-center gap-2">
        <div
          className="flex-1 relative"
          style={{ background: "linear-gradient(to right,#f00,#ff0,#0f0,#0ff,#00f,#f0f,#f00)", borderRadius: 999 }}
        >
          <input
            type="range" min={0} max={359} value={hsl.h}
            onChange={(e) => updateFromHsl(Number(e.target.value), hsl.s, hsl.l)}
            className="w-full appearance-none h-3 rounded-full bg-transparent cursor-pointer
              [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4
              [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white
              [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-gray-300
              [&::-webkit-slider-thumb]:shadow-md"
            aria-label="Hue"
          />
        </div>
        {/* Current color swatch */}
        <div
          className="w-7 h-7 rounded-lg border border-gray-200 dark:border-zinc-600 shrink-0 shadow-inner"
          style={{ background: value }}
        />
      </div>

      {/* Opacity slider */}
      {opacity && (
        <div
          className="relative flex-1"
          style={{
            background: `linear-gradient(to right, transparent, ${value}),
              repeating-conic-gradient(#ccc 0% 25%, white 0% 50%) 0 0 / 8px 8px`,
            borderRadius: 999,
          }}
        >
          <input
            type="range" min={0} max={100} value={alpha}
            onChange={(e) => setAlpha(Number(e.target.value))}
            className="w-full appearance-none h-3 rounded-full bg-transparent cursor-pointer
              [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4
              [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white
              [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-gray-300
              [&::-webkit-slider-thumb]:shadow-md"
            aria-label="Opacity"
          />
        </div>
      )}

      {/* Hex input */}
      <div className="flex items-center gap-2">
        <div
          className="w-6 h-6 rounded shrink-0 border border-gray-200 dark:border-zinc-600"
          style={{ background: value }}
        />
        <input
          type="text"
          value={hexInput}
          onChange={(e) => handleHexInput(e.target.value)}
          spellCheck={false}
          maxLength={7}
          className="flex-1 h-8 px-2 text-xs font-mono rounded-lg border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-gray-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
          aria-label="Hex color value"
        />
        {opacity && (
          <input
            type="text"
            value={`${alpha}%`}
            readOnly
            className="w-12 h-8 px-2 text-xs text-center rounded-lg border border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800 text-gray-600 dark:text-zinc-400"
            aria-label="Opacity value"
          />
        )}
      </div>

      {/* Presets */}
      {presets.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {presets.map((p) => (
            <button
              key={p}
              type="button"
              title={p}
              onClick={() => { onChange?.(p); setHexInput(p); }}
              className={cn(
                "w-6 h-6 rounded-md border-2 transition-transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-blue-500",
                value === p ? "border-blue-500 scale-110" : "border-transparent",
              )}
              style={{ background: p }}
              aria-label={`Color ${p}`}
              aria-pressed={value === p}
            />
          ))}
        </div>
      )}
    </div>
  );

  if (inline) {
    return (
      <div className={cn("w-full", className)}>
        {label && <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">{label}</p>}
        <div className="inline-flex rounded-xl border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-900">
          {picker}
        </div>
      </div>
    );
  }

  return (
    <div className={cn("relative inline-block", className)} ref={containerRef}>
      {label && (
        <label htmlFor={id} className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
          {label}
        </label>
      )}
      {/* Trigger swatch */}
      <button
        id={id}
        type="button"
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2.5 h-9 px-3 rounded-lg border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 hover:border-gray-300 dark:hover:border-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <span
          className="w-5 h-5 rounded-md border border-black/10 dark:border-white/10 shrink-0"
          style={{ background: value }}
        />
        <span className="text-sm font-mono text-gray-700 dark:text-zinc-200">{value}</span>
      </button>

      {/* Popover */}
      {open && (
        <div
          role="dialog"
          aria-label="Color picker"
          className="absolute top-full left-0 mt-1.5 z-50 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-xl shadow-xl animate-in fade-in zoom-in-95 duration-150"
        >
          {picker}
        </div>
      )}
    </div>
  );
}