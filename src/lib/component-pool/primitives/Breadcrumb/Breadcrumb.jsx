import { cn } from "../../utils/cn.js";

/**
 * Breadcrumb — accessible landmark navigation (aria-label="breadcrumb").
 *
 * @param {{ label: string, href?: string, icon?: ReactNode }[]} items
 * @param {React.ReactNode} [separator] - Custom separator (default /)
 * @param {"sm"|"md"|"lg"} [size="md"]
 * @param {boolean} [ellipsis=false]   - Collapse middle items on mobile
 *
 * @example
 * <Breadcrumb items={[
 *   { label: "Home",     href: "/" },
 *   { label: "Products", href: "/products" },
 *   { label: "Sneakers" },          // current — no href
 * ]} />
 */
export function Breadcrumb({
  items     = [],
  separator,
  size      = "md",
  ellipsis  = false,
  className,
  ...props
}) {
  const textSize = { sm: "text-xs", md: "text-sm", lg: "text-base" }[size] ?? "text-sm";

  const DefaultSeparator = () => (
    <svg viewBox="0 0 16 16" fill="currentColor" className="w-3 h-3 text-gray-300 dark:text-zinc-600 shrink-0">
      <path fillRule="evenodd" d="M6.22 3.97a.75.75 0 000 1.06L8.19 7 6.22 8.97a.75.75 0 101.06 1.06l2.5-2.5a.75.75 0 000-1.06l-2.5-2.5a.75.75 0 00-1.06 0z"/>
    </svg>
  );

  const Sep = separator ?? <DefaultSeparator />;

  return (
    <nav aria-label="breadcrumb" className={cn(className)} {...props}>
      <ol className={cn("flex flex-wrap items-center gap-1", textSize)}>
        {items.map((item, i) => {
          const isLast = i === items.length - 1;
          return (
            <li key={i} className="flex items-center gap-1">
              {i > 0 && <span aria-hidden="true">{Sep}</span>}
              {isLast ? (
                <span
                  className="font-medium text-gray-900 dark:text-zinc-100 truncate max-w-[200px]"
                  aria-current="page"
                >
                  {item.icon && <span className="mr-1 inline-flex items-center">{item.icon}</span>}
                  {item.label}
                </span>
              ) : (
                <a
                  href={item.href ?? "#"}
                  className="flex items-center gap-1 text-gray-500 dark:text-zinc-400 hover:text-gray-700 dark:hover:text-zinc-200 transition-colors truncate max-w-[160px]"
                >
                  {item.icon && <span className="shrink-0">{item.icon}</span>}
                  {item.label}
                </a>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}