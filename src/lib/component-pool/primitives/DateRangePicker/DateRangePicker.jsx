import { useState, useRef } from "react";
import { cn } from "../../utils/cn.js";
import { useClickOutside } from "../../hooks/useClickOutside.js";
import { formatDate } from "../../utils/format.js";

const DAYS   = ["Su","Mo","Tu","We","Th","Fr","Sa"];
const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function buildCal(y, m) {
  const first = new Date(y, m, 1).getDay();
  const days  = new Date(y, m + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < first; i++) cells.push(null);
  for (let d = 1; d <= days; d++) cells.push(d);
  return cells;
}

function toKey(y, m, d) { return `${y}-${m}-${d}`; }

/**
 * DateRangePicker — a dual-month calendar for selecting a start + end date range.
 *
 * @param {{ from?: Date, to?: Date }} [value]
 * @param {function} [onChange]  - ({ from: Date, to: Date }) => void
 * @param {Date}     [minDate]
 * @param {Date}     [maxDate]
 * @param {string}   [label]
 * @param {string}   [placeholder]
 * @param {boolean}  [disabled]
 *
 * @example
 * <DateRangePicker
 *   label="Booking period"
 *   value={{ from: checkIn, to: checkOut }}
 *   onChange={({ from, to }) => { setCheckIn(from); setCheckOut(to); }}
 *   minDate={new Date()}
 * />
 */
export function DateRangePicker({
  value,
  onChange,
  minDate,
  maxDate,
  label,
  placeholder = "Select date range…",
  disabled    = false,
  className,
}) {
  const today     = new Date();
  const [open, setOpen]           = useState(false);
  const [viewYear, setViewYear]   = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [hovered,   setHovered]   = useState(null);
  const [picking,   setPicking]   = useState("from"); // "from" | "to"
  const containerRef = useRef(null);

  useClickOutside(containerRef, () => setOpen(false), { enabled: open });

  const from = value?.from ?? null;
  const to   = value?.to   ?? null;

  const inRange = (y, m, d) => {
    if (!from) return false;
    const dt    = new Date(y, m, d);
    const end   = to ?? hovered;
    if (!end) return false;
    const [lo, hi] = from <= end ? [from, end] : [end, from];
    return dt > lo && dt < hi;
  };

  const isStart  = (y, m, d) => from && toKey(y,m,d) === toKey(from.getFullYear(), from.getMonth(), from.getDate());
  const isEnd    = (y, m, d) => to   && toKey(y,m,d) === toKey(to.getFullYear(),   to.getMonth(),   to.getDate());
  const isHov    = (y, m, d) => hovered && toKey(y,m,d) === toKey(hovered.getFullYear(), hovered.getMonth(), hovered.getDate());

  const isDisabled = (y, m, d) => {
    const dt = new Date(y, m, d);
    if (minDate && dt < new Date(minDate.getFullYear(), minDate.getMonth(), minDate.getDate())) return true;
    if (maxDate && dt > new Date(maxDate.getFullYear(), maxDate.getMonth(), maxDate.getDate())) return true;
    return false;
  };

  const select = (y, m, d) => {
    if (isDisabled(y, m, d)) return;
    const dt = new Date(y, m, d);
    if (picking === "from" || (from && to)) {
      onChange?.({ from: dt, to: null });
      setPicking("to");
    } else {
      const [lo, hi] = from <= dt ? [from, dt] : [dt, from];
      onChange?.({ from: lo, to: hi });
      setPicking("from");
      setOpen(false);
    }
  };

  // Two months: current and next
  const months = [
    { year: viewYear, month: viewMonth },
    { year: viewMonth === 11 ? viewYear + 1 : viewYear, month: (viewMonth + 1) % 12 },
  ];

  const prevM = () => { if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); } else setViewMonth(m => m - 1); };
  const nextM = () => { if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); } else setViewMonth(m => m + 1); };

  const displayText = from
    ? `${formatDate(from)}${to ? " → " + formatDate(to) : " → …"}`
    : placeholder;

  return (
    <div className={cn("relative w-full", className)} ref={containerRef}>
      {label && <p className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">{label}</p>}

      {/* Trigger */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(o => !o)}
        className={cn(
          "w-full flex items-center justify-between px-3 h-9 rounded-lg border text-sm",
          "bg-white dark:bg-zinc-900 text-left transition-colors",
          "focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent",
          open ? "ring-2 ring-blue-500 border-transparent" : "border-gray-200 dark:border-zinc-700",
          disabled && "opacity-50 cursor-not-allowed",
          !from && "text-gray-400 dark:text-zinc-500",
          from  && "text-gray-900 dark:text-zinc-100",
        )}
      >
        {displayText}
        <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 text-gray-400 shrink-0">
          <path fillRule="evenodd" d="M5.75 2a.75.75 0 01.75.75V4h7V2.75a.75.75 0 011.5 0V4h.25A2.75 2.75 0 0118 6.75v8.5A2.75 2.75 0 0115.25 18H4.75A2.75 2.75 0 012 15.25v-8.5A2.75 2.75 0 014.75 4H5V2.75A.75.75 0 015.75 2zm-1 5.5c-.69 0-1.25.56-1.25 1.25v6.5c0 .69.56 1.25 1.25 1.25h10.5c.69 0 1.25-.56 1.25-1.25v-6.5c0-.69-.56-1.25-1.25-1.25H4.75z"/>
        </svg>
      </button>

      {/* Calendar dropdown */}
      {open && (
        <div className="absolute top-full left-0 mt-1.5 z-50 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-2xl shadow-2xl animate-in fade-in zoom-in-95 duration-150">
          <div className="flex">
            {months.map(({ year, month }, mi) => (
              <div key={mi} className={cn("p-4", mi === 0 && "border-r border-gray-100 dark:border-zinc-800")}>
                {/* Month nav */}
                <div className="flex items-center justify-between mb-3 gap-2">
                  {mi === 0 ? (
                    <button type="button" onClick={prevM} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-zinc-800">
                      <svg viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4 text-gray-400">
                        <path fillRule="evenodd" d="M9.78 3.97a.75.75 0 010 1.06L7.81 7l1.97 1.97a.75.75 0 11-1.06 1.06l-2.5-2.5a.75.75 0 010-1.06l2.5-2.5a.75.75 0 011.06 0z"/>
                      </svg>
                    </button>
                  ) : <span />}
                  <span className="text-sm font-semibold text-gray-900 dark:text-zinc-100">{MONTHS[month]} {year}</span>
                  {mi === 1 ? (
                    <button type="button" onClick={nextM} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-zinc-800">
                      <svg viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4 text-gray-400">
                        <path fillRule="evenodd" d="M6.22 3.97a.75.75 0 000 1.06L8.19 7 6.22 8.97a.75.75 0 101.06 1.06l2.5-2.5a.75.75 0 000-1.06l-2.5-2.5a.75.75 0 00-1.06 0z"/>
                      </svg>
                    </button>
                  ) : <span />}
                </div>
                {/* Day names */}
                <div className="grid grid-cols-7 mb-1">
                  {DAYS.map(d => <div key={d} className="flex items-center justify-center h-7 text-[10px] font-semibold text-gray-400">{d}</div>)}
                </div>
                {/* Cells */}
                <div className="grid grid-cols-7">
                  {buildCal(year, month).map((d, i) => {
                    if (!d) return <div key={i} />;
                    const sel    = isStart(year, month, d) || isEnd(year, month, d);
                    const rng    = inRange(year, month, d);
                    const hov    = isHov(year, month, d);
                    const dis    = isDisabled(year, month, d);
                    return (
                      <button
                        key={i}
                        type="button"
                        disabled={dis}
                        onClick={() => select(year, month, d)}
                        onMouseEnter={() => !dis && setHovered(new Date(year, month, d))}
                        onMouseLeave={() => setHovered(null)}
                        className={cn(
                          "flex items-center justify-center h-8 w-8 text-sm transition-colors",
                          "focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500",
                          sel && "bg-blue-600 text-white rounded-full font-semibold",
                          rng && "bg-blue-100 dark:bg-blue-950 text-blue-900 dark:text-blue-100 rounded-none",
                          !sel && !rng && hov && "bg-blue-50 dark:bg-blue-950 rounded-full",
                          !sel && !rng && !hov && "text-gray-700 dark:text-zinc-200 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-full",
                          dis && "opacity-30 cursor-not-allowed",
                        )}
                      >
                        {d}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
          {/* Footer hint */}
          <div className="px-4 py-2.5 border-t border-gray-100 dark:border-zinc-800 text-xs text-gray-400 dark:text-zinc-500">
            {picking === "from" ? "Select start date" : "Select end date"}
          </div>
        </div>
      )}
    </div>
  );
}