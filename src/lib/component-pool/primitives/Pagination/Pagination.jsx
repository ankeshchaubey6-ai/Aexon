import { cn } from "../../utils/cn.js";
import { usePagination } from "../../hooks/usePagination.js";

/**
 * Pagination — a fully-featured page navigator.
 * Wraps usePagination internally or accepts external pagination state.
 *
 * @param {number}   total
 * @param {number}   [pageSize=20]
 * @param {number}   [page]           - Controlled current page
 * @param {function} [onPageChange]
 * @param {number}   [initialPage=1]
 * @param {number}   [siblings=1]
 * @param {number}   [boundaries=1]
 * @param {"sm"|"md"|"lg"} [size="md"]
 * @param {"default"|"outline"|"ghost"} [variant="default"]
 * @param {boolean}  [showTotal=false]    - "Showing 1–20 of 247"
 * @param {boolean}  [showPageSize=false] - Page size selector
 * @param {number[]} [pageSizeOptions=[10,20,50,100]]
 *
 * @example
 * <Pagination total={247} pageSize={20} onPageChange={setPage} showTotal />
 */
export function Pagination({
  total,
  pageSize        = 20,
  page: controlled,
  onPageChange,
  initialPage     = 1,
  siblings        = 1,
  boundaries      = 1,
  size            = "md",
  variant         = "default",
  showTotal       = false,
  showPageSize    = false,
  pageSizeOptions = [10, 20, 50, 100],
  onPageSizeChange,
  className,
}) {
  const pagination = usePagination({
    total,
    pageSize,
    initialPage: controlled ?? initialPage,
    siblings,
    boundaries,
    onChange: onPageChange,
  });

  // If controlled, override
  const { page, totalPages, pages, from, to, hasPrev, hasNext, prev, next, setPage } = pagination;

  const btnSize = {
    sm: "h-7  min-w-[1.75rem] text-xs  px-2",
    md: "h-8  min-w-[2rem]    text-sm  px-2.5",
    lg: "h-10 min-w-[2.5rem]  text-base px-3",
  }[size] ?? "h-8 min-w-[2rem] text-sm px-2.5";

  const activeClass = {
    default: "bg-blue-600 text-white border-blue-600 dark:bg-blue-500 dark:border-blue-500 hover:bg-blue-700",
    outline: "border-2 border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400",
    ghost:   "bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300",
  }[variant];

  const idleClass = {
    default: "bg-white dark:bg-zinc-900 text-gray-700 dark:text-zinc-300 border border-gray-200 dark:border-zinc-700 hover:bg-gray-50 dark:hover:bg-zinc-800",
    outline: "border border-gray-200 dark:border-zinc-700 text-gray-700 dark:text-zinc-300 hover:border-gray-300",
    ghost:   "text-gray-600 dark:text-zinc-400 hover:bg-gray-100 dark:hover:bg-zinc-800",
  }[variant];

  const navClass = cn(
    "inline-flex items-center justify-center rounded-lg font-medium transition-colors",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500",
    "disabled:opacity-40 disabled:cursor-not-allowed",
    idleClass,
    btnSize,
  );

  if (totalPages <= 1 && !showTotal) return null;

  return (
    <div className={cn("flex flex-wrap items-center gap-3", className)}>
      {/* Total info */}
      {showTotal && (
        <p className="text-sm text-gray-600 dark:text-zinc-400 mr-auto">
          Showing <span className="font-medium">{from + 1}–{to}</span> of <span className="font-medium">{total}</span>
        </p>
      )}

      {/* Page size selector */}
      {showPageSize && (
        <select
          value={pageSize}
          onChange={(e) => onPageSizeChange?.(Number(e.target.value))}
          className="h-8 rounded-lg border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm px-2 text-gray-700 dark:text-zinc-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
          aria-label="Rows per page"
        >
          {pageSizeOptions.map(n => <option key={n} value={n}>{n} / page</option>)}
        </select>
      )}

      {totalPages > 1 && (
        <nav aria-label="Pagination" className="flex items-center gap-1">
          {/* Prev */}
          <button onClick={prev} disabled={!hasPrev} className={navClass} aria-label="Previous page">
            <svg viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4">
              <path fillRule="evenodd" d="M9.78 3.97a.75.75 0 010 1.06L7.81 7l1.97 1.97a.75.75 0 11-1.06 1.06l-2.5-2.5a.75.75 0 010-1.06l2.5-2.5a.75.75 0 011.06 0z"/>
            </svg>
          </button>

          {/* Page numbers */}
          {pages.map((p, i) =>
            p === "..." ? (
              <span key={`dot-${i}`} className={cn("inline-flex items-center justify-center", btnSize, "text-gray-400")}>…</span>
            ) : (
              <button
                key={p}
                onClick={() => setPage(p)}
                aria-label={`Page ${p}`}
                aria-current={p === page ? "page" : undefined}
                className={cn(
                  "inline-flex items-center justify-center rounded-lg font-medium transition-colors",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500",
                  btnSize,
                  p === page ? activeClass : idleClass,
                )}
              >
                {p}
              </button>
            )
          )}

          {/* Next */}
          <button onClick={next} disabled={!hasNext} className={navClass} aria-label="Next page">
            <svg viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4">
              <path fillRule="evenodd" d="M6.22 3.97a.75.75 0 000 1.06L8.19 7 6.22 8.97a.75.75 0 101.06 1.06l2.5-2.5a.75.75 0 000-1.06l-2.5-2.5a.75.75 0 00-1.06 0z"/>
            </svg>
          </button>
        </nav>
      )}
    </div>
  );
}