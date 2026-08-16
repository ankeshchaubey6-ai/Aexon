import { cn } from "../../utils/cn.js";

/**
 * Loader — a collection of loading animation styles beyond the basic spinner.
 * Use when you want more visual variety in loading states.
 *
 * @param {"spinner"|"dots"|"bars"|"pulse"|"ring"|"bounce"|"ellipsis"} [type="spinner"]
 * @param {"xs"|"sm"|"md"|"lg"|"xl"} [size="md"]
 * @param {"primary"|"white"|"gray"} [color="primary"]
 * @param {string} [label="Loading"]
 *
 * @example
 * <Loader type="dots" size="md" color="primary" />
 * <Loader type="bars" size="lg" color="white" />
 * <Loader type="pulse" />
 */

const COLOR_MAP = {
  primary: "bg-blue-600  dark:bg-blue-400",
  white:   "bg-white",
  gray:    "bg-gray-400  dark:bg-zinc-500",
};

const COLOR_RING = {
  primary: "border-blue-600  dark:border-blue-400",
  white:   "border-white",
  gray:    "border-gray-400  dark:border-zinc-500",
};

const COLOR_TEXT = {
  primary: "text-blue-600 dark:text-blue-400",
  white:   "text-white",
  gray:    "text-gray-400 dark:text-zinc-500",
};

// ── Size scale ────────────────────────────────────────────────────────────────
const SIZE = {
  xs: { box: 12, dot: 4,  bar: { w: 3,  h: 12 }, ring: 14, stroke: 2 },
  sm: { box: 16, dot: 5,  bar: { w: 3,  h: 16 }, ring: 18, stroke: 2 },
  md: { box: 24, dot: 6,  bar: { w: 4,  h: 20 }, ring: 24, stroke: 3 },
  lg: { box: 32, dot: 8,  bar: { w: 5,  h: 28 }, ring: 32, stroke: 3 },
  xl: { box: 48, dot: 10, bar: { w: 6,  h: 36 }, ring: 48, stroke: 4 },
};

// ── Individual loader variants ─────────────────────────────────────────────────

/** Classic rotating spinner (SVG-based, crispest option) */
function SpinnerLoader({ size = "md", color = "primary" }) {
  const s = SIZE[size] ?? SIZE.md;
  const c = COLOR_TEXT[color] ?? COLOR_TEXT.primary;
  return (
    <svg
      width={s.ring} height={s.ring}
      viewBox="0 0 24 24" fill="none"
      className={cn("animate-spin", c)}
      role="status" aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth={s.stroke} className="opacity-20" />
      <path fill="currentColor" className="opacity-80" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

/** Three bouncing dots — great for chat / message UIs */
function DotsLoader({ size = "md", color = "primary" }) {
  const s   = SIZE[size] ?? SIZE.md;
  const dot = s.dot;
  const c   = COLOR_MAP[color] ?? COLOR_MAP.primary;
  return (
    <span className="inline-flex items-center gap-1" role="status" aria-hidden="true">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className={cn("rounded-full", c)}
          style={{
            width: dot, height: dot,
            animation: `dots-bounce 1.2s ease-in-out ${i * 0.2}s infinite`,
          }}
        />
      ))}
      <style>{`
        @keyframes dots-bounce {
          0%, 80%, 100% { transform: scale(0.6); opacity: 0.5; }
          40%            { transform: scale(1.0); opacity: 1;   }
        }
      `}</style>
    </span>
  );
}

/** Animated vertical bars — music-equaliser style */
function BarsLoader({ size = "md", color = "primary" }) {
  const s = SIZE[size] ?? SIZE.md;
  const c = COLOR_MAP[color] ?? COLOR_MAP.primary;
  const delays = [0, 0.15, 0.3, 0.45];
  return (
    <span className="inline-flex items-end gap-0.5" role="status" aria-hidden="true">
      {delays.map((delay, i) => (
        <span
          key={i}
          className={cn("rounded-sm", c)}
          style={{
            width: s.bar.w,
            height: s.bar.h,
            animation: `bars-grow 1s ease-in-out ${delay}s infinite`,
          }}
        />
      ))}
      <style>{`
        @keyframes bars-grow {
          0%, 100% { transform: scaleY(0.35); }
          50%       { transform: scaleY(1.0);  }
        }
      `}</style>
    </span>
  );
}

/** Expanding ring pulse */
function PulseLoader({ size = "md", color = "primary" }) {
  const s = SIZE[size] ?? SIZE.md;
  const c = COLOR_MAP[color] ?? COLOR_MAP.primary;
  return (
    <span
      className={cn("inline-block rounded-full", c)}
      style={{
        width: s.box, height: s.box,
        animation: "pulse-ring 1.2s cubic-bezier(0.455,0.03,0.515,0.955) infinite",
      }}
      role="status" aria-hidden="true"
    >
      <style>{`
        @keyframes pulse-ring {
          0%   { transform: scale(0.85); opacity: 1;   }
          70%  { transform: scale(1.0);  opacity: 0.6; }
          100% { transform: scale(0.85); opacity: 1;   }
        }
      `}</style>
    </span>
  );
}

/** Hollow rotating ring — thinner than the spinner */
function RingLoader({ size = "md", color = "primary" }) {
  const s = SIZE[size] ?? SIZE.md;
  const c = COLOR_RING[color] ?? COLOR_RING.primary;
  return (
    <span
      className={cn("inline-block rounded-full border-2 border-t-transparent animate-spin", c)}
      style={{ width: s.ring, height: s.ring, borderWidth: s.stroke }}
      role="status" aria-hidden="true"
    />
  );
}

/** Three staggered-bounce balls */
function BounceLoader({ size = "md", color = "primary" }) {
  const s = SIZE[size] ?? SIZE.md;
  const c = COLOR_MAP[color] ?? COLOR_MAP.primary;
  return (
    <span className="inline-flex items-center gap-1" role="status" aria-hidden="true">
      {[0, 0.2, 0.4].map((delay, i) => (
        <span
          key={i}
          className={cn("rounded-full", c)}
          style={{
            width: s.dot, height: s.dot,
            animation: `bounce-load 0.8s ease-in-out ${delay}s infinite alternate`,
          }}
        />
      ))}
      <style>{`
        @keyframes bounce-load {
          from { transform: translateY(0);       }
          to   { transform: translateY(-${(SIZE[size] ?? SIZE.md).dot * 1.5}px); }
        }
      `}</style>
    </span>
  );
}

/** Expanding + contracting ellipsis (text-loading feel) */
function EllipsisLoader({ size = "md", color = "primary" }) {
  const s = SIZE[size] ?? SIZE.md;
  const c = COLOR_MAP[color] ?? COLOR_MAP.primary;
  return (
    <span className="inline-flex items-center gap-0.5" role="status" aria-hidden="true">
      {[0, 0.25, 0.5].map((delay, i) => (
        <span
          key={i}
          className={cn("rounded-full", c)}
          style={{
            width: s.dot * 0.6, height: s.dot * 0.6,
            animation: `ellipsis-fade 1s ease-in-out ${delay}s infinite`,
          }}
        />
      ))}
      <style>{`
        @keyframes ellipsis-fade {
          0%, 100% { opacity: 0.3; transform: scale(0.75); }
          50%       { opacity: 1;   transform: scale(1.0);  }
        }
      `}</style>
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Loader component — delegates to the correct variant
// ─────────────────────────────────────────────────────────────────────────────
export function Loader({
  type     = "spinner",
  size     = "md",
  color    = "primary",
  label    = "Loading",
  className,
  ...props
}) {
  const loaderMap = {
    spinner:   <SpinnerLoader  size={size} color={color} />,
    dots:      <DotsLoader     size={size} color={color} />,
    bars:      <BarsLoader     size={size} color={color} />,
    pulse:     <PulseLoader    size={size} color={color} />,
    ring:      <RingLoader     size={size} color={color} />,
    bounce:    <BounceLoader   size={size} color={color} />,
    ellipsis:  <EllipsisLoader size={size} color={color} />,
  };

  return (
    <span
      role="status"
      aria-label={label}
      className={cn("inline-flex items-center justify-center", className)}
      {...props}
    >
      {loaderMap[type] ?? loaderMap.spinner}
      <span className="sr-only">{label}</span>
    </span>
  );
}

/**
 * LoaderPage — a full-page or full-panel centered loading state.
 *
 * @param {string}  [message]
 * @param {"spinner"|"dots"|"bars"|"ring"} [type="spinner"]
 * @param {boolean} [fullScreen=false]
 *
 * @example
 * if (isLoading) return <LoaderPage message="Fetching your workspace…" />;
 */
export function LoaderPage({
  message,
  type       = "spinner",
  fullScreen = false,
  className,
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-4",
        fullScreen ? "fixed inset-0 z-50 bg-white dark:bg-zinc-950" : "min-h-[320px] w-full",
        className,
      )}
      role="status"
      aria-live="polite"
    >
      <Loader type={type} size="xl" />
      {message && (
        <p className="text-sm text-gray-500 dark:text-zinc-400 font-medium animate-pulse">
          {message}
        </p>
      )}
    </div>
  );
}

/**
 * LoaderButton — inline loader + text for button loading states
 * when you can't use the Button component's built-in loading prop.
 *
 * @example
 * <button disabled={saving}>
 *   {saving ? <LoaderButton label="Saving…" /> : "Save changes"}
 * </button>
 */
export function LoaderButton({ label = "Loading…", type = "spinner", size = "sm", color = "white" }) {
  return (
    <span className="inline-flex items-center gap-2">
      <Loader type={type} size={size} color={color} />
      <span>{label}</span>
    </span>
  );
}