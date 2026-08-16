import { useState, useRef } from "react";
import { cn } from "../../utils/cn.js";
import { useClickOutside } from "../../hooks/useClickOutside.js";
import { useKeyboard } from "../../hooks/useKeyboard.js";
import { useScroll } from "../../hooks/useScroll.js";
import { useScrollLock } from "../../hooks/useScrollLock.js";

/**
 * MegaMenu — a full-width navigation bar with expandable mega-menu panels.
 * Each nav item can open a multi-column dropdown with rich content.
 *
 * @param {React.ReactNode} logo
 * @param {{
 *   label: string,
 *   href?: string,
 *   columns?: {
 *     heading?: string,
 *     items: { label, description?, href, icon?, badge? }[]
 *   }[],
 *   featured?: { label, description, href, image?, cta? },
 * }[]} items
 * @param {{ label, href?, variant?, onClick? }[]} [actions=[]]
 *
 * @example
 * <MegaMenu
 *   logo={<Logo />}
 *   items={[
 *     { label: "Products", columns: [
 *       { heading: "Core", items: [
 *         { label: "Builder",  description: "Drag-and-drop site builder", href: "/builder",  icon: <GridIcon/> },
 *         { label: "Analytics",description: "Real-time visitor insights", href: "/analytics",icon: <BarIcon/>  },
 *       ]},
 *       { heading: "Add-ons", items: [
 *         { label: "CMS",  description: "Headless content management", href: "/cms"  },
 *         { label: "Store",description: "Sell products online",         href: "/store"},
 *       ]},
 *     ],
 *     featured: { label: "New: AI Builder", description: "Generate sites from a prompt.", href: "/ai", cta: "Try free →" }
 *     },
 *     { label: "Pricing", href: "/pricing" },
 *   ]}
 *   actions={[{ label: "Sign in", href: "/sign-in", variant: "ghost" }, { label: "Get started", href: "/sign-up" }]}
 * />
 */
export function MegaMenu({
  logo,
  items       = [],
  actions     = [],
  className,
}) {
  const [activeIdx, setActiveIdx] = useState(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mobileExpanded, setMobileExpanded] = useState(null);
  const navRef = useRef(null);
  const { y }  = useScroll();

  useScrollLock(mobileOpen);
  useClickOutside(navRef, () => setActiveIdx(null));
  useKeyboard({ Escape: () => { setActiveIdx(null); setMobileOpen(false); } });

  const scrolled = y > 8 || mobileOpen;

  const activeItem = activeIdx !== null ? items[activeIdx] : null;
  const hasDropdown = activeItem?.columns?.length > 0 || activeItem?.featured;

  return (
    <>
      <header
        ref={navRef}
        className={cn(
          "fixed top-0 left-0 right-0 z-40 transition-all duration-300",
          scrolled
            ? "bg-white/95 dark:bg-zinc-950/95 backdrop-blur-md border-b border-gray-100 dark:border-zinc-800 shadow-sm"
            : "bg-transparent",
          className,
        )}
      >
        {/* Top bar */}
        <nav
          aria-label="Main navigation"
          className="container mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center gap-6"
        >
          {/* Logo */}
          <div className="shrink-0 mr-2">
            {logo ?? <span className="text-xl font-bold text-gray-900 dark:text-white">Brand</span>}
          </div>

          {/* Desktop nav items */}
          <ul className="hidden lg:flex items-center gap-0.5 flex-1">
            {items.map((item, i) => {
              const hasMenu = (item.columns?.length > 0) || item.featured;
              const isActive = activeIdx === i;
              return (
                <li key={i} className="relative">
                  {hasMenu ? (
                    <button
                      type="button"
                      aria-expanded={isActive}
                      aria-haspopup="true"
                      onClick={() => setActiveIdx(isActive ? null : i)}
                      className={cn(
                        "flex items-center gap-1 px-3.5 py-2 rounded-lg text-sm font-medium transition-colors",
                        isActive
                          ? "text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950"
                          : "text-gray-600 dark:text-zinc-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-zinc-800",
                      )}
                    >
                      {item.label}
                      <svg
                        viewBox="0 0 16 16" fill="currentColor"
                        className={cn("w-3.5 h-3.5 transition-transform duration-150", isActive && "rotate-180")}
                      >
                        <path fillRule="evenodd" d="M4.22 6.22a.75.75 0 011.06 0L8 8.94l2.72-2.72a.75.75 0 111.06 1.06l-3.25 3.25a.75.75 0 01-1.06 0L4.22 7.28a.75.75 0 010-1.06z"/>
                      </svg>
                    </button>
                  ) : (
                    <a
                      href={item.href ?? "#"}
                      className="px-3.5 py-2 rounded-lg text-sm font-medium text-gray-600 dark:text-zinc-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors"
                    >
                      {item.label}
                    </a>
                  )}
                </li>
              );
            })}
          </ul>

          <div className="flex-1 hidden lg:block" />

          {/* Desktop actions */}
          <div className="hidden lg:flex items-center gap-2">
            {actions.map(({ label, href, variant = "primary", onClick }, i) => {
              const cls = {
                primary:   "px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 transition-colors shadow-sm",
                secondary: "px-4 py-2 bg-white dark:bg-zinc-800 text-gray-700 dark:text-zinc-100 border border-gray-200 dark:border-zinc-700 rounded-lg text-sm font-semibold hover:bg-gray-50 dark:hover:bg-zinc-700 transition-colors",
                ghost:     "px-4 py-2 text-gray-600 dark:text-zinc-400 text-sm font-medium hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-lg transition-colors",
              }[variant] ?? "";
              return href
                ? <a key={i} href={href} className={cls}>{label}</a>
                : <button key={i} type="button" onClick={onClick} className={cls}>{label}</button>;
            })}
          </div>

          {/* Mobile toggle */}
          <button
            type="button"
            className="lg:hidden ml-auto p-2 rounded-lg text-gray-500 dark:text-zinc-400 hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors"
            onClick={() => setMobileOpen(o => !o)}
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
            aria-expanded={mobileOpen}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
              {mobileOpen
                ? <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/>
                : <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16"/>
              }
            </svg>
          </button>
        </nav>

        {/* ── Desktop mega-menu panel ─────────────────────────────────────── */}
        {activeIdx !== null && hasDropdown && (
          <div
            className={cn(
              "hidden lg:block w-full border-t border-gray-100 dark:border-zinc-800",
              "bg-white dark:bg-zinc-950 shadow-xl",
              "animate-in fade-in slide-in-from-top-1 duration-150",
            )}
          >
            <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
              <div className={cn(
                "grid gap-8",
                activeItem?.featured
                  ? "lg:grid-cols-[1fr_280px]"
                  : "lg:grid-cols-1",
              )}>
                {/* Columns */}
                <div className={cn(
                  "grid gap-8",
                  `grid-cols-${Math.min(activeItem?.columns?.length ?? 1, 4)}`,
                )}>
                  {activeItem?.columns?.map((col, ci) => (
                    <div key={ci}>
                      {col.heading && (
                        <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-gray-400 dark:text-zinc-500">
                          {col.heading}
                        </p>
                      )}
                      <ul className="flex flex-col gap-0.5">
                        {col.items.map((item, ii) => (
                          <li key={ii}>
                            <a
                              href={item.href ?? "#"}
                              onClick={() => setActiveIdx(null)}
                              className="flex items-start gap-3 px-3 py-2.5 rounded-xl hover:bg-gray-50 dark:hover:bg-zinc-900 transition-colors group"
                            >
                              {item.icon && (
                                <span className="shrink-0 w-9 h-9 mt-0.5 rounded-xl bg-blue-50 dark:bg-blue-950 flex items-center justify-center text-blue-600 dark:text-blue-400 group-hover:bg-blue-100 dark:group-hover:bg-blue-900 transition-colors">
                                  {item.icon}
                                </span>
                              )}
                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-semibold text-gray-900 dark:text-zinc-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                                    {item.label}
                                  </span>
                                  {item.badge && (
                                    <span className="px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300">
                                      {item.badge}
                                    </span>
                                  )}
                                </div>
                                {item.description && (
                                  <p className="text-xs text-gray-500 dark:text-zinc-400 mt-0.5 leading-snug line-clamp-2">
                                    {item.description}
                                  </p>
                                )}
                              </div>
                            </a>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>

                {/* Featured card */}
                {activeItem?.featured && (
                  <a
                    href={activeItem.featured.href ?? "#"}
                    onClick={() => setActiveIdx(null)}
                    className="group flex flex-col gap-3 p-5 rounded-2xl bg-gradient-to-br from-blue-50 to-violet-50 dark:from-blue-950/50 dark:to-violet-950/50 border border-blue-100 dark:border-blue-900 hover:border-blue-300 dark:hover:border-blue-700 transition-all"
                  >
                    {activeItem.featured.image && (
                      <img
                        src={activeItem.featured.image}
                        alt={activeItem.featured.label}
                        className="w-full h-32 object-cover rounded-xl"
                      />
                    )}
                    <div>
                      <p className="text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wider mb-1">
                        Featured
                      </p>
                      <p className="text-sm font-bold text-gray-900 dark:text-zinc-100 group-hover:text-blue-700 dark:group-hover:text-blue-300 transition-colors">
                        {activeItem.featured.label}
                      </p>
                      {activeItem.featured.description && (
                        <p className="text-xs text-gray-500 dark:text-zinc-400 mt-1 leading-relaxed">
                          {activeItem.featured.description}
                        </p>
                      )}
                    </div>
                    {activeItem.featured.cta && (
                      <span className="inline-flex items-center gap-1 text-sm font-semibold text-blue-600 dark:text-blue-400">
                        {activeItem.featured.cta}
                        <svg viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform">
                          <path fillRule="evenodd" d="M6.22 3.97a.75.75 0 000 1.06L8.19 7 6.22 8.97a.75.75 0 101.06 1.06l2.5-2.5a.75.75 0 000-1.06l-2.5-2.5a.75.75 0 00-1.06 0z"/>
                        </svg>
                      </span>
                    )}
                  </a>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── Mobile menu ──────────────────────────────────────────────────── */}
        {mobileOpen && (
          <div className="lg:hidden bg-white dark:bg-zinc-950 border-t border-gray-100 dark:border-zinc-800 max-h-[80vh] overflow-y-auto">
            <div className="px-4 py-3 flex flex-col gap-1">
              {items.map((item, i) => {
                const hasMenu = (item.columns?.length > 0) || item.featured;
                const isExpanded = mobileExpanded === i;
                return (
                  <div key={i}>
                    {hasMenu ? (
                      <>
                        <button
                          type="button"
                          onClick={() => setMobileExpanded(isExpanded ? null : i)}
                          className="flex items-center justify-between w-full px-3 py-2.5 rounded-lg text-sm font-medium text-gray-700 dark:text-zinc-200 hover:bg-gray-50 dark:hover:bg-zinc-800"
                        >
                          {item.label}
                          <svg viewBox="0 0 16 16" fill="currentColor" className={cn("w-4 h-4 text-gray-400 transition-transform", isExpanded && "rotate-180")}>
                            <path fillRule="evenodd" d="M4.22 6.22a.75.75 0 011.06 0L8 8.94l2.72-2.72a.75.75 0 111.06 1.06l-3.25 3.25a.75.75 0 01-1.06 0L4.22 7.28a.75.75 0 010-1.06z"/>
                          </svg>
                        </button>
                        {isExpanded && (
                          <div className="pl-4 mt-1 flex flex-col gap-0.5">
                            {item.columns?.flatMap(col => col.items).map((child, ci) => (
                              <a
                                key={ci}
                                href={child.href ?? "#"}
                                onClick={() => setMobileOpen(false)}
                                className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-gray-600 dark:text-zinc-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-zinc-800"
                              >
                                {child.label}
                              </a>
                            ))}
                          </div>
                        )}
                      </>
                    ) : (
                      <a
                        href={item.href ?? "#"}
                        onClick={() => setMobileOpen(false)}
                        className="block px-3 py-2.5 rounded-lg text-sm font-medium text-gray-700 dark:text-zinc-200 hover:bg-gray-50 dark:hover:bg-zinc-800"
                      >
                        {item.label}
                      </a>
                    )}
                  </div>
                );
              })}
            </div>
            {actions.length > 0 && (
              <div className="px-4 pb-4 pt-2 flex flex-col gap-2 border-t border-gray-100 dark:border-zinc-800">
                {actions.map(({ label, href, variant = "primary", onClick }, i) => {
                  const cls = {
                    primary:   "w-full py-2.5 text-center bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700",
                    secondary: "w-full py-2.5 text-center border border-gray-200 dark:border-zinc-700 text-gray-700 dark:text-zinc-200 rounded-lg text-sm font-semibold hover:bg-gray-50 dark:hover:bg-zinc-800",
                    ghost:     "w-full py-2.5 text-center text-gray-600 dark:text-zinc-400 text-sm font-medium hover:text-gray-900 dark:hover:text-white",
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