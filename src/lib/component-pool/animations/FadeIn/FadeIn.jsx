import { useIntersection } from "../../hooks/useIntersection.js";
import { cn } from "../../utils/cn.js";

/**
 * Fade in when element enters the viewport.
 * @param {"up"|"down"|"left"|"right"|"none"} direction
 * @param {number} delay - CSS transition delay in ms
 */
export function FadeIn({ direction = "up", delay = 0, duration = 600, once = true, children, className, ...props }) {
  const { ref, isVisible } = useIntersection({ threshold: 0.1 });
  const offsets = { up:"translateY(24px)", down:"translateY(-24px)", left:"translateX(-24px)", right:"translateX(24px)", none:"none" };
  return (
    <div
      ref={ref}
      className={cn(className)}
      style={{
        opacity: isVisible ? 1 : 0,
        transform: isVisible ? "none" : offsets[direction],
        transition: `opacity ${duration}ms ease, transform ${duration}ms ease`,
        transitionDelay: `${delay}ms`,
      }}
      {...props}
    >
      {children}
    </div>
  );
}
