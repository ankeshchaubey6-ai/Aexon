import { useState, useRef, useCallback, useId } from "react";
import { cn } from "../../utils/cn.js";
import { useClickOutside } from "../../hooks/useClickOutside.js";
import { useKeyboard } from "../../hooks/useKeyboard.js";

/**
 * Searchable multi-select (or single-select) dropdown.
 * Pure React, no external dependencies.
 *
 * @param {Array}    options           - [{ value, label, disabled? }]
 * @param {string[]} [value=[]]        - Controlled selected values
 * @param {function} onChange          - Called with new selected array
 * @param {boolean}  [multi=true]      - Allow multiple selection
 * @param {string}   [placeholder]
 * @param {string}   [label]
 * @param {string}   [error]
 * @param {string}   [hint]
 * @param {boolean}  [searchable=true]
 * @param {number}   [maxSelected]     - Limit selections
 * @param {boolean}  [clearable=true]  - Show clear-all button
 *
 * @example
 * const [tags, setTags] = useState([]);
 * <MultiSelect
 *   label="Tags"
 *   options={tagOptions}
 *   value={tags}
 *   onChange={setTags}
 *   placeholder="Select tags…"
 * />
 */
export function MultiSelect({
  options       = [],
  value         = [],
  onChange,
  multi         = true,
  placeholder   = "Select…",
  label,
  error,
  hint,
  searchable    = true,
  maxSelected,
  clearable     = true,
  disabled      = false,
  id: idProp,
  className,
}) {
  const autoId    = useId();
  const inputId   = idProp ?? autoId;
  const [open, setOpen]       = useState(false);
  const [query, setQuery]     = useState("");
  const [highlighted, setHL]  = useState(0);
  const containerRef  = useRef(null);
  const inputRef      = useRef(null);
  const hasError      = Boolean(error);

  useClickOutside(containerRef, () => { setOpen(false); setQuery(""); });
  useKeyboard({ Escape: () => { setOpen(false); setQuery(""); } }, { enabled: open });

  const filtered = options.filter(o =>
    !query || o.label.toLowerCase().includes(query.toLowerCase())
  );

  const isSelected  = (v) => value.includes(v);
  const atMax       = maxSelected != null && value.length >= maxSelected;

  const toggle = useCallback((optValue) => {
    if (!onChange) return;
    if (isSelected(optValue)) {
      onChange(value.filter(v => v !== optValue));
    } else {
      if (!multi) { onChange([optValue]); setOpen(false); setQuery(""); return; }
      if (atMax) return;
      onChange([...value, optValue]);
    }
  }, [value, onChange, multi, atMax]);

  const clearAll = useCallback((e) => {
    e.stopPropagation();
    onChange?.([]);
  }, [onChange]);

  const selectedLabels = value.map(v => options.find(o => o.value === v)?.label ?? v);

  return (
    <div className="w-full" ref={containerRef}>
      {label && (
        <label htmlFor={inputId} className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
          {label}
        </label>
      )}

      {/* Trigger */}
      <div
        id={inputId}
        role="combobox"
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-invalid={hasError}
        tabIndex={disabled ? -1 : 0}
        onClick={() => { if (!disabled) { setOpen(o => !o); setTimeout(() => inputRef.current?.focus(), 50); } }}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setOpen(o => !o); } }}
        className={cn(
          "relative flex min-h-[2.25rem] w-full flex-wrap items-center gap-1.5 rounded-lg border",
          "bg-white dark:bg-zinc-900 px-3 py-1.5 cursor-pointer",
          "focus:outline-none focus:ring-2 focus:ring-blue-500",
          "transition-colors duration-150",
          hasError ? "border-red-400 dark:border-red-500" : "border-gray-300 dark:border-zinc-600",
          open && "ring-2 ring-blue-500 border-transparent",
          disabled && "opacity-60 cursor-not-allowed",
          className
        )}
      >
        {/* Selected chips */}
        {value.length > 0
          ? selectedLabels.map((lbl, i) => (
              <span key={value[i]} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300">
                {lbl}
                {!disabled && (
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); toggle(value[i]); }}
                    className="hover:text-blue-900 dark:hover:text-blue-100 focus:outline-none"
                    aria-label={`Remove ${lbl}`}
                  >
                    <svg viewBox="0 0 12 12" fill="currentColor" className="w-3 h-3">
                      <path d="M6 4.94L9.47 1.47l1.06 1.06L7.06 6l3.47 3.47-1.06 1.06L6 7.06 2.53 10.53 1.47 9.47 4.94 6 1.47 2.53 2.53 1.47 6 4.94z"/>
                    </svg>
                  </button>
                )}
              </span>
            ))
          : !open && (
              <span className="text-sm text-gray-400 dark:text-zinc-500 select-none">{placeholder}</span>
            )
        }

        {/* Search input (shown when open) */}
        {open && searchable && (
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setHL(0); }}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") { e.preventDefault(); setHL(h => Math.min(h + 1, filtered.length - 1)); }
              if (e.key === "ArrowUp")   { e.preventDefault(); setHL(h => Math.max(h - 1, 0)); }
              if (e.key === "Enter" && filtered[highlighted]) { e.preventDefault(); toggle(filtered[highlighted].value); }
            }}
            placeholder="Search…"
            className="flex-1 min-w-[80px] bg-transparent outline-none text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400"
            onClick={(e) => e.stopPropagation()}
          />
        )}

        {/* Right controls */}
        <div className="ml-auto flex items-center gap-1 shrink-0">
          {clearable && value.length > 0 && !disabled && (
            <button type="button" onClick={clearAll} className="text-gray-400 hover:text-gray-600 dark:hover:text-zinc-300" aria-label="Clear all">
              <svg viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4">
                <path d="M8 6.94L11.47 3.47l1.06 1.06L9.06 8l3.47 3.47-1.06 1.06L8 9.06 4.53 12.53 3.47 11.47 6.94 8 3.47 4.53 4.53 3.47 8 6.94z"/>
              </svg>
            </button>
          )}
          <svg viewBox="0 0 16 16" fill="currentColor" className={cn("w-4 h-4 text-gray-400 transition-transform", open && "rotate-180")}>
            <path fillRule="evenodd" d="M4.22 6.22a.75.75 0 011.06 0L8 8.94l2.72-2.72a.75.75 0 111.06 1.06l-3.25 3.25a.75.75 0 01-1.06 0L4.22 7.28a.75.75 0 010-1.06z"/>
          </svg>
        </div>
      </div>

      {/* Dropdown */}
      {open && (
        <div className="absolute z-50 mt-1 w-full max-h-60 overflow-y-auto rounded-lg border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-lg">
          {filtered.length === 0
            ? <p className="px-3 py-2 text-sm text-gray-400">No options found</p>
            : filtered.map((opt, i) => (
                <div
                  key={opt.value}
                  role="option"
                  aria-selected={isSelected(opt.value)}
                  onClick={() => !opt.disabled && toggle(opt.value)}
                  className={cn(
                    "flex items-center gap-2 px-3 py-2 text-sm cursor-pointer",
                    "text-gray-900 dark:text-gray-100",
                    highlighted === i && "bg-blue-50 dark:bg-blue-950",
                    isSelected(opt.value) && "font-medium",
                    opt.disabled && "opacity-40 cursor-not-allowed",
                    !opt.disabled && "hover:bg-gray-50 dark:hover:bg-zinc-800"
                  )}
                >
                  {/* Checkbox indicator */}
                  <span className={cn("flex-shrink-0 w-4 h-4 rounded border-2 flex items-center justify-center", isSelected(opt.value) ? "bg-blue-600 border-blue-600" : "border-gray-300 dark:border-zinc-600")}>
                    {isSelected(opt.value) && (
                      <svg viewBox="0 0 12 12" fill="none" stroke="white" strokeWidth="2" className="w-2.5 h-2.5">
                        <path d="M1.5 6l3 3 6-6" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    )}
                  </span>
                  {opt.label}
                  {atMax && !isSelected(opt.value) && (
                    <span className="ml-auto text-xs text-gray-400">Max</span>
                  )}
                </div>
              ))
          }
        </div>
      )}

      {error ? (
        <p role="alert" className="mt-1.5 text-xs text-red-600 dark:text-red-400">{error}</p>
      ) : hint ? (
        <p className="mt-1.5 text-xs text-gray-500 dark:text-zinc-400">{hint}</p>
      ) : null}
    </div>
  );
}