import { useState, useId } from "react";
import { cn } from "../../utils/cn.js";

/**
 * TimePicker — hour/minute (and optional second) time selector.
 *
 * @param {string}   [value]       - "HH:MM" or "HH:MM:SS"
 * @param {function} [onChange]    - (value: string) => void
 * @param {boolean}  [seconds=false]
 * @param {boolean}  [hour12=false] - 12-hour format with AM/PM
 * @param {number}   [minuteStep=1]
 * @param {string}   [label]
 * @param {string}   [error]
 * @param {boolean}  [disabled]
 *
 * @example
 * <TimePicker label="Meeting time" value={time} onChange={setTime} />
 */
export function TimePicker({
  value    = "00:00",
  onChange,
  seconds  = false,
  hour12   = false,
  minuteStep = 1,
  label,
  error,
  disabled = false,
  className,
}) {
  const id       = useId();
  const parts    = (value ?? "00:00:00").split(":").map(Number);
  const [h, setH] = useState(parts[0] ?? 0);
  const [m, setM] = useState(parts[1] ?? 0);
  const [s, setS] = useState(parts[2] ?? 0);
  const [ampm, setAmpm] = useState(h >= 12 ? "PM" : "AM");

  const emit = (hour, min, sec) => {
    const hh = String(hour).padStart(2, "0");
    const mm = String(min).padStart(2, "0");
    const ss = String(sec).padStart(2, "0");
    onChange?.(seconds ? `${hh}:${mm}:${ss}` : `${hh}:${mm}`);
  };

  const updateH = (v) => {
    const next = ((v % 24) + 24) % 24;
    setH(next);
    if (hour12) setAmpm(next >= 12 ? "PM" : "AM");
    emit(next, m, s);
  };
  const updateM = (v) => {
    const steps = Math.round(60 / minuteStep);
    const idx   = ((Math.round(v / minuteStep) % steps) + steps) % steps;
    const next  = idx * minuteStep;
    setM(next); emit(h, next, s);
  };
  const updateS = (v) => {
    const next = ((v % 60) + 60) % 60;
    setS(next); emit(h, m, next);
  };

  const SpinnerField = ({ label: fl, value: fv, onInc, onDec, format = (v) => String(v).padStart(2,"0") }) => (
    <div className="flex flex-col items-center gap-0.5">
      <button type="button" onClick={onInc} disabled={disabled} aria-label={`Increase ${fl}`}
        className="w-8 h-7 flex items-center justify-center rounded hover:bg-gray-100 dark:hover:bg-zinc-800 text-gray-500 dark:text-zinc-400 focus:outline-none disabled:opacity-40">
        <svg viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5">
          <path fillRule="evenodd" d="M8 3.47a.75.75 0 01.53.22l3.25 3.25a.75.75 0 01-1.06 1.06L8 5.28 5.28 8a.75.75 0 01-1.06-1.06l3.25-3.25A.75.75 0 018 3.47z"/>
        </svg>
      </button>
      <input
        type="text"
        readOnly
        value={format(fv)}
        aria-label={fl}
        className="w-10 h-10 text-center text-xl font-mono font-semibold rounded-lg bg-gray-50 dark:bg-zinc-800 text-gray-900 dark:text-zinc-100 border border-gray-200 dark:border-zinc-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
      <button type="button" onClick={onDec} disabled={disabled} aria-label={`Decrease ${fl}`}
        className="w-8 h-7 flex items-center justify-center rounded hover:bg-gray-100 dark:hover:bg-zinc-800 text-gray-500 dark:text-zinc-400 focus:outline-none disabled:opacity-40">
        <svg viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5">
          <path fillRule="evenodd" d="M8 12.53a.75.75 0 01-.53-.22L4.22 9.06a.75.75 0 011.06-1.06L8 10.72l2.72-2.72a.75.75 0 111.06 1.06l-3.25 3.25A.75.75 0 018 12.53z"/>
        </svg>
      </button>
    </div>
  );

  const Colon = () => <span className="text-xl font-bold text-gray-400 dark:text-zinc-500 self-center mb-0.5">:</span>;

  const displayH = hour12 ? (h % 12 || 12) : h;

  return (
    <div className={cn("inline-flex flex-col gap-2", className)}>
      {label && (
        <label id={id} className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          {label}
        </label>
      )}
      <div
        role="group"
        aria-labelledby={label ? id : undefined}
        className="inline-flex items-start gap-1 p-3 rounded-xl border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-900"
      >
        <SpinnerField label="Hours" value={displayH} onInc={() => updateH(h + 1)} onDec={() => updateH(h - 1)} />
        <Colon />
        <SpinnerField label="Minutes" value={m} onInc={() => updateM(m + minuteStep)} onDec={() => updateM(m - minuteStep)} />
        {seconds && (
          <>
            <Colon />
            <SpinnerField label="Seconds" value={s} onInc={() => updateS(s + 1)} onDec={() => updateS(s - 1)} />
          </>
        )}
        {hour12 && (
          <div className="flex flex-col gap-0.5 ml-1 self-center">
            {["AM", "PM"].map(period => (
              <button
                key={period}
                type="button"
                onClick={() => {
                  setAmpm(period);
                  const next = period === "PM" ? (h < 12 ? h + 12 : h) : (h >= 12 ? h - 12 : h);
                  setH(next); emit(next, m, s);
                }}
                className={cn(
                  "px-1.5 py-1 rounded text-xs font-semibold transition-colors",
                  ampm === period
                    ? "bg-blue-600 text-white"
                    : "text-gray-500 dark:text-zinc-400 hover:bg-gray-100 dark:hover:bg-zinc-800",
                )}
              >
                {period}
              </button>
            ))}
          </div>
        )}
      </div>
      {error && <p role="alert" className="text-xs text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
}