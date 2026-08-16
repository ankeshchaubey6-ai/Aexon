import { useState } from "react";
import { cn } from "../../utils/cn.js";
import { useScroll } from "../../hooks/useScroll.js";
import { useScrollLock } from "../../hooks/useScrollLock.js";

/**
 * NavbarCentered — a centered-logo navigation layout.
 * Links are split into left and right groups flanking the logo.
 *
 * @param {React.ReactNode} logo
 * @param {{ label: string, href: string }[]} leftLinks
 * @param {{ label: string, href: string }[]} rightLinks
 * @param {{ label: string, href?: string, variant?: string, onClick?: fn }[]} [actions=[]]
 *
 * @example
 * <NavbarCentered
 *   logo={<Logo />}
 *   leftLinks={[{ label: "Features", href: "#features" }, { label: "Pricing", href: "#pricing" }]}
 *   rightLinks={[{ label: "Blog", href: "/blog" }, { label: "Docs", href: "/docs" }]}
 *   actions={[{ label: "Sign in", href: "/sign-in", variant: "ghost" }, { label: "Get started", href: "/sign-up" }]}
 * />
 */
export function NavbarCentered({
  logo,
  leftLinks  = [],
  rightLinks = [],
  actions    = [],
  className,
}) {
  const { y }                       = useScroll();
  const [mobileOpen, setMobileOpen] = useState(false);
  useScrollLock(mobileOpen);

  const allLinks = [...leftLinks, ...rightLinks];

  return (
    <>
      <header
        className={cn(
          "fixed top-0 left-0 right-0 z-40 transition-all duration-300",
          y > 16 || mobileOpen
            ? "bg-white/90 dark:bg-zinc-950/90 backdrop-blur-md shadow-sm border-b border-gray-100 dark:border-zinc-800"
            : "bg-transparent",
          className,
        )}
      >
        <nav aria-label="Main navigation" className="container mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center">
          {/* Left links */}
          <ul className="hidden lg:flex items-center gap-1 flex-1">
            {leftLinks.map((link, i) => (
              <li key={i}>
                <a href={link.href} className="px-3 py-2 rounded-lg text-sm font-medium text-gray-600 dark:text-zinc-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors">
                  {link.label}
                </a>
              </li>
            ))}
          </ul>

          {/* Centered logo */}
          <div className="absolute left-1/2 -translate-x-1/2">
            {logo ?? <span className="text-xl font-bold text-gray-900 dark:text-white">Brand</span>}
          </div>

          {/* Right links + actions */}
          <div className="hidden lg:flex items-center gap-1 flex-1 justify-end">
            {rightLinks.map((link, i) => (
              <a key={i} href={link.href} className="px-3 py-2 rounded-lg text-sm font-medium text-gray-600 dark:text-zinc-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors">
                {link.label}
              </a>
            ))}
            <div className="ml-2 flex items-center gap-2">
              {actions.map(({ label, href, variant = "primary", onClick }, i) => {
                const cls = {
                  primary:   "px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors",
                  ghost:     "px-4 py-2 text-gray-600 dark:text-zinc-400 text-sm font-medium hover:text-gray-900 dark:hover:text-white rounded-lg hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors",
                  secondary: "px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 dark:bg-zinc-800 dark:text-zinc-100 dark:border-zinc-700 transition-colors",
                }[variant] ?? "";
                return href
                  ? <a key={i} href={href} className={cls}>{label}</a>
                  : <button key={i} type="button" onClick={onClick} className={cls}>{label}</button>;
              })}
            </div>
          </div>

          {/* Mobile burger */}
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

        {/* Mobile panel */}
        {mobileOpen && (
          <div className="lg:hidden bg-white dark:bg-zinc-950 border-t border-gray-100 dark:border-zinc-800 px-4 py-4 flex flex-col gap-1">
            {allLinks.map((link, i) => (
              <a key={i} href={link.href} onClick={() => setMobileOpen(false)}
                className="block px-3 py-2 rounded-lg text-sm font-medium text-gray-700 dark:text-zinc-200 hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors">
                {link.label}
              </a>
            ))}
            {actions.length > 0 && (
              <div className="flex flex-col gap-2 mt-3 pt-3 border-t border-gray-100 dark:border-zinc-800">
                {actions.map(({ label, href, variant = "primary", onClick }, i) => {
                  const cls = {
                    primary:   "w-full py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium text-center hover:bg-blue-700 transition-colors",
                    ghost:     "w-full py-2.5 text-gray-600 dark:text-zinc-400 text-sm font-medium text-center hover:bg-gray-50 dark:hover:bg-zinc-800 rounded-lg transition-colors",
                    secondary: "w-full py-2.5 border border-gray-200 text-gray-700 dark:text-zinc-100 dark:border-zinc-700 dark:bg-zinc-800 rounded-lg text-sm font-medium text-center hover:bg-gray-50 dark:hover:bg-zinc-700 transition-colors",
                  }[variant] ?? "";
                  return href
                    ? <a key={i} href={href} className={cls} onClick={() => setMobileOpen(false)}>{label}</a>
                    : <button key={i} type="button" onClick={() => { onClick?.(); setMobileOpen(false); }} className={cls}>{label}</button>;
                })}
              </div>
            )}
          </div>
        )}
      </header>
      <div className="h-16" aria-hidden="true" />
    </>
  );
}