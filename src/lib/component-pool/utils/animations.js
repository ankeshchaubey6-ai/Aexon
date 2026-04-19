// ─────────────────────────────────────────────
// Framer Motion variant presets
// Import and spread into motion.* components.
// ─────────────────────────────────────────────

/** Standard ease curves */
export const EASE = {
  out:    [0.25, 0.46, 0.45, 0.94],
  in:     [0.55, 0.055, 0.675, 0.19],
  inOut:  [0.645, 0.045, 0.355, 1.0],
  spring: { type: "spring", stiffness: 300, damping: 30 },
};

// ── Fade variants ──────────────────────────

export const fadeIn = {
  initial:    { opacity: 0 },
  animate:    { opacity: 1 },
  exit:       { opacity: 0 },
  transition: { duration: 0.25, ease: EASE.out },
};

export const fadeInUp = {
  initial:    { opacity: 0, y: 24 },
  animate:    { opacity: 1, y: 0 },
  exit:       { opacity: 0, y: 24 },
  transition: { duration: 0.4, ease: EASE.out },
};

export const fadeInDown = {
  initial:    { opacity: 0, y: -24 },
  animate:    { opacity: 1, y: 0 },
  exit:       { opacity: 0, y: -24 },
  transition: { duration: 0.4, ease: EASE.out },
};

export const fadeInLeft = {
  initial:    { opacity: 0, x: -32 },
  animate:    { opacity: 1, x: 0 },
  exit:       { opacity: 0, x: -32 },
  transition: { duration: 0.4, ease: EASE.out },
};

export const fadeInRight = {
  initial:    { opacity: 0, x: 32 },
  animate:    { opacity: 1, x: 0 },
  exit:       { opacity: 0, x: 32 },
  transition: { duration: 0.4, ease: EASE.out },
};

// ── Scale variants ─────────────────────────

export const scaleIn = {
  initial:    { opacity: 0, scale: 0.92 },
  animate:    { opacity: 1, scale: 1 },
  exit:       { opacity: 0, scale: 0.92 },
  transition: { duration: 0.25, ease: EASE.out },
};

export const scaleInCenter = {
  initial:    { opacity: 0, scale: 0.8 },
  animate:    { opacity: 1, scale: 1 },
  exit:       { opacity: 0, scale: 0.8 },
  transition: EASE.spring,
};

// ── Slide variants ─────────────────────────

export const slideUp = {
  initial:    { y: "100%" },
  animate:    { y: 0 },
  exit:       { y: "100%" },
  transition: { duration: 0.35, ease: EASE.out },
};

export const slideDown = {
  initial:    { y: "-100%" },
  animate:    { y: 0 },
  exit:       { y: "-100%" },
  transition: { duration: 0.35, ease: EASE.out },
};

export const slideInLeft = {
  initial:    { x: "-100%" },
  animate:    { x: 0 },
  exit:       { x: "-100%" },
  transition: { duration: 0.35, ease: EASE.out },
};

export const slideInRight = {
  initial:    { x: "100%" },
  animate:    { x: 0 },
  exit:       { x: "100%" },
  transition: { duration: 0.35, ease: EASE.out },
};

// ── Stagger helpers ────────────────────────

/**
 * Parent container that staggers its children.
 * @param {number} staggerChildren - Delay between each child in seconds
 * @param {number} delayChildren   - Initial delay before first child
 */
export function staggerContainer(staggerChildren = 0.08, delayChildren = 0) {
  return {
    hidden:  {},
    visible: { transition: { staggerChildren, delayChildren } },
  };
}

/** Child item to use inside a staggerContainer */
export const staggerItem = {
  hidden:  { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: EASE.out } },
};

/** Horizontal stagger item (for rows) */
export const staggerItemX = {
  hidden:  { opacity: 0, x: -16 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.35, ease: EASE.out } },
};

// ── Page transition preset ─────────────────

export const pageTransition = {
  initial:    { opacity: 0, y: 8 },
  animate:    { opacity: 1, y: 0 },
  exit:       { opacity: 0, y: -8 },
  transition: { duration: 0.3, ease: EASE.out },
};

// ─────────────────────────────────────────────
// CSS keyframe strings
// Inject into a <style> tag or a CSS-in-JS solution.
// ─────────────────────────────────────────────

export const CSS_KEYFRAMES = {
  /** Infinite shimmer — use with: animation: shimmer 1.5s infinite linear */
  shimmer: `
@keyframes shimmer {
  0%   { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}`,

  /** Smooth opacity pulse */
  pulse: `
@keyframes pulse {
  0%, 100% { opacity: 1; }
  50%       { opacity: 0.45; }
}`,

  /** Gentle vertical float */
  float: `
@keyframes float {
  0%, 100% { transform: translateY(0px); }
  50%       { transform: translateY(-8px); }
}`,

  /** Continuous rotation */
  spin: `
@keyframes spin {
  from { transform: rotate(0deg); }
  to   { transform: rotate(360deg); }
}`,

  /** Radar ping — scale + fade */
  ping: `
@keyframes ping {
  75%, 100% { transform: scale(2); opacity: 0; }
}`,

  /** Bounce — vertical bounce loop */
  bounce: `
@keyframes bounce {
  0%, 100% { transform: translateY(0); animation-timing-function: cubic-bezier(0.8,0,1,1); }
  50%       { transform: translateY(-25%); animation-timing-function: cubic-bezier(0,0,0.2,1); }
}`,

  /** Horizontal marquee — move left by 50% */
  marquee: `
@keyframes marquee {
  0%   { transform: translateX(0); }
  100% { transform: translateX(-50%); }
}`,

  /** Gradient background shift */
  gradientShift: `
@keyframes gradientShift {
  0%   { background-position: 0% 50%; }
  50%  { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
}`,

  /** Typewriter cursor blink */
  blink: `
@keyframes blink {
  0%, 100% { opacity: 1; }
  50%       { opacity: 0; }
}`,

  /** Accordion / collapse open */
  accordionOpen: `
@keyframes accordionOpen {
  from { height: 0; opacity: 0; }
  to   { height: var(--radix-accordion-content-height); opacity: 1; }
}`,

  /** Accordion / collapse close */
  accordionClose: `
@keyframes accordionClose {
  from { height: var(--radix-accordion-content-height); opacity: 1; }
  to   { height: 0; opacity: 0; }
}`,
};

// ─────────────────────────────────────────────
// Tailwind-compatible animation class helpers
// Pass these strings into cn() for quick use.
// ─────────────────────────────────────────────

export const ANIM_CLASSES = {
  shimmer:        "animate-[shimmer_1.5s_infinite_linear]",
  pulse:          "animate-[pulse_2s_ease-in-out_infinite]",
  float:          "animate-[float_3s_ease-in-out_infinite]",
  spin:           "animate-spin",
  ping:           "animate-ping",
  bounce:         "animate-bounce",
  marquee:        "animate-[marquee_var(--marquee-speed,30s)_linear_infinite]",
  gradientShift:  "animate-[gradientShift_6s_ease_infinite]",
  fadeIn:         "animate-in fade-in duration-300",
  fadeInUp:       "animate-in fade-in slide-in-from-bottom-4 duration-400",
  fadeInDown:     "animate-in fade-in slide-in-from-top-4 duration-400",
  zoomIn:         "animate-in zoom-in-95 duration-200",
  slideInLeft:    "animate-in slide-in-from-left-4 duration-350",
  slideInRight:   "animate-in slide-in-from-right-4 duration-350",
};

// ─────────────────────────────────────────────
// Intersection-based trigger utility
// ─────────────────────────────────────────────

/**
 * Build inline style props for a CSS-only scroll-reveal.
 * Works without Framer Motion — pair with useIntersection hook.
 *
 * @param {boolean} isVisible   - From useIntersection
 * @param {"up"|"down"|"left"|"right"|"none"} direction
 * @param {number}  delay       - ms delay
 * @param {number}  duration    - ms duration
 */
export function revealStyle(isVisible, direction = "up", delay = 0, duration = 500) {
  const offsets = {
    up:    "translateY(32px)",
    down:  "translateY(-32px)",
    left:  "translateX(-32px)",
    right: "translateX(32px)",
    none:  "none",
  };
  return {
    opacity:          isVisible ? 1 : 0,
    transform:        isVisible ? "none" : offsets[direction] ?? offsets.up,
    transition:       `opacity ${duration}ms ease, transform ${duration}ms ease`,
    transitionDelay:  `${delay}ms`,
    willChange:       "opacity, transform",
  };
}