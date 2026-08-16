import { useState, useRef, useId } from "react";
import { cn } from "../../utils/cn.js";
import { useClickOutside } from "../../hooks/useClickOutside.js";
import { formatDate } from "../../utils/format.js";

const DAYS   = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];

function buildCalendar(year, month) {
  const first = new Date(year, month, 1).getDay();
  const days  = new Date(year, month + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < first; i++) cells.push(null);
  for (let d = 1; d <= days; d++) cells.push(d);
  return cells;
}

/**
 * DatePicker — a calendar-based date selector.
 *
 * @param {Date|null}  [value]
 * @param {function}   [onChange]    - (date: Date) => void
 * @param {Date}       [minDate]
 * @param {Date}       [maxDate]
 * @param {string}     [placeholder]
 * @param {string}     [label]
 * @param {string}     [error]
 * @param {"sm"|"md"}  [size="md"]
 * @param {boolean}    [disabled]
 * @param {string}     [dateFormat]  - Passed to formatDate
 *
 * @example
 * <DatePicker
 *   label="Start date"
 *   value={startDate}
 *   onChange={setStartDate}
 *   minDate={new Date()}
 * />
 */
export function DatePicker({
  value,
  onChange,
  minDate,
  maxDate,
  placeholder = "Select date…",
  label,
  error,
  size      = "md",
  disabled  = false,
  className,
}) {
  const [open,         setOpen]      = useState(false);
  const [viewYear,     setViewYear]  = useState(() => (value ?? new Date()).getFullYear());
  const [viewMonth,    setViewMonth] = useState(() => (value ?? new Date()).getMonth());
  const containerRef = useRef(null);
  const id           = useId();

  useClickOutside(containerRef, () => setOpen(false), { enabled: open });

  const cells   = buildCalendar(viewYear, viewMonth);
  const today   = new Date();
  const todayD  = today.getDate();
  const todayM  = today.getMonth();
  const todayY  = today.getFullYear();

  const isSelected = (d) =>
    value && d === value.getDate() && viewMonth === value.getMonth() && viewYear === value.getFullYear();

  const isToday = (d) => d === todayD && viewMonth === todayM && viewYear === todayY;

  const isDisabled = (d) => {
    const dt = new Date(viewYear, viewMonth, d);
    if (minDate && dt < new Date(minDate.getFullYear(), minDate.getMonth(), minDate.getDate())) return true;
    if (maxDate && dt > new Date(maxDate.getFullYear(), maxDate.getMonth(), maxDate.getDate())) return true;
    return false;
  };

  const prevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); }
    else setViewMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); }
    else setViewMonth(m => m + 1);
  };

  const select = (d) => {
    if (!d || isDisabled(d)) return;
    onChange?.(new Date(viewYear, viewMonth, d));
    setOpen(false);
  };

  const displayValue = value ? formatDate(value) : "";
  const hasError     = Boolean(error);

  const triggerH = { sm: "h-8 text-sm", md: "h-9 text-sm" }[size] ?? "h-9 text-sm";

  return (
    <div className={cn("relative w-full", className)} ref={containerRef}>
      {label && (
        <label htmlFor={id} className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
          {label}
        </label>
      )}

      {/* Trigger */}
      <button
        id={id}
        type="button"
        disabled={disabled}
        onClick={() => setOpen(o => !o)}
        className={cn(
          "w-full flex items-center justify-between px-3 rounded-lg border",
          "bg-white dark:bg-zinc-900 text-left",
          "transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent",
          triggerH,
          hasError
            ? "border-red-400 dark:border-red-500"
            : "border-gray-200 dark:border-zinc-700",
          disabled && "opacity-50 cursor-not-allowed",
          open && "ring-2 ring-blue-500 border-transparent",
        )}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <span className={displayValue ? "text-gray-900 dark:text-zinc-100" : "text-gray-400 dark:text-zinc-500"}>
          {displayValue || placeholder}
        </span>
        <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 text-gray-400 shrink-0">
          <path fillRule="evenodd" d="M5.75 2a.75.75 0 01.75.75V4h7V2.75a.75.75 0 011.5 0V4h.25A2.75 2.75 0 0118 6.75v8.5A2.75 2.75 0 0115.25 18H4.75A2.75 2.75 0 012 15.25v-8.5A2.75 2.75 0 014.75 4H5V2.75A.75.75 0 015.75 2zm-1 5.5c-.69 0-1.25.56-1.25 1.25v6.5c0 .69.56 1.25 1.25 1.25h10.5c.69 0 1.25-.56 1.25-1.25v-6.5c0-.69-.56-1.25-1.25-1.25H4.75z"/>
        </svg>
      </button>

      {/* Calendar */}
      {open && (
        <div
          role="dialog"
          aria-label="Calendar"
          className="absolute top-full left-0 mt-1.5 z-40 w-72 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-xl shadow-xl animate-in fade-in zoom-in-95 duration-150"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-zinc-800">
            <button type="button" onClick={prevMonth} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-zinc-800 text-gray-500 dark:text-zinc-400 focus:outline-none">
              <svg viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4">
                <path fillRule="evenodd" d="M9.78 3.97a.75.75 0 010 1.06L7.81 7l1.97 1.97a.75.75 0 11-1.06 1.06l-2.5-2.5a.75.75 0 010-1.06l2.5-2.5a.75.75 0 011.06 0z"/>
              </svg>
            </button>
            <button
              type="button"
              className="text-sm font-semibold text-gray-900 dark:text-zinc-100 hover:text-blue-600 dark:hover:text-blue-400 focus:outline-none"
            >
              {MONTHS[viewMonth]} {viewYear}
            </button>
            <button type="button" onClick={nextMonth} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-zinc-800 text-gray-500 dark:text-zinc-400 focus:outline-none">
              <svg viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4">
                <path fillRule="evenodd" d="M6.22 3.97a.75.75 0 000 1.06L8.19 7 6.22 8.97a.75.75 0 101.06 1.06l2.5-2.5a.75.75 0 000-1.06l-2.5-2.5a.75.75 0 00-1.06 0z"/>
              </svg>
            </button>
          </div>

          {/* Day names */}
          <div className="grid grid-cols-7 px-3 pt-2">
            {DAYS.map(d => (
              <div key={d} className="flex items-center justify-center h-8 text-xs font-semibold text-gray-400 dark:text-zinc-500">
                {d}
              </div>
            ))}
          </div>

          {/* Cells */}
          <div className="grid grid-cols-7 px-3 pb-3 gap-y-0.5">
            {cells.map((d, i) => (
              <div key={i} className="flex items-center justify-center">
                {d === null ? null : (
                  <button
                    type="button"
                    onClick={() => select(d)}
                    disabled={isDisabled(d)}
                    className={cn(
                      "flex items-center justify-center w-8 h-8 rounded-full text-sm transition-colors",
                      "focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500",
                      isSelected(d)
                        ? "bg-blue-600 text-white font-semibold hover:bg-blue-700"
                        : isToday(d)
                        ? "border border-blue-400 text-blue-600 dark:text-blue-400 font-semibold hover:bg-blue-50 dark:hover:bg-blue-950"
                        : "text-gray-700 dark:text-zinc-200 hover:bg-gray-100 dark:hover:bg-zinc-800",
                      isDisabled(d) && "opacity-30 cursor-not-allowed hover:bg-transparent",
                    )}
                  >
                    {d}
                  </button>
                )}
              </div>
            ))}
          </div>

          {/* Today button */}
          <div className="border-t border-gray-100 dark:border-zinc-800 px-3 py-2">
            <button
              type="button"
              onClick={() => { setViewYear(todayY); setViewMonth(todayM); select(todayD); }}
              className="w-full text-xs text-center text-blue-600 dark:text-blue-400 hover:underline focus:outline-none"
            >
              Today
            </button>
          </div>
        </div>
      )}

      {error && <p role="alert" className="mt-1.5 text-xs text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
}