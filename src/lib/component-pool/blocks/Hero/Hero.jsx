import { cn } from "../../utils/cn.js";

/**
 * Hero — the primary landing page hero section.
 * Centered layout with optional eyebrow badge, gradient background,
 * dual CTAs, social proof row, and media slot.
 *
 * @param {string}          [eyebrow]          - Small label above headline
 * @param {string|ReactNode} title             - Main headline (supports JSX for gradient text)
 * @param {string}          [subtitle]         - Supporting paragraph
 * @param {{ label: string, href?: string, variant?: string, onClick?: fn }[]} [actions=[]]
 * @param {{ text: string, avatars?: { src?, name }[], rating?: number }} [socialProof]
 * @param {React.ReactNode} [media]            - Image / video / mockup below CTAs
 * @param {"center"|"left"} [align="center"]
 * @param {"gradient"|"mesh"|"plain"|"dark"} [background="gradient"]
 * @param {string}          [eyebrowHref]
 *
 * @example
 * <Hero
 *   eyebrow="Now in public beta"
 *   title={<>The AI platform that <span className="text-blue-600">builds itself</span></>}
 *   subtitle="Ship production-ready websites in seconds — not weeks."
 *   actions={[
 *     { label: "Start for free →", href: "/sign-up" },
 *     { label: "Watch demo", href: "#demo", variant: "secondary" },
 *   ]}
 *   socialProof={{ text: "Trusted by 10 000+ developers", rating: 4.9 }}
 *   background="gradient"
 * />
 */
export function Hero({
  eyebrow,
  eyebrowHref,
  title,
  subtitle,
  actions       = [],
  socialProof,
  media,
  align         = "center",
  background    = "gradient",
  className,
  children,
}) {
  const isCenter = align === "center";

  const bgMap = {
    gradient: "bg-gradient-to-br from-blue-50 via-white to-violet-50 dark:from-zinc-950 dark:via-zinc-900 dark:to-violet-950/20",
    mesh:     "bg-white dark:bg-zinc-950 [background-image:radial-gradient(at_40%_20%,rgba(59,130,246,0.08)_0,transparent_50%),radial-gradient(at_80%_0%,rgba(139,92,246,0.08)_0,transparent_50%),radial-gradient(at_0%_50%,rgba(16,185,129,0.05)_0,transparent_50%)]",
    plain:    "bg-white dark:bg-zinc-950",
    dark:     "bg-gray-950 dark:bg-zinc-950",
  };

  return (
    <section
      className={cn(
        "relative overflow-hidden py-20 sm:py-28 lg:py-36",
        bgMap[background] ?? bgMap.gradient,
        className,
      )}
    >
      <div className={cn(
        "container mx-auto px-4 sm:px-6 lg:px-8",
        isCenter ? "text-center" : "text-left",
      )}>
        {/* Eyebrow */}
        {eyebrow && (
          <div className={cn("mb-6", isCenter && "flex justify-center")}>
            {eyebrowHref ? (
              <a
                href={eyebrowHref}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-sm font-medium bg-blue-50 text-blue-700 border border-blue-100 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-900 hover:opacity-80 transition-opacity"
              >
                {eyebrow}
                <svg viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5 opacity-60">
                  <path fillRule="evenodd" d="M6.22 3.97a.75.75 0 000 1.06L8.19 7 6.22 8.97a.75.75 0 101.06 1.06l2.5-2.5a.75.75 0 000-1.06l-2.5-2.5a.75.75 0 00-1.06 0z"/>
                </svg>
              </a>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-sm font-medium bg-blue-50 text-blue-700 border border-blue-100 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-900">
                {eyebrow}
              </span>
            )}
          </div>
        )}

        {/* Headline */}
        {title && (
          <h1
            className={cn(
              "font-extrabold tracking-tight text-gray-900 dark:text-white",
              "text-4xl sm:text-5xl lg:text-6xl xl:text-7xl",
              background === "dark" && "text-white",
              !isCenter && "max-w-3xl",
              isCenter && "max-w-4xl mx-auto",
            )}
            style={{ lineHeight: 1.1 }}
          >
            {title}
          </h1>
        )}

        {/* Subtitle */}
        {subtitle && (
          <p
            className={cn(
              "mt-6 text-lg sm:text-xl leading-relaxed",
              background === "dark"
                ? "text-gray-300"
                : "text-gray-600 dark:text-zinc-400",
              isCenter ? "max-w-2xl mx-auto" : "max-w-xl",
            )}
          >
            {subtitle}
          </p>
        )}

        {/* CTAs */}
        {actions.length > 0 && (
          <div className={cn(
            "mt-10 flex flex-wrap gap-4",
            isCenter ? "justify-center" : "justify-start",
          )}>
            {actions.map(({ label, href, variant = "primary", onClick }, i) => {
              const cls = {
                primary:   "inline-flex items-center px-6 py-3 bg-blue-600 text-white rounded-xl text-base font-semibold hover:bg-blue-700 active:bg-blue-800 shadow-lg shadow-blue-600/20 hover:shadow-blue-600/30 hover:-translate-y-0.5 transition-all duration-150",
                secondary: "inline-flex items-center px-6 py-3 bg-white dark:bg-zinc-800 text-gray-900 dark:text-zinc-100 border border-gray-200 dark:border-zinc-700 rounded-xl text-base font-semibold hover:bg-gray-50 dark:hover:bg-zinc-700 hover:-translate-y-0.5 shadow-sm transition-all duration-150",
                ghost:     "inline-flex items-center px-6 py-3 text-gray-600 dark:text-zinc-400 text-base font-semibold hover:text-gray-900 dark:hover:text-white transition-colors",
                outline:   "inline-flex items-center px-6 py-3 border-2 border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400 rounded-xl text-base font-semibold hover:bg-blue-50 dark:hover:bg-blue-950 transition-colors",
              }[variant] ?? "";

              return href
                ? <a key={i} href={href} className={cls}>{label}</a>
                : <button key={i} type="button" onClick={onClick} className={cls}>{label}</button>;
            })}
          </div>
        )}

        {/* Social proof */}
        {socialProof && (
          <div className={cn("mt-8 flex items-center gap-3 flex-wrap", isCenter && "justify-center")}>
            {socialProof.avatars && socialProof.avatars.length > 0 && (
              <div className="flex -space-x-2">
                {socialProof.avatars.slice(0, 5).map((av, i) => (
                  <div
                    key={i}
                    className="w-8 h-8 rounded-full border-2 border-white dark:border-zinc-900 bg-gradient-to-br from-blue-400 to-violet-500 flex items-center justify-center text-xs font-semibold text-white overflow-hidden"
                  >
                    {av.src
                      ? <img src={av.src} alt={av.name ?? ""} className="w-full h-full object-cover" />
                      : av.name?.[0]?.toUpperCase()
                    }
                  </div>
                ))}
              </div>
            )}
            {socialProof.rating && (
              <div className="flex items-center gap-1">
                {Array.from({ length: 5 }, (_, i) => (
                  <svg key={i} viewBox="0 0 16 16" fill="currentColor" className={cn("w-4 h-4", i < Math.floor(socialProof.rating) ? "text-amber-400" : "text-gray-200 dark:text-zinc-700")}>
                    <path d="M8 1l2.06 4.17 4.6.67-3.33 3.24.79 4.6L8 11.4l-4.12 2.17.79-4.6-3.33-3.24 4.6-.67L8 1z"/>
                  </svg>
                ))}
              </div>
            )}
            <p className="text-sm text-gray-500 dark:text-zinc-400">{socialProof.text}</p>
          </div>
        )}

        {/* Custom children */}
        {children}

        {/* Media */}
        {media && (
          <div className={cn("mt-16 sm:mt-20", isCenter && "flex justify-center")}>
            {media}
          </div>
        )}
      </div>
    </section>
  );
}