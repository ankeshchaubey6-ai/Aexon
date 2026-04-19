import { cn } from "../../utils/cn.js";

/**
 * Infinite horizontal marquee — great for logo clouds, testimonials.
 */
export function Marquee({ items = [], speed = 40, pauseOnHover = true, className, itemClassName }) {
  return (
    <div className={cn("overflow-hidden relative", className)}>
      <div
        className={cn("flex gap-8 w-max", pauseOnHover && "hover:[animation-play-state:paused]")}
        style={{ animation: `marquee ${speed}s linear infinite` }}>
        {[...items, ...items].map((item, i) => (
          <div key={i} className={cn("flex-shrink-0", itemClassName)}>{item}</div>
        ))}
      </div>
      <style>{`@keyframes marquee{0%{transform:translateX(0)}100%{transform:translateX(-50%)}}`}</style>
    </div>
  );
}
