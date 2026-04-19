import { useState } from "react";
import { cn } from "../../utils/cn.js";
import { getAvatarStyle, getInitials } from "../../utils/colors.js";

// ─────────────────────────────────────────────────────────────────────────────
// Size map
// ─────────────────────────────────────────────────────────────────────────────
const SIZES = {
  "2xs": { box: "w-5 h-5",   text: "text-[9px]",  ring: "ring-1", status: "w-1.5 h-1.5 -bottom-px -right-px" },
  xs:    { box: "w-6 h-6",   text: "text-[10px]", ring: "ring-1", status: "w-2 h-2 bottom-0 right-0" },
  sm:    { box: "w-8 h-8",   text: "text-xs",     ring: "ring-2", status: "w-2 h-2 bottom-0 right-0" },
  md:    { box: "w-10 h-10", text: "text-sm",     ring: "ring-2", status: "w-2.5 h-2.5 bottom-0 right-0" },
  lg:    { box: "w-12 h-12", text: "text-base",   ring: "ring-2", status: "w-3 h-3 bottom-0 right-0" },
  xl:    { box: "w-16 h-16", text: "text-xl",     ring: "ring-2", status: "w-3.5 h-3.5 bottom-0.5 right-0.5" },
  "2xl": { box: "w-20 h-20", text: "text-2xl",    ring: "ring-4", status: "w-4 h-4 bottom-1 right-1" },
  "3xl": { box: "w-24 h-24", text: "text-3xl",    ring: "ring-4", status: "w-5 h-5 bottom-1 right-1" },
};

// Status indicator colors
const STATUS_COLORS = {
  online:  "bg-emerald-500",
  offline: "bg-gray-400 dark:bg-zinc-500",
  busy:    "bg-red-500",
  away:    "bg-amber-500",
  dnd:     "bg-red-600",
};

/**
 * Avatar — displays a user's profile image with initials fallback,
 * deterministic color generation, and optional status indicator.
 *
 * @param {string}  [src]          - Image URL
 * @param {string}  [name]         - Full name (used for initials + color)
 * @param {string}  [alt]          - Image alt text (defaults to name)
 * @param {"2xs"|"xs"|"sm"|"md"|"lg"|"xl"|"2xl"|"3xl"} [size="md"]
 * @param {"circle"|"rounded"|"square"} [shape="circle"]
 * @param {"online"|"offline"|"busy"|"away"|"dnd"} [status]
 * @param {boolean} [ring=false]   - White ring border (for stacked groups)
 * @param {string}  [ringColor]    - Tailwind class for ring color
 * @param {React.ReactNode} [fallback] - Custom fallback when no src/name
 *
 * @example
 * <Avatar src={user.avatar} name={user.name} size="md" status="online" />
 * <Avatar name="John Doe" size="lg" shape="rounded" />
 */
export function Avatar({
  src,
  name      = "",
  alt,
  size      = "md",
  shape     = "circle",
  status,
  ring      = false,
  ringColor = "ring-white dark:ring-zinc-900",
  fallback,
  className,
  ...props
}) {
  const [imgError, setImgError] = useState(false);
  const { box, text, ring: ringWidth, status: statusPos } = SIZES[size] ?? SIZES.md;

  const shapeClass = {
    circle:  "rounded-full",
    rounded: "rounded-xl",
    square:  "rounded-none",
  }[shape] ?? "rounded-full";

  const avatarStyle = getAvatarStyle(name);
  const initials    = getInitials(name);

  const showImage    = src && !imgError;
  const showInitials = !showImage && initials;
  const showFallback = !showImage && !showInitials;

  return (
    <span className={cn("relative inline-flex shrink-0", box, className)} {...props}>
      {/* Image / Initials / Fallback */}
      <span
        className={cn(
          "flex items-center justify-center w-full h-full overflow-hidden select-none",
          shapeClass,
          ring && cn(ringWidth, ringColor),
          !showImage && "font-semibold",
        )}
        style={!showImage ? avatarStyle : undefined}
        aria-label={alt ?? name}
        role={!showImage ? "img" : undefined}
      >
        {showImage ? (
          <img
            src={src}
            alt={alt ?? name}
            className="w-full h-full object-cover"
            onError={() => setImgError(true)}
          />
        ) : showInitials ? (
          <span className={cn(text)}>{initials}</span>
        ) : showFallback ? (
          fallback ?? (
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-3/5 h-3/5 opacity-70">
              <path d="M12 12a5 5 0 100-10 5 5 0 000 10zm0 2c-5.33 0-8 2.67-8 4v1h16v-1c0-1.33-2.67-4-8-4z"/>
            </svg>
          )
        ) : null}
      </span>

      {/* Status indicator */}
      {status && (
        <span
          className={cn(
            "absolute block rounded-full ring-2 ring-white dark:ring-zinc-900",
            STATUS_COLORS[status] ?? STATUS_COLORS.offline,
            statusPos,
          )}
          aria-label={status}
        />
      )}
    </span>
  );
}

/**
 * AvatarGroup — displays a stack of overlapping avatars with a "+N" overflow count.
 *
 * @param {{ src?, name?, status? }[]} users
 * @param {number} [max=4]        - Maximum avatars shown before overflow count
 * @param {"2xs"|"xs"|"sm"|"md"|"lg"} [size="sm"]
 * @param {"left"|"right"} [direction="right"] - Stacking direction
 * @param {boolean} [showTooltip=false]
 *
 * @example
 * <AvatarGroup users={collaborators} max={5} size="sm" />
 */
export function AvatarGroup({
  users     = [],
  max       = 4,
  size      = "sm",
  direction = "right",
  className,
  ...props
}) {
  const shown   = users.slice(0, max);
  const overflow= users.length - max;

  const { box, text } = SIZES[size] ?? SIZES.sm;

  return (
    <div
      className={cn(
        "flex items-center",
        direction === "right" ? "-space-x-2" : "flex-row-reverse -space-x-2 space-x-reverse",
        className,
      )}
      {...props}
    >
      {shown.map((user, i) => (
        <Avatar
          key={i}
          src={user.src}
          name={user.name}
          status={user.status}
          size={size}
          ring
          title={user.name}
        />
      ))}

      {overflow > 0 && (
        <span
          className={cn(
            "relative inline-flex items-center justify-center shrink-0",
            "rounded-full bg-gray-100 dark:bg-zinc-700",
            "text-gray-700 dark:text-zinc-200 font-semibold",
            "ring-2 ring-white dark:ring-zinc-900",
            box, text,
          )}
          aria-label={`${overflow} more`}
        >
          +{overflow}
        </span>
      )}
    </div>
  );
}