import { cn } from "../../utils/cn.js";

/**
 * HeroCentered — a large centered hero optimised for SaaS landing pages.
 * Includes an announcement ribbon, headline, subtitle, CTAs, and an
 * optional logo cloud directly beneath to build trust.
 *
 * @param {{ text: string, href?: string, label?: string }} [announcement]
 * @param {string|ReactNode} title
 * @param {string}           [subtitle]
 * @param {{ label, href?, variant?, onClick? }[]} [actions=[]]
 * @param {{ src: string, alt: string, width?: number }[]} [logos=[]] - Logo cloud
 * @param {string}           [logosLabel="Trusted by teams at"]
 * @param {React.ReactNode}  [media]
 *
 * @example
 * <HeroCentered
 *   announcement={{ label: "New", text: "Announcing our Series A →", href: "/blog/series-a" }}
 *   title={<>Build faster with <span className="bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-violet-600">AI-powered tools</span></>}
 *   subtitle="Everything your team needs to ship great products."
 *   actions={[
 *     { label: "Get started — it's free", href: "/sign-up" },
 *     { label: "View demo",               href: "#demo", variant: "ghost" },
 *   ]}
 *   logos={[{ src: "/logos/stripe.svg", alt: "Stripe" }, ...]}
 * />
 */
export function HeroCentered({
  announcement,
  title,
  subtitle,
  actions      = [],
  logos        = [],
  logosLabel   = "Trusted by teams at",
  media,
  className,
}) {
  return (
    <section
      className={cn(
        "relative overflow-hidden py-20 sm:py-28 lg:py-36 bg-white dark:bg-zinc-950 text-center",
        className,
      )}
    >
      {/* Radial glow */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[600px]"
        style={{
          background:
            "radial-gradient(ellipse 80% 50% at 50% -10%, rgba(99,102,241,0.12) 0%, transparent 70%)",
        }}
        aria-hidden="true"
      />

      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        {/* Announcement */}
        {announcement && (
          <div className="flex justify-center mb-8">
            <a
              href={announcement.href ?? "#"}
              className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-medium border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-gray-700 dark:text-zinc-200 hover:border-blue-300 dark:hover:border-blue-700 shadow-sm transition-all hover:-translate-y-0.5"
            >
              {announcement.label && (
                <span className="px-2 py-0.5 rounded-full bg-blue-600 text-white text-[11px] font-semibold">
                  {announcement.label}
                </span>
              )}
              {announcement.text}
              <svg viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5 text-gray-400">
                <path fillRule="evenodd" d="M6.22 3.97a.75.75 0 000 1.06L8.19 7 6.22 8.97a.75.75 0 101.06 1.06l2.5-2.5a.75.75 0 000-1.06l-2.5-2.5a.75.75 0 00-1.06 0z"/>
              </svg>
            </a>
          </div>
        )}

        {/* Headline */}
        <h1
          className="mx-auto max-w-4xl font-extrabold tracking-tight text-gray-900 dark:text-white"
          style={{ fontSize: "clamp(2.5rem, 5vw + 1rem, 5rem)", lineHeight: 1.08 }}
        >
          {title}
        </h1>

        {/* Subtitle */}
        {subtitle && (
          <p className="mx-auto mt-6 max-w-2xl text-lg sm:text-xl text-gray-600 dark:text-zinc-400 leading-relaxed">
            {subtitle}
          </p>
        )}

        {/* CTAs */}
        {actions.length > 0 && (
          <div className="mt-10 flex flex-wrap justify-center gap-4">
            {actions.map(({ label, href, variant = "primary", onClick }, i) => {
              const cls = {
                primary: "inline-flex items-center px-7 py-3.5 bg-blue-600 text-white rounded-xl text-base font-semibold hover:bg-blue-700 shadow-lg shadow-blue-600/25 hover:shadow-blue-600/40 hover:-translate-y-0.5 transition-all duration-150",
                secondary: "inline-flex items-center px-7 py-3.5 bg-white dark:bg-zinc-800 text-gray-900 dark:text-zinc-100 border border-gray-200 dark:border-zinc-700 rounded-xl text-base font-semibold hover:bg-gray-50 dark:hover:bg-zinc-700 hover:-translate-y-0.5 shadow-sm transition-all",
                ghost:     "inline-flex items-center gap-2 px-7 py-3.5 text-gray-600 dark:text-zinc-400 text-base font-semibold hover:text-gray-900 dark:hover:text-white transition-colors",
              }[variant] ?? "";
              return href
                ? <a key={i} href={href} className={cls}>{label}</a>
                : <button key={i} type="button" onClick={onClick} className={cls}>{label}</button>;
            })}
          </div>
        )}

        {/* Logo cloud */}
        {logos.length > 0 && (
          <div className="mt-16 sm:mt-20">
            {logosLabel && (
              <p className="mb-6 text-xs font-semibold uppercase tracking-widest text-gray-400 dark:text-zinc-500">
                {logosLabel}
              </p>
            )}
            <div className="flex flex-wrap items-center justify-center gap-x-10 gap-y-5">
              {logos.map((logo, i) => (
                <img
                  key={i}
                  src={logo.src}
                  alt={logo.alt}
                  width={logo.width ?? 120}
                  className="h-7 w-auto object-contain opacity-50 dark:opacity-30 hover:opacity-70 dark:hover:opacity-50 transition-opacity grayscale"
                />
              ))}
            </div>
          </div>
        )}

        {/* Media */}
        {media && (
          <div className="mt-16 sm:mt-20 flex justify-center">
            {media}
          </div>
        )}
      </div>
    </section>
  );
}