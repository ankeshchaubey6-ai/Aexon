import { useState } from "react";
import { cn } from "../../utils/cn.js";

/**
 * SidebarNav — a vertical navigation sidebar for dashboards and app shells.
 * Supports collapsing to icon-only mode, grouped sections, and active state.
 *
 * @param {{ section?: string, items: { label: string, href?: string, icon?: ReactNode, badge?: string|number, active?: boolean, onClick?: fn }[] }[]} groups
 * @param {React.ReactNode} [logo]
 * @param {React.ReactNode} [footer]     - Bottom slot (user info, settings, logout)
 * @param {boolean}         [collapsed=false]
 * @param {function}        [onCollapse]
 * @param {string}          [activeHref]  - Auto-highlights matching hrefs
 *
 * @example
 * <SidebarNav
 *   logo={<Logo />}
 *   groups={[
 *     {
 *       items: [
 *         { label: "Dashboard", href: "/", icon: <HomeIcon size={18}/>, active: true },
 *         { label: "Analytics", href: "/analytics", icon: <ChartIcon size={18}/> },
 *       ]
 *     },
 *     {
 *       section: "Settings",
 *       items: [
 *         { label: "Profile", href: "/settings/profile", icon: <UserIcon size={18}/> },
 *         { label: "Team",    href: "/settings/team",    icon: <UsersIcon size={18}/> },
 *       ]
 *     }
 *   ]}
 *   footer={<UserFooter />}
 * />
 */
export function SidebarNav({
  groups      = [],
  logo,
  footer,
  collapsed   = false,
  onCollapse,
  activeHref,
  className,
}) {
  const [localCollapsed, setLocalCollapsed] = useState(collapsed);
  const isCollapsed = onCollapse ? collapsed : localCollapsed;

  const toggle = () => {
    if (onCollapse) onCollapse(!isCollapsed);
    else setLocalCollapsed(c => !c);
  };

  return (
    <aside
      className={cn(
        "flex flex-col h-full bg-white dark:bg-zinc-900 border-r border-gray-200 dark:border-zinc-800",
        "transition-all duration-300 overflow-hidden",
        isCollapsed ? "w-16" : "w-64",
        className,
      )}
      aria-label="Sidebar navigation"
    >
      {/* Logo + collapse toggle */}
      <div className={cn(
        "flex items-center shrink-0 h-16 border-b border-gray-100 dark:border-zinc-800 px-4",
        isCollapsed ? "justify-center" : "justify-between",
      )}>
        {!isCollapsed && (
          <div className="flex-1 min-w-0 overflow-hidden">
            {logo ?? <span className="text-base font-bold text-gray-900 dark:text-white truncate">Brand</span>}
          </div>
        )}
        <button
          type="button"
          onClick={toggle}
          aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          className="shrink-0 p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-zinc-200 hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors"
        >
          <svg viewBox="0 0 16 16" fill="currentColor" className={cn("w-4 h-4 transition-transform", isCollapsed && "rotate-180")}>
            <path fillRule="evenodd" d="M9.78 3.97a.75.75 0 010 1.06L7.81 7l1.97 1.97a.75.75 0 11-1.06 1.06l-2.5-2.5a.75.75 0 010-1.06l2.5-2.5a.75.75 0 011.06 0z"/>
          </svg>
        </button>
      </div>

      {/* Nav groups */}
      <nav className="flex-1 overflow-y-auto py-3 px-2 flex flex-col gap-4">
        {groups.map((group, gi) => (
          <div key={gi}>
            {/* Section label */}
            {group.section && !isCollapsed && (
              <p className="px-3 mb-1 text-[10px] font-semibold uppercase tracking-widest text-gray-400 dark:text-zinc-500">
                {group.section}
              </p>
            )}
            {group.section && isCollapsed && (
              <div className="my-1 border-t border-gray-100 dark:border-zinc-800" />
            )}

            <ul className="flex flex-col gap-0.5">
              {group.items.map((item, ii) => {
                const isActive = item.active || (activeHref && item.href === activeHref);
                const El = item.href ? "a" : "button";

                return (
                  <li key={ii}>
                    <El
                      href={item.href}
                      type={!item.href ? "button" : undefined}
                      onClick={item.onClick}
                      aria-current={isActive ? "page" : undefined}
                      title={isCollapsed ? item.label : undefined}
                      className={cn(
                        "flex items-center gap-3 w-full rounded-lg transition-colors duration-150",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500",
                        isCollapsed ? "justify-center p-2.5" : "px-3 py-2",
                        isActive
                          ? "bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300"
                          : "text-gray-600 dark:text-zinc-400 hover:bg-gray-100 dark:hover:bg-zinc-800 hover:text-gray-900 dark:hover:text-white",
                      )}
                    >
                      {item.icon && (
                        <span className={cn("shrink-0 flex items-center justify-center", isActive && "text-blue-600 dark:text-blue-400")}>
                          {item.icon}
                        </span>
                      )}

                      {!isCollapsed && (
                        <span className="flex-1 text-sm font-medium truncate">{item.label}</span>
                      )}

                      {!isCollapsed && item.badge != null && (
                        <span className={cn(
                          "ml-auto shrink-0 inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1.5 rounded-full text-[10px] font-semibold",
                          isActive
                            ? "bg-blue-600 text-white"
                            : "bg-gray-200 dark:bg-zinc-700 text-gray-700 dark:text-zinc-300",
                        )}>
                          {item.badge}
                        </span>
                      )}
                    </El>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* Footer slot */}
      {footer && (
        <div className={cn(
          "shrink-0 border-t border-gray-100 dark:border-zinc-800 p-3",
          isCollapsed && "flex justify-center",
        )}>
          {footer}
        </div>
      )}
    </aside>
  );
}