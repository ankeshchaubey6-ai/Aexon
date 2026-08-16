import { useState, useRef } from "react";
import { cn } from "../../utils/cn.js";
import { useScroll } from "../../hooks/useScroll.js";
import { useClickOutside } from "../../hooks/useClickOutside.js";
import { useScrollLock } from "../../hooks/useScrollLock.js";

/**
 * Navbar — sticky top navigation with:
 * - Scroll-aware frosted-glass background
 * - Dropdown mega-menus on desktop
 * - Full-height slide-in mobile drawer
 * - CTA button slot
 * - Logo slot
 *
 * @param {React.ReactNode} logo
 * @param {{ label: string, href?: string, children?: { label, href, description?, icon? }[] }[]} links
 * @param {{ label: string, href?: string, variant?: string, onClick?: fn }[]} [actions=[]]
 * @param {React.ReactNode} [announcement] - Optional slim bar above nav
 * @param {boolean} [transparent=false]    - Start fully transparent (hero pages)
 *
 * @example
 * <Navbar
 *   logo={<Logo />}
 *   links={[
 *     { label: "Product", href: "/product" },
 *     { label: "Solutions", children: [
 *       { label: "For startups", href: "/startups", description: "Launch faster" },
 *       { label: "For enterprise", href: "/enterprise", description: "Scale with confidence" },
 *     ]},
 *     { label: "Pricing", href: "/pricing" },
 *   ]}
 *   actions={[
 *     { label: "Sign in",     href: "/sign-in",  variant: "ghost" },
 *     { label: "Get started", href: "/sign-up",  variant: "primary" },
 *   ]}
 * />
 */
export function Navbar({
  logo,
  links       = [],
  actions     = [],
  announcement,
  transparent = false,
  className,
}) {
  const { y }                       = useScroll();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [activeDropdown, setActiveDD] = useState(null);
  const navRef  = useRef(null);
  const scrolled = y > 16;

  useScrollLock(mobileOpen);
  useClickOutside(navRef, () => { setActiveDD(null); });

  const isScrolled = scrolled || mobileOpen;

  return (
    <>
      {announcement && (
        <div className="w-full bg-blue-600 text-white text-center text-xs font-medium py-2 px-4">
          {announcement}
        </div>
      )}

      <header
        ref={navRef}
        className={cn(
          "fixed top-0 left-0 right-0 z-40 transition-all duration-300",
          announcement && "top-8",
          isScrolled || !transparent
            ? "bg-white/90 dark:bg-zinc-950/90 backdrop-blur-md shadow-sm border-b border-gray-100 dark:border-zinc-800"
            : "bg-transparent",
          className,
        )}
      >
        <nav
          aria-label="Main navigation"
          className="container mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center gap-6"
        >
          {/* Logo */}
          <div className="shrink-0 mr-2">
            {logo ?? (
              <span className="text-xl font-bold text-gray-900 dark:text-white">Brand</span>
            )}
          </div>

          {/* Desktop links */}
          <ul className="hidden lg:flex items-center gap-1 flex-1">
            {links.map((link, i) => (
              <li key={i} className="relative">
                {link.children ? (
                  <div>
                    <button
                      type="button"
                      onClick={() => setActiveDD(activeDropdown === i ? null : i)}
                      onKeyDown={(e) => e.key === "Escape" && setActiveDD(null)}
                      aria-expanded={activeDropdown === i}
                      aria-haspopup="true"
                      className={cn(
                        "flex items-center gap-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                        "text-gray-600 dark:text-zinc-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-zinc-800",
                        activeDropdown === i && "text-gray-900 dark:text-white bg-gray-100 dark:bg-zinc-800",
                      )}
                    >
                      {link.label}
                      <svg
                        viewBox="0 0 16 16" fill="currentColor"
                        className={cn("w-3.5 h-3.5 transition-transform duration-150", activeDropdown === i && "rotate-180")}
                      >
                        <path fillRule="evenodd" d="M4.22 6.22a.75.75 0 011.06 0L8 8.94l2.72-2.72a.75.75 0 111.06 1.06l-3.25 3.25a.75.75 0 01-1.06 0L4.22 7.28a.75.75 0 010-1.06z"/>
                      </svg>
                    </button>

                    {/* Dropdown */}
                    {activeDropdown === i && (
                      <div className="absolute top-full left-0 mt-1 w-64 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-xl shadow-xl p-2 animate-in fade-in zoom-in-95 duration-150">
                        {link.children.map((child, j) => (
                          <a
                            key={j}
                            href={child.href ?? "#"}
                            onClick={() => setActiveDD(null)}
                            className="flex items-start gap-3 px-3 py-2.5 rounded-lg hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors group"
                          >
                            {child.icon && (
                              <span className="shrink-0 w-8 h-8 mt-0.5 rounded-lg bg-blue-50 dark:bg-blue-950 flex items-center justify-center text-blue-600 dark:text-blue-400">
                                {child.icon}
                              </span>
                            )}
                            <div>
                              <p className="text-sm font-medium text-gray-900 dark:text-zinc-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                                {child.label}
                              </p>
                              {child.description && (
                                <p className="text-xs text-gray-500 dark:text-zinc-400 mt-0.5 leading-snug">
                                  {child.description}
                                </p>
                              )}
                            </div>
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <a
                    href={link.href ?? "#"}
                    className="px-3 py-2 rounded-lg text-sm font-medium text-gray-600 dark:text-zinc-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors"
                  >
                    {link.label}
                  </a>
                )}
              </li>
            ))}
          </ul>

          {/* Spacer */}
          <div className="flex-1 hidden lg:block" />

          {/* Desktop actions */}
          <div className="hidden lg:flex items-center gap-2">
            {actions.map(({ label, href, variant = "primary", onClick }, i) => {
              const cls = {
                primary:   "px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors",
                secondary: "px-4 py-2 bg-white text-gray-700 border border-gray-200 rounded-lg text-sm font-medium hover:bg-gray-50 dark:bg-zinc-800 dark:text-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-700 transition-colors",
                ghost:     "px-4 py-2 text-gray-600 dark:text-zinc-400 text-sm font-medium hover:text-gray-900 dark:hover:text-white transition-colors rounded-lg hover:bg-gray-100 dark:hover:bg-zinc-800",
              }[variant] ?? "";

              return href ? (
                <a key={i} href={href} className={cls}>{label}</a>
              ) : (
                <button key={i} type="button" onClick={onClick} className={cls}>{label}</button>
              );
            })}
          </div>

          {/* Mobile hamburger */}
          <button
            type="button"
            className="lg:hidden ml-auto p-2 rounded-lg text-gray-600 dark:text-zinc-400 hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors"
            onClick={() => setMobileOpen(o => !o)}
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
            aria-expanded={mobileOpen}
          >
            {mobileOpen ? (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/>
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16"/>
              </svg>
            )}
          </button>
        </nav>

        {/* Mobile drawer */}
        {mobileOpen && (
          <div className="lg:hidden bg-white dark:bg-zinc-950 border-t border-gray-100 dark:border-zinc-800 max-h-[80vh] overflow-y-auto">
            <div className="px-4 py-4 flex flex-col gap-1">
              {links.map((link, i) => (
                <div key={i}>
                  {link.children ? (
                    <div>
                      <p className="px-3 py-2 text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-zinc-500">
                        {link.label}
                      </p>
                      {link.children.map((child, j) => (
                        <a
                          key={j}
                          href={child.href ?? "#"}
                          onClick={() => setMobileOpen(false)}
                          className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-gray-700 dark:text-zinc-200 hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors"
                        >
                          {child.label}
                        </a>
                      ))}
                    </div>
                  ) : (
                    <a
                      href={link.href ?? "#"}
                      onClick={() => setMobileOpen(false)}
                      className="block px-3 py-2 rounded-lg text-sm font-medium text-gray-700 dark:text-zinc-200 hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors"
                    >
                      {link.label}
                    </a>
                  )}
                </div>
              ))}
            </div>
            {actions.length > 0 && (
              <div className="px-4 pb-4 flex flex-col gap-2 border-t border-gray-100 dark:border-zinc-800 pt-4">
                {actions.map(({ label, href, variant = "primary", onClick }, i) => {
                  const cls = {
                    primary:   "w-full py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium text-center hover:bg-blue-700 transition-colors",
                    secondary: "w-full py-2.5 bg-white text-gray-700 border border-gray-200 dark:bg-zinc-800 dark:text-zinc-100 dark:border-zinc-700 rounded-lg text-sm font-medium text-center hover:bg-gray-50 dark:hover:bg-zinc-700 transition-colors",
                    ghost:     "w-full py-2.5 text-gray-600 dark:text-zinc-400 text-sm font-medium text-center hover:bg-gray-50 dark:hover:bg-zinc-800 rounded-lg transition-colors",
                  }[variant] ?? "";

                  return href ? (
                    <a key={i} href={href} className={cls} onClick={() => setMobileOpen(false)}>{label}</a>
                  ) : (
                    <button key={i} type="button" onClick={() => { onClick?.(); setMobileOpen(false); }} className={cls}>{label}</button>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </header>

      {/* Spacer so content starts below the fixed nav */}
      <div className={cn("h-16", announcement && "mt-8")} aria-hidden="true" />
    </>
  );
}