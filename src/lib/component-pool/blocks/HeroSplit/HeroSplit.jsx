import { cn } from "../../utils/cn.js";

/**
 * HeroSplit — a two-column hero: text content on one side, media on the other.
 * Stacks to single column on mobile.
 *
 * @param {string}          [eyebrow]
 * @param {string|ReactNode} title
 * @param {string}          [subtitle]
 * @param {{ label, href?, variant?, onClick? }[]} [actions=[]]
 * @param {React.ReactNode} media           - Image, video, mockup, or illustration
 * @param {"left"|"right"}  [mediaPosition="right"]
 * @param {React.ReactNode} [badge]         - Small badge above eyebrow
 * @param {{ text, href? }[]} [trustItems]  - Trust signals row (logos, stats)
 *
 * @example
 * <HeroSplit
 *   eyebrow="Trusted by 500+ teams"
 *   title="Ship your product 10× faster"
 *   subtitle="The only platform you need to go from idea to production."
 *   actions={[{ label: "Get started free", href: "/sign-up" }]}
 *   media={<img src="/product-screenshot.png" alt="Product" className="rounded-2xl shadow-2xl"/>}
 *   trustItems={[{ text: "SOC 2 Type II" }, { text: "GDPR compliant" }, { text: "99.99% uptime" }]}
 * />
 */
export function HeroSplit({
  eyebrow,
  title,
  subtitle,
  actions        = [],
  media,
  mediaPosition  = "right",
  badge,
  trustItems     = [],
  className,
}) {
  const isMediaRight = mediaPosition === "right";

  return (
    <section
      className={cn(
        "relative overflow-hidden py-16 sm:py-24 lg:py-32",
        "bg-white dark:bg-zinc-950",
        className,
      )}
    >
      {/* Subtle grid background */}
      <div
        className="absolute inset-0 -z-10 opacity-40 dark:opacity-20"
        style={{
          backgroundImage: "radial-gradient(circle at 1px 1px, rgb(203 213 225) 1px, transparent 0)",
          backgroundSize:  "32px 32px",
        }}
        aria-hidden="true"
      />

      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className={cn(
          "flex flex-col gap-12 lg:flex-row lg:items-center lg:gap-16",
          !isMediaRight && "lg:flex-row-reverse",
        )}>
          {/* Text column */}
          <div className="flex-1 max-w-xl">
            {badge && (
              <div className="mb-4">{badge}</div>
            )}

            {eyebrow && (
              <p className="mb-4 text-sm font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wide">
                {eyebrow}
              </p>
            )}

            <h1
              className="text-4xl sm:text-5xl font-extrabold tracking-tight text-gray-900 dark:text-white leading-tight"
            >
              {title}
            </h1>

            {subtitle && (
              <p className="mt-5 text-lg text-gray-600 dark:text-zinc-400 leading-relaxed">
                {subtitle}
              </p>
            )}

            {actions.length > 0 && (
              <div className="mt-8 flex flex-wrap gap-3">
                {actions.map(({ label, href, variant = "primary", onClick }, i) => {
                  const cls = {
                    primary:   "inline-flex items-center px-6 py-3 bg-blue-600 text-white rounded-xl text-base font-semibold hover:bg-blue-700 shadow-lg shadow-blue-600/20 hover:-translate-y-0.5 transition-all",
                    secondary: "inline-flex items-center px-6 py-3 bg-white dark:bg-zinc-800 text-gray-800 dark:text-zinc-100 border border-gray-200 dark:border-zinc-700 rounded-xl text-base font-semibold hover:bg-gray-50 dark:hover:bg-zinc-700 hover:-translate-y-0.5 shadow-sm transition-all",
                    ghost:     "inline-flex items-center px-6 py-3 text-gray-600 dark:text-zinc-400 text-base font-semibold hover:text-gray-900 dark:hover:text-white transition-colors gap-2",
                  }[variant] ?? "";
                  return href
                    ? <a key={i} href={href} className={cls}>{label}</a>
                    : <button key={i} type="button" onClick={onClick} className={cls}>{label}</button>;
                })}
              </div>
            )}

            {/* Trust signals */}
            {trustItems.length > 0 && (
              <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-2">
                {trustItems.map((item, i) => (
                  <div key={i} className="flex items-center gap-1.5 text-sm text-gray-500 dark:text-zinc-400">
                    <svg viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4 text-emerald-500 shrink-0">
                      <path d="M13.78 4.22a.75.75 0 010 1.06l-7.25 7.25a.75.75 0 01-1.06 0L2.22 9.28a.75.75 0 011.06-1.06L6 10.94l6.72-6.72a.75.75 0 011.06 0z"/>
                    </svg>
                    {item.href
                      ? <a href={item.href} className="hover:text-gray-700 dark:hover:text-zinc-200">{item.text}</a>
                      : <span>{item.text}</span>
                    }
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Media column */}
          {media && (
            <div className="flex-1 w-full max-w-2xl lg:max-w-none">
              {media}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}