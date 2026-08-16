import { useState } from "react";
import { cn } from "../../utils/cn.js";
import { useScroll } from "../../hooks/useScroll.js";
import { useScrollLock } from "../../hooks/useScrollLock.js";

/**
 * NavbarWithCTA — marketing nav with a high-contrast CTA button and optional
 * announcement badge in the nav itself.
 *
 * @param {React.ReactNode} logo
 * @param {{ label: string, href?: string }[]} links
 * @param {{ label: string, href?: string, onClick?: fn }} cta  - Primary CTA
 * @param {{ label: string, href?: string, onClick?: fn }} [secondaryCta]
 * @param {{ text: string, href?: string, label?: string }} [badge]  - "New ✦ Announcement" pill
 *
 * @example
 * <NavbarWithCTA
 *   logo={<Logo />}
 *   links={[{ label: "Features", href: "#" }, { label: "Pricing", href: "#" }]}
 *   cta={{ label: "Start for free →", href: "/sign-up" }}
 *   secondaryCta={{ label: "Sign in", href: "/sign-in" }}
 *   badge={{ label: "New", text: "Version 2.0 is live", href: "/changelog" }}
 * />
 */
export function NavbarWithCTA({
  logo,
  links       = [],
  cta,
  secondaryCta,
  badge,
  className,
}) {
  const { y }                       = useScroll();
  const [mobileOpen, setMobileOpen] = useState(false);
  useScrollLock(mobileOpen);

  const scrolled = y > 16 || mobileOpen;

  return (
    <>
      <header
        className={cn(
          "fixed top-0 left-0 right-0 z-40 transition-all duration-300",
          scrolled
            ? "bg-white/90 dark:bg-zinc-950/90 backdrop-blur-md shadow-sm border-b border-gray-100 dark:border-zinc-800"
            : "bg-transparent",
          className,
        )}
      >
        <nav aria-label="Main" className="container mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center gap-4">
          {/* Logo */}
          <div className="shrink-0 mr-3">
            {logo ?? <span className="text-xl font-bold text-gray-900 dark:text-white">Brand</span>}
          </div>

          {/* Badge */}
          {badge && (
            <a
              href={badge.href ?? "#"}
              className="hidden md:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-100 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-900 hover:opacity-80 transition-opacity"
            >
              {badge.label && (
                <span className="px-1.5 py-0.5 bg-blue-600 text-white rounded-full text-[10px] font-semibold">
                  {badge.label}
                </span>
              )}
              {badge.text}
              <svg viewBox="0 0 16 16" fill="currentColor" className="w-3 h-3 opacity-60">
                <path fillRule="evenodd" d="M6.22 3.97a.75.75 0 000 1.06L8.19 7 6.22 8.97a.75.75 0 101.06 1.06l2.5-2.5a.75.75 0 000-1.06l-2.5-2.5a.75.75 0 00-1.06 0z"/>
              </svg>
            </a>
          )}

          {/* Desktop links */}
          <ul className="hidden lg:flex items-center gap-1 flex-1">
            {links.map((link, i) => (
              <li key={i}>
                <a href={link.href ?? "#"} className="px-3 py-2 rounded-lg text-sm font-medium text-gray-600 dark:text-zinc-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors">
                  {link.label}
                </a>
              </li>
            ))}
          </ul>

          <div className="flex-1 hidden lg:block" />

          {/* Desktop CTAs */}
          <div className="hidden lg:flex items-center gap-3">
            {secondaryCta && (
              secondaryCta.href
                ? <a href={secondaryCta.href} className="text-sm font-medium text-gray-600 dark:text-zinc-400 hover:text-gray-900 dark:hover:text-white transition-colors px-3 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-zinc-800">{secondaryCta.label}</a>
                : <button type="button" onClick={secondaryCta.onClick} className="text-sm font-medium text-gray-600 dark:text-zinc-400 hover:text-gray-900 dark:hover:text-white transition-colors px-3 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-zinc-800">{secondaryCta.label}</button>
            )}
            {cta && (
              cta.href
                ? <a href={cta.href} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 active:bg-blue-800 shadow-sm hover:shadow-md transition-all">{cta.label}</a>
                : <button type="button" onClick={cta.onClick} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 shadow-sm hover:shadow-md transition-all">{cta.label}</button>
            )}
          </div>

          {/* Mobile */}
          <button
            type="button"
            className="lg:hidden ml-auto p-2 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-zinc-800"
            onClick={() => setMobileOpen(o => !o)}
            aria-label="Toggle menu"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
              {mobileOpen
                ? <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/>
                : <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16"/>
              }
            </svg>
          </button>
        </nav>

        {mobileOpen && (
          <div className="lg:hidden bg-white dark:bg-zinc-950 border-t border-gray-100 dark:border-zinc-800 px-4 py-4 flex flex-col gap-1">
            {links.map((link, i) => (
              <a key={i} href={link.href ?? "#"} onClick={() => setMobileOpen(false)}
                className="block px-3 py-2.5 rounded-lg text-sm font-medium text-gray-700 dark:text-zinc-200 hover:bg-gray-50 dark:hover:bg-zinc-800">
                {link.label}
              </a>
            ))}
            <div className="flex flex-col gap-2 mt-3 pt-3 border-t border-gray-100 dark:border-zinc-800">
              {secondaryCta && (
                secondaryCta.href
                  ? <a href={secondaryCta.href} className="w-full py-2.5 text-center text-sm font-medium text-gray-700 dark:text-zinc-200 border border-gray-200 dark:border-zinc-700 rounded-lg hover:bg-gray-50 dark:hover:bg-zinc-800" onClick={() => setMobileOpen(false)}>{secondaryCta.label}</a>
                  : <button type="button" onClick={() => { secondaryCta.onClick?.(); setMobileOpen(false); }} className="w-full py-2.5 text-center text-sm font-medium text-gray-700 dark:text-zinc-200 border border-gray-200 dark:border-zinc-700 rounded-lg hover:bg-gray-50 dark:hover:bg-zinc-800">{secondaryCta.label}</button>
              )}
              {cta && (
                cta.href
                  ? <a href={cta.href} className="w-full py-2.5 text-center bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 transition-colors" onClick={() => setMobileOpen(false)}>{cta.label}</a>
                  : <button type="button" onClick={() => { cta.onClick?.(); setMobileOpen(false); }} className="w-full py-2.5 text-center bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700">{cta.label}</button>
              )}
            </div>
          </div>
        )}
      </header>
      <div className="h-16" aria-hidden="true" />
    </>
  );
}