import { useState, useCallback } from "react";
import { cn } from "../../utils/cn.js";

/**
 * Table — a composable, accessible data table.
 *
 * Components: Table, TableHead, TableBody, TableRow, TableHeader, TableCell, TableFoot
 * Extras: SortableHeader (with asc/desc indicator), SelectionHeader / SelectionCell
 *
 * @param {boolean} [striped=false]    - Alternating row shading
 * @param {boolean} [bordered=false]   - Full cell borders
 * @param {boolean} [hoverable=true]   - Row hover highlight
 * @param {boolean} [compact=false]    - Smaller cell padding
 * @param {boolean} [stickyHeader=false]
 *
 * @example
 * <Table>
 *   <TableHead>
 *     <TableRow>
 *       <TableHeader>Name</TableHeader>
 *       <TableHeader>Email</TableHeader>
 *       <TableHeader align="right">Amount</TableHeader>
 *     </TableRow>
 *   </TableHead>
 *   <TableBody>
 *     {rows.map(row => (
 *       <TableRow key={row.id}>
 *         <TableCell>{row.name}</TableCell>
 *         <TableCell muted>{row.email}</TableCell>
 *         <TableCell align="right">{formatCurrency(row.amount)}</TableCell>
 *       </TableRow>
 *     ))}
 *   </TableBody>
 * </Table>
 */
export function Table({
  striped      = false,
  bordered     = false,
  hoverable    = true,
  compact      = false,
  stickyHeader = false,
  children,
  className,
  wrapperClassName,
  ...props
}) {
  return (
    <div className={cn("w-full overflow-x-auto rounded-xl border border-gray-200 dark:border-zinc-700", wrapperClassName)}>
      <table
        className={cn(
          "w-full text-sm text-left border-collapse",
          striped   && "[&_tbody_tr:nth-child(even)]:bg-gray-50 dark:[&_tbody_tr:nth-child(even)]:bg-zinc-800/50",
          bordered  && "[&_th]:border [&_td]:border [&_th]:border-gray-200 [&_td]:border-gray-200 dark:[&_th]:border-zinc-700 dark:[&_td]:border-zinc-700",
          hoverable && "[&_tbody_tr]:transition-colors [&_tbody_tr:hover]:bg-gray-50 dark:[&_tbody_tr:hover]:bg-zinc-800/50",
          compact   && "[&_th]:py-2 [&_td]:py-2",
          className,
        )}
        {...props}
      >
        {children}
      </table>
    </div>
  );
}

export function TableHead({ children, className, ...props }) {
  return (
    <thead className={cn("bg-gray-50 dark:bg-zinc-800/60 text-xs text-gray-500 dark:text-zinc-400 uppercase tracking-wider", className)} {...props}>
      {children}
    </thead>
  );
}

export function TableBody({ children, className, ...props }) {
  return (
    <tbody className={cn("divide-y divide-gray-100 dark:divide-zinc-800 bg-white dark:bg-zinc-900", className)} {...props}>
      {children}
    </tbody>
  );
}

export function TableFoot({ children, className, ...props }) {
  return (
    <tfoot className={cn("bg-gray-50 dark:bg-zinc-800/60 border-t border-gray-200 dark:border-zinc-700 text-xs font-medium", className)} {...props}>
      {children}
    </tfoot>
  );
}

export function TableRow({ selected, className, children, ...props }) {
  return (
    <tr
      className={cn(
        selected && "bg-blue-50 dark:bg-blue-950/40",
        className,
      )}
      aria-selected={selected}
      {...props}
    >
      {children}
    </tr>
  );
}

export function TableHeader({ align = "left", children, className, ...props }) {
  return (
    <th
      scope="col"
      className={cn(
        "px-4 py-3 font-semibold",
        align === "right"  && "text-right",
        align === "center" && "text-center",
        className,
      )}
      {...props}
    >
      {children}
    </th>
  );
}

export function TableCell({ align = "left", muted, truncate, children, className, ...props }) {
  return (
    <td
      className={cn(
        "px-4 py-3 text-gray-900 dark:text-zinc-100",
        muted    && "text-gray-500 dark:text-zinc-400",
        truncate && "max-w-[200px] truncate",
        align === "right"  && "text-right",
        align === "center" && "text-center",
        className,
      )}
      {...props}
    >
      {children}
    </td>
  );
}

// ── Sortable header ───────────────────────────────────────────────────────────

/**
 * SortableHeader — a TableHeader with asc/desc/none sort indicator.
 * @param {"asc"|"desc"|null} direction - Current sort direction for this column
 * @param {function} onSort             - () => void  — flip sort direction outside
 */
export function SortableHeader({ direction, onSort, children, className, ...props }) {
  return (
    <th
      scope="col"
      onClick={onSort}
      className={cn(
        "px-4 py-3 font-semibold cursor-pointer select-none group",
        "hover:bg-gray-100 dark:hover:bg-zinc-700 transition-colors",
        className,
      )}
      aria-sort={direction === "asc" ? "ascending" : direction === "desc" ? "descending" : "none"}
      {...props}
    >
      <span className="flex items-center gap-1.5">
        {children}
        <span className="flex flex-col">
          <svg viewBox="0 0 8 5" fill="currentColor" className={cn("w-2 h-2", direction === "asc" ? "text-blue-600 dark:text-blue-400" : "text-gray-300 dark:text-zinc-600 group-hover:text-gray-400")}>
            <path d="M0 5L4 0l4 5H0z"/>
          </svg>
          <svg viewBox="0 0 8 5" fill="currentColor" className={cn("w-2 h-2", direction === "desc" ? "text-blue-600 dark:text-blue-400" : "text-gray-300 dark:text-zinc-600 group-hover:text-gray-400")}>
            <path d="M0 0l4 5 4-5H0z"/>
          </svg>
        </span>
      </span>
    </th>
  );
}

// ── Row selection ─────────────────────────────────────────────────────────────

/** Checkbox header cell for "select all" */
export function SelectionHeader({ checked, indeterminate, onChange }) {
  return (
    <th scope="col" className="w-10 px-4 py-3">
      <input
        type="checkbox"
        checked={checked}
        ref={(el) => { if (el) el.indeterminate = !!indeterminate; }}
        onChange={onChange}
        className="w-4 h-4 rounded border-gray-300 dark:border-zinc-600 text-blue-600 focus:ring-blue-500 cursor-pointer"
        aria-label="Select all rows"
      />
    </th>
  );
}

/** Checkbox body cell for row selection */
export function SelectionCell({ checked, onChange }) {
  return (
    <td className="w-10 px-4 py-3">
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        className="w-4 h-4 rounded border-gray-300 dark:border-zinc-600 text-blue-600 focus:ring-blue-500 cursor-pointer"
        aria-label="Select row"
      />
    </td>
  );
}

// ── useTableSort hook ─────────────────────────────────────────────────────────

/**
 * useTableSort — manages column sort state for SortableHeader.
 * @param {string} [initialKey]
 * @param {"asc"|"desc"} [initialDir="asc"]
 */
export function useTableSort(initialKey = null, initialDir = "asc") {
  const [sort, setSort] = useState({ key: initialKey, dir: initialDir });

  const toggle = useCallback((key) => {
    setSort((prev) => ({
      key,
      dir: prev.key === key && prev.dir === "asc" ? "desc" : "asc",
    }));
  }, []);

  const getSortedData = useCallback((data, accessor) => {
    if (!sort.key) return data;
    return [...data].sort((a, b) => {
      const av = accessor ? accessor(a, sort.key) : a[sort.key];
      const bv = accessor ? accessor(b, sort.key) : b[sort.key];
      if (av == null) return 1;
      if (bv == null) return -1;
      const cmp = typeof av === "string"
        ? av.localeCompare(bv)
        : av - bv;
      return sort.dir === "asc" ? cmp : -cmp;
    });
  }, [sort]);

  return { sortKey: sort.key, sortDir: sort.dir, toggle, getSortedData };
}