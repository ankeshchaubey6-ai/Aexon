import { useState, useMemo, useCallback } from "react";

/**
 * Full pagination logic — page number, window of visible pages, navigation.
 *
 * @param {object} options
 * @param {number} options.total          - Total number of items
 * @param {number} [options.pageSize=20]  - Items per page
 * @param {number} [options.initialPage=1]- Starting page (1-indexed)
 * @param {number} [options.siblings=1]   - Pages shown on each side of current page
 * @param {number} [options.boundaries=1] - Pages always shown at start/end
 * @param {function} [options.onChange]   - Called with new page number when it changes
 *
 * @returns {{
 *   page:       number,          - Current page (1-indexed)
 *   totalPages: number,
 *   pages:      (number|"...")[],- Page numbers to render (includes "..." for gaps)
 *   from:       number,          - First item index on this page (0-indexed)
 *   to:         number,          - Last item index on this page (exclusive)
 *   hasPrev:    boolean,
 *   hasNext:    boolean,
 *   isFirst:    boolean,
 *   isLast:     boolean,
 *   prev:       () => void,
 *   next:       () => void,
 *   first:      () => void,
 *   last:       () => void,
 *   setPage:    (page: number) => void,
 *   pageSize:   number,
 * }}
 *
 * @example
 * const { page, pages, prev, next, from, to } = usePagination({ total: 247, pageSize: 20 });
 *
 * const pageItems = allItems.slice(from, to);
 */
export function usePagination(options) {
  const {
    total,
    pageSize   = 20,
    initialPage = 1,
    siblings   = 1,
    boundaries = 1,
    onChange,
  } = options;

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const [page, setPageState] = useState(
    Math.min(Math.max(1, initialPage), totalPages)
  );

  const setPage = useCallback((p) => {
    const next = Math.min(Math.max(1, p), totalPages);
    setPageState(next);
    onChange?.(next);
  }, [totalPages, onChange]);

  const prev  = useCallback(() => setPage(page - 1), [page, setPage]);
  const next  = useCallback(() => setPage(page + 1), [page, setPage]);
  const first = useCallback(() => setPage(1), [setPage]);
  const last  = useCallback(() => setPage(totalPages), [setPage, totalPages]);

  /**
   * Build the visible page window with "..." gaps.
   * Example output for page=5, total=10, siblings=1, boundaries=1:
   *   [1, "...", 4, 5, 6, "...", 10]
   */
  const pages = useMemo(() => {
    if (totalPages <= 1) return [1];

    const range = (start, end) =>
      Array.from({ length: end - start + 1 }, (_, i) => start + i);

    const totalShown = siblings * 2 + 3 + boundaries * 2; // 3 = current + 2 dots

    if (totalPages <= totalShown) return range(1, totalPages);

    const leftSibStart  = Math.max(boundaries + 2, page - siblings);
    const rightSibEnd   = Math.min(totalPages - boundaries - 1, page + siblings);

    const showLeftDot  = leftSibStart > boundaries + 2;
    const showRightDot = rightSibEnd < totalPages - boundaries - 1;

    const leftBoundary  = range(1, boundaries);
    const rightBoundary = range(totalPages - boundaries + 1, totalPages);
    const middle        = range(leftSibStart, rightSibEnd);

    return [
      ...leftBoundary,
      ...(showLeftDot  ? ["..."] : [boundaries + 1]),
      ...middle,
      ...(showRightDot ? ["..."] : [totalPages - boundaries]),
      ...rightBoundary,
    ];
  }, [page, totalPages, siblings, boundaries]);

  const from = (page - 1) * pageSize;
  const to   = Math.min(from + pageSize, total);

  return {
    page,
    totalPages,
    pages,
    from,
    to,
    hasPrev:  page > 1,
    hasNext:  page < totalPages,
    isFirst:  page === 1,
    isLast:   page === totalPages,
    prev,
    next,
    first,
    last,
    setPage,
    pageSize,
  };
}