import { cn } from "../../utils/cn.js";

export function Footer({ logo, tagline, columns = [], legal = [], socials = [], className }) {
  return (
    <footer className={cn("border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950", className)}>
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid gap-10 lg:grid-cols-[240px_1fr]">
          <div>
            {logo}
            {tagline && <p className="mt-3 text-sm text-gray-500 dark:text-gray-400 max-w-xs leading-relaxed">{tagline}</p>}
            {socials.length > 0 && (
              <div className="mt-5 flex items-center gap-3">
                {socials.map(({ icon: Icon, href, label }, i) => (
                  <a key={i} href={href} aria-label={label} className="w-9 h-9 rounded-lg flex items-center justify-center text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
                    <Icon size={18}/>
                  </a>
                ))}
              </div>
            )}
          </div>
          <div className={cn("grid gap-8", columns.length <= 3 ? `sm:grid-cols-${columns.length}` : "sm:grid-cols-2 lg:grid-cols-4")}>
            {columns.map(({ heading, links }, i) => (
              <div key={i}>
                <p className="text-sm font-semibold text-gray-900 dark:text-white">{heading}</p>
                <ul className="mt-4 space-y-2.5">
                  {links.map(({ label, href }, j) => (
                    <li key={j}><a href={href} className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors">{label}</a></li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
        {legal.length > 0 && (
          <div className="mt-12 pt-8 border-t border-gray-200 dark:border-gray-800 flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-xs text-gray-500 dark:text-gray-400">© {new Date().getFullYear()} All rights reserved.</p>
            <div className="flex gap-4">
              {legal.map(({ label, href }, i) => (
                <a key={i} href={href} className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white">{label}</a>
              ))}
            </div>
          </div>
        )}
      </div>
    </footer>
  );
}
