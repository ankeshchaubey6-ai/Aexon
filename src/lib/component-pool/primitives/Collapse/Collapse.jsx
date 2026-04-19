import { useRef, useEffect, useState } from "react";
import { cn } from "../../utils/cn.js";

/**
 * Collapse — a single show/hide panel with smooth height animation.
 * Simpler than Accordion — no context, no grouping, just open/closed.
 *
 * @param {boolean}          open
 * @param {React.ReactNode}  children
 * @param {number}           [duration=250]  - Animation duration in ms
 * @param {boolean}          [unmountOnExit=false] - Remove from DOM when closed
 *
 * @example
 * const [open, setOpen] = useState(false);
 * <button onClick={() => setOpen(o => !o)}>Toggle</button>
 * <Collapse open={open}>
 *   <div className="pt-3 text-gray-600">This content collapses smoothly.</div>
 * </Collapse>
 */
export function Collapse({
  open,
  children,
  duration       = 250,
  unmountOnExit  = false,
  className,
  ...props
}) {
  const ref        = useRef(null);
  const [mounted, setMounted] = useState(open);

  // Track real height for smooth transition
  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    if (open) {
      setMounted(true);
      // Measure on next frame after mount
      requestAnimationFrame(() => {
        el.style.height    = "0px";
        el.style.opacity   = "0";
        el.style.overflow  = "hidden";
        el.style.transition= `height ${duration}ms ease, opacity ${duration}ms ease`;
        // Force reflow
        el.getBoundingClientRect();
        el.style.height    = `${el.scrollHeight}px`;
        el.style.opacity   = "1";
      });
    } else {
      el.style.height    = `${el.scrollHeight}px`;
      el.style.overflow  = "hidden";
      el.style.transition= `height ${duration}ms ease, opacity ${duration}ms ease`;
      requestAnimationFrame(() => {
        el.style.height  = "0px";
        el.style.opacity = "0";
      });
      // Unmount after animation if requested
      if (unmountOnExit) {
        const timer = setTimeout(() => setMounted(false), duration);
        return () => clearTimeout(timer);
      }
    }
  }, [open, duration, unmountOnExit]);

  // After open animation finishes, clear fixed height so it adapts to content changes
  const handleTransitionEnd = () => {
    const el = ref.current;
    if (!el) return;
    if (open) {
      el.style.height   = "auto";
      el.style.overflow = "";
    }
  };

  if (!mounted && unmountOnExit) return null;

  return (
    <div
      ref={ref}
      aria-hidden={!open}
      onTransitionEnd={handleTransitionEnd}
      className={cn(className)}
      {...props}
    >
      {children}
    </div>
  );
}

/**
 * CollapseToggle — a pre-composed show/hide section with a header button.
 *
 * @param {React.ReactNode} label   - Header/trigger content
 * @param {boolean}         [defaultOpen=false]
 * @param {React.ReactNode} [icon]  - Icon in the trigger
 *
 * @example
 * <CollapseToggle label="Advanced options">
 *   <Input label="Webhook URL" />
 *   <Input label="Secret key" />
 * </CollapseToggle>
 */
export function CollapseToggle({ label, icon, defaultOpen = false, children, className }) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className={cn("w-full", className)}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="flex w-full items-center justify-between gap-3 text-sm font-medium text-gray-700 dark:text-zinc-300 hover:text-gray-900 dark:hover:text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded"
      >
        <span className="flex items-center gap-2">
          {icon && <span className="shrink-0 text-gray-400">{icon}</span>}
          {label}
        </span>
        <svg
          viewBox="0 0 16 16" fill="currentColor"
          className={cn("w-4 h-4 text-gray-400 transition-transform duration-200", open && "rotate-180")}
        >
          <path fillRule="evenodd" d="M4.22 6.22a.75.75 0 011.06 0L8 8.94l2.72-2.72a.75.75 0 111.06 1.06l-3.25 3.25a.75.75 0 01-1.06 0L4.22 7.28a.75.75 0 010-1.06z"/>
        </svg>
      </button>
      <Collapse open={open}>
        <div className="pt-4">{children}</div>
      </Collapse>
    </div>
  );
}