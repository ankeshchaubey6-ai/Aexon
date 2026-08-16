import { cn } from "../../utils/cn.js";

// Shared shimmer animation injected once
const SHIMMER_CSS = `
@keyframes skeleton-shimmer {
  0%   { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}
.skeleton-shimmer {
  background: linear-gradient(
    90deg,
    var(--skeleton-base, #e5e7eb) 25%,
    var(--skeleton-highlight, #f3f4f6) 50%,
    var(--skeleton-base, #e5e7eb) 75%
  );
  background-size: 200% 100%;
  animation: skeleton-shimmer 1.5s ease-in-out infinite;
}
.dark .skeleton-shimmer {
  --skeleton-base: #27272a;
  --skeleton-highlight: #3f3f46;
}
`;

let styleInjected = false;
function injectStyle() {
  if (styleInjected || typeof document === "undefined") return;
  styleInjected = true;
  const el = document.createElement("style");
  el.textContent = SHIMMER_CSS;
  document.head.appendChild(el);
}

/**
 * Skeleton — a shimmer placeholder matching the shape of loading content.
 *
 * @param {"rectangle"|"circle"|"text"|"rounded"} [variant="rectangle"]
 * @param {string|number} [width]    - CSS width value or Tailwind class
 * @param {string|number} [height]   - CSS height value
 * @param {number}        [lines]    - Number of text lines (variant="text" only)
 * @param {boolean}       [animate=true]
 *
 * @example
 * // Single line
 * <Skeleton variant="text" width="60%" />
 *
 * // Multi-line paragraph
 * <Skeleton variant="text" lines={3} />
 *
 * // Avatar + text combo
 * <div className="flex items-center gap-3">
 *   <Skeleton variant="circle" width={40} height={40} />
 *   <div className="flex-1 space-y-2">
 *     <Skeleton variant="text" width="50%" />
 *     <Skeleton variant="text" width="30%" />
 *   </div>
 * </div>
 */
export function Skeleton({
  variant  = "rectangle",
  width,
  height,
  lines,
  animate  = true,
  className,
  style,
  ...props
}) {
  if (typeof document !== "undefined") injectStyle();

  const baseClass = cn(
    animate && "skeleton-shimmer",
    !animate && "bg-gray-200 dark:bg-zinc-800",
    className,
  );

  // Text variant — stack of lines with last one shorter
  if (variant === "text") {
    const count = lines ?? 1;
    return (
      <div className="flex flex-col gap-2" {...props}>
        {Array.from({ length: count }).map((_, i) => (
          <span
            key={i}
            className={cn("block rounded", baseClass)}
            style={{
              height: height ?? "0.875rem",
              width: i === count - 1 && count > 1 ? "75%" : (width ?? "100%"),
            }}
          />
        ))}
      </div>
    );
  }

  const shapeClass = {
    rectangle: "rounded-lg",
    circle:    "rounded-full",
    rounded:   "rounded-xl",
  }[variant] ?? "rounded-lg";

  return (
    <span
      className={cn("block", shapeClass, baseClass)}
      style={{
        width:  width  ?? "100%",
        height: height ?? "1rem",
        ...style,
      }}
      {...props}
    />
  );
}

/**
 * SkeletonCard — a pre-composed card skeleton for product/blog/user cards.
 *
 * @param {"product"|"blog"|"profile"|"stat"} [type="blog"]
 *
 * @example
 * <div className="grid grid-cols-3 gap-6">
 *   {Array(6).fill(0).map((_, i) => <SkeletonCard key={i} type="blog" />)}
 * </div>
 */
export function SkeletonCard({ type = "blog", className }) {
  const cards = {
    blog: (
      <div className={cn("rounded-xl border border-gray-200 dark:border-zinc-800 overflow-hidden", className)}>
        <Skeleton variant="rectangle" height={180} className="rounded-none" />
        <div className="p-4 space-y-3">
          <Skeleton variant="text" width="40%" height="0.75rem" />
          <Skeleton variant="text" lines={2} />
          <div className="flex items-center gap-2 pt-1">
            <Skeleton variant="circle" width={28} height={28} />
            <Skeleton variant="text" width="30%" height="0.75rem" />
          </div>
        </div>
      </div>
    ),
    product: (
      <div className={cn("rounded-xl border border-gray-200 dark:border-zinc-800 overflow-hidden", className)}>
        <Skeleton variant="rectangle" height={220} className="rounded-none" />
        <div className="p-4 space-y-2">
          <Skeleton variant="text" width="80%" />
          <Skeleton variant="text" width="40%" height="0.75rem" />
          <Skeleton variant="text" width="30%" height="1.25rem" />
        </div>
      </div>
    ),
    profile: (
      <div className={cn("flex items-start gap-3 p-4 rounded-xl border border-gray-200 dark:border-zinc-800", className)}>
        <Skeleton variant="circle" width={48} height={48} />
        <div className="flex-1 space-y-2 pt-1">
          <Skeleton variant="text" width="50%" />
          <Skeleton variant="text" width="70%" height="0.75rem" />
          <Skeleton variant="text" width="40%" height="0.75rem" />
        </div>
      </div>
    ),
    stat: (
      <div className={cn("p-5 rounded-xl border border-gray-200 dark:border-zinc-800 space-y-3", className)}>
        <Skeleton variant="text" width="40%" height="0.75rem" />
        <Skeleton variant="text" width="60%" height="2rem" />
        <Skeleton variant="text" width="50%" height="0.75rem" />
      </div>
    ),
  };

  return cards[type] ?? cards.blog;
}