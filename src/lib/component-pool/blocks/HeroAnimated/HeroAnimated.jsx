import { useState, useEffect, useRef } from "react";
import { cn } from "../../utils/cn.js";

// ─────────────────────────────────────────────────────────────────────────────
// Internal: Typewriter for cycling headline words
// ─────────────────────────────────────────────────────────────────────────────
function CyclingWord({ words = [], className }) {
  const [idx,       setIdx]       = useState(0);
  const [text,      setText]      = useState(words[0] ?? "");
  const [deleting,  setDeleting]  = useState(false);
  const [visible,   setVisible]   = useState(true);

  useEffect(() => {
    if (!words.length) return;
    const word    = words[idx % words.length];
    const speed   = deleting ? 40 : 80;
    const pause   = 2200;

    const timer = setTimeout(() => {
      if (!deleting && text === word) {
        setTimeout(() => setDeleting(true), pause);
        return;
      }
      if (deleting && text === "") {
        setDeleting(false);
        setIdx(i => (i + 1) % words.length);
        return;
      }
      setText(deleting ? word.slice(0, text.length - 1) : word.slice(0, text.length + 1));
    }, speed);

    return () => clearTimeout(timer);
  }, [text, deleting, idx, words]);

  return (
    <span className={cn("relative inline-block", className)}>
      {text}
      <span className="animate-[blink_1s_step-end_infinite] ml-0.5 inline-block w-0.5 h-[0.9em] bg-current align-middle opacity-80" />
      <style>{`@keyframes blink{0%,100%{opacity:1}50%{opacity:0}}`}</style>
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Internal: Floating orbs / gradient background
// ─────────────────────────────────────────────────────────────────────────────
function AnimatedBackground({ variant = "orbs" }) {
  if (variant === "grid") {
    return (
      <div className="absolute inset-0 -z-10 overflow-hidden">
        <div
          className="absolute inset-0 opacity-30 dark:opacity-10"
          style={{
            backgroundImage: "linear-gradient(to right, rgb(99 102 241 / 0.15) 1px, transparent 1px), linear-gradient(to bottom, rgb(99 102 241 / 0.15) 1px, transparent 1px)",
            backgroundSize:  "64px 64px",
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-white dark:to-zinc-950" />
      </div>
    );
  }

  return (
    <div className="absolute inset-0 -z-10 overflow-hidden" aria-hidden="true">
      {/* Base gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-slate-50 via-white to-slate-50 dark:from-zinc-950 dark:via-zinc-900 dark:to-zinc-950" />

      {/* Animated orbs */}
      <div
        className="absolute -top-40 -right-40 w-[600px] h-[600px] rounded-full opacity-20 dark:opacity-10"
        style={{
          background: "radial-gradient(circle, #6366f1 0%, #8b5cf6 40%, transparent 70%)",
          animation:  "float-orb 8s ease-in-out infinite",
        }}
      />
      <div
        className="absolute -bottom-40 -left-40 w-[500px] h-[500px] rounded-full opacity-15 dark:opacity-10"
        style={{
          background: "radial-gradient(circle, #3b82f6 0%, #06b6d4 40%, transparent 70%)",
          animation:  "float-orb 10s ease-in-out infinite reverse",
        }}
      />
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] rounded-full opacity-10 dark:opacity-5"
        style={{
          background: "radial-gradient(circle, #a855f7 0%, transparent 70%)",
          animation:  "float-orb 12s ease-in-out infinite 2s",
        }}
      />
      <style>{`
        @keyframes float-orb {
          0%,100% { transform: translate(0, 0) scale(1); }
          33%      { transform: translate(30px, -30px) scale(1.05); }
          66%      { transform: translate(-20px, 20px) scale(0.95); }
        }
      `}</style>
    </div>
  );
}

/**
 * HeroAnimated — a visually rich hero section featuring:
 * - Animated floating orb gradient background (or grid variant)
 * - Typewriter effect cycling through headline words
 * - Gradient text on the animated word
 * - Animated entrance for each element
 *
 * @param {string}   staticTitle      - Part of headline that doesn't change
 * @param {string[]} [cyclingWords=[]] - Words that cycle via typewriter
 * @param {string}   [subtitle]
 * @param {{ label, href?, variant?, onClick? }[]} [actions=[]]
 * @param {React.ReactNode} [media]
 * @param {"orbs"|"grid"} [background="orbs"]
 * @param {string}   [eyebrow]
 * @param {string}   [gradientClass]  - Tailwind gradient class for cycling word
 *
 * @example
 * <HeroAnimated
 *   staticTitle="Build websites that"
 *   cyclingWords={["convert", "delight", "perform", "scale"]}
 *   subtitle="The AI-powered platform for modern product teams."
 *   actions={[
 *     { label: "Start building free", href: "/sign-up" },
 *     { label: "See how it works",    href: "#demo", variant: "ghost" },
 *   ]}
 *   background="orbs"
 * />
 */
export function HeroAnimated({
  staticTitle,
  cyclingWords    = [],
  subtitle,
  actions         = [],
  media,
  background      = "orbs",
  eyebrow,
  gradientClass   = "bg-gradient-to-r from-blue-600 via-violet-500 to-indigo-600 bg-clip-text text-transparent",
  className,
}) {
  return (
    <section
      className={cn(
        "relative overflow-hidden py-20 sm:py-28 lg:py-36 text-center",
        className,
      )}
    >
      <AnimatedBackground variant={background} />

      <div className="container mx-auto px-4 sm:px-6 lg:px-8">

        {/* Eyebrow */}
        {eyebrow && (
          <div
            className="mb-6 flex justify-center animate-in fade-in slide-in-from-bottom-4 duration-500"
          >
            <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-sm font-medium bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 text-gray-700 dark:text-zinc-200 shadow-sm">
              <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
              {eyebrow}
            </span>
          </div>
        )}

        {/* Headline */}
        <h1
          className="mx-auto max-w-4xl font-extrabold tracking-tight text-gray-900 dark:text-white animate-in fade-in slide-in-from-bottom-6 duration-700"
          style={{ fontSize: "clamp(2.5rem, 5vw + 1rem, 5rem)", lineHeight: 1.1 }}
        >
          {staticTitle}{" "}
          {cyclingWords.length > 0 && (
            <CyclingWord words={cyclingWords} className={gradientClass} />
          )}
        </h1>

        {/* Subtitle */}
        {subtitle && (
          <p
            className="mx-auto mt-6 max-w-2xl text-lg sm:text-xl text-gray-600 dark:text-zinc-400 leading-relaxed animate-in fade-in slide-in-from-bottom-6 duration-700 delay-100"
          >
            {subtitle}
          </p>
        )}

        {/* CTAs */}
        {actions.length > 0 && (
          <div
            className="mt-10 flex flex-wrap justify-center gap-4 animate-in fade-in slide-in-from-bottom-6 duration-700 delay-200"
          >
            {actions.map(({ label, href, variant = "primary", onClick }, i) => {
              const cls = {
                primary: cn(
                  "inline-flex items-center px-7 py-3.5 rounded-xl text-base font-semibold",
                  "bg-gradient-to-r from-blue-600 to-violet-600 text-white",
                  "hover:from-blue-700 hover:to-violet-700",
                  "shadow-lg shadow-blue-600/25 hover:shadow-blue-600/40",
                  "hover:-translate-y-0.5 transition-all duration-150",
                ),
                secondary: cn(
                  "inline-flex items-center px-7 py-3.5 rounded-xl text-base font-semibold",
                  "bg-white dark:bg-zinc-800 text-gray-900 dark:text-zinc-100",
                  "border border-gray-200 dark:border-zinc-700",
                  "hover:bg-gray-50 dark:hover:bg-zinc-700",
                  "hover:-translate-y-0.5 shadow-sm transition-all",
                ),
                ghost: "inline-flex items-center gap-2 px-7 py-3.5 text-base font-semibold text-gray-600 dark:text-zinc-400 hover:text-gray-900 dark:hover:text-white transition-colors",
              }[variant] ?? "";

              return href
                ? <a key={i} href={href} className={cls}>{label}</a>
                : <button key={i} type="button" onClick={onClick} className={cls}>{label}</button>;
            })}
          </div>
        )}

        {/* Media */}
        {media && (
          <div
            className="mt-16 sm:mt-20 flex justify-center animate-in fade-in slide-in-from-bottom-8 duration-1000 delay-300"
          >
            {media}
          </div>
        )}
      </div>
    </section>
  );
}