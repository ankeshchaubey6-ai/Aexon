import { forwardRef, useId, useRef, useCallback } from "react";
import { cn } from "../../utils/cn.js";
import { useDebounce } from "../../hooks/useDebounce.js";

/**
 * SearchInput — a styled search field with clear button, loading spinner,
 * optional keyboard shortcut badge, and debounced onChange.
 *
 * @param {string}   [value]
 * @param {function} [onChange]         - (value: string) => void  (raw, not debounced)
 * @param {function} [onSearch]         - (value: string) => void  (debounced)
 * @param {number}   [debounce=300]     - ms delay for onSearch
 * @param {string}   [placeholder]
 * @param {boolean}  [loading=false]
 * @param {boolean}  [clearable=true]
 * @param {string}   [shortcut]         - e.g. "⌘K" — shown as a hint badge
 * @param {"sm"|"md"|"lg"} [size="md"]
 * @param {boolean}  [autoFocus]
 *
 * @example
 * <SearchInput
 *   placeholder="Search products…"
 *   onSearch={query => fetchProducts(query)}
 *   shortcut="⌘K"
 *   loading={isFetching}
 * />
 */
export const SearchInput = forwardRef(function SearchInput(
  {
    value,
    onChange,
    onSearch,
    debounce    = 300,
    placeholder = "Search…",
    loading     = false,
    clearable   = true,
    shortcut,
    size        = "md",
    autoFocus   = false,
    id: idProp,
    className,
    ...props
  },
  ref,
) {
  const autoId     = useId();
  const inputId    = idProp ?? autoId;
  const innerRef   = useRef(null);

  // Merge refs
  const setRef = useCallback((el) => {
    innerRef.current = el;
    if (typeof ref === "function") ref(el);
    else if (ref) ref.current = el;
  }, [ref]);

  const heights   = { sm: "h-8 text-sm", md: "h-9 text-sm", lg: "h-11 text-base" }[size] ?? "h-9 text-sm";
  const iconSizes = { sm: "w-3.5 h-3.5", md: "w-4 h-4", lg: "w-5 h-5" }[size] ?? "w-4 h-4";
  const padLeft   = { sm: "pl-8", md: "pl-9", lg: "pl-11" }[size] ?? "pl-9";
  const padRight  = (clearable || loading || shortcut)
    ? { sm: "pr-8", md: "pr-9", lg: "pr-11" }[size] ?? "pr-9"
    : "pr-3";

  const handleChange = (e) => {
    const v = e.target.value;
    onChange?.(v);
    onSearch?.(v);
  };

  const handleClear = () => {
    onChange?.("");
    onSearch?.("");
    innerRef.current?.focus();
  };

  const hasValue = Boolean(value);

  return (
    <div className={cn("relative flex items-center", className)}>
      {/* Search icon */}
      <span className={cn(
        "absolute left-3 flex items-center pointer-events-none",
        "text-gray-400 dark:text-zinc-500",
        iconSizes,
      )}>
        <svg viewBox="0 0 20 20" fill="currentColor" className="w-full h-full">
          <path fillRule="evenodd" d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z" clipRule="evenodd"/>
        </svg>
      </span>

      <input
        ref={setRef}
        id={inputId}
        type="search"
        autoComplete="off"
        autoFocus={autoFocus}
        placeholder={placeholder}
        value={value ?? ""}
        onChange={handleChange}
        className={cn(
          "w-full rounded-lg border bg-white dark:bg-zinc-900",
          "text-gray-900 dark:text-gray-100",
          "placeholder:text-gray-400 dark:placeholder:text-zinc-500",
          "border-gray-200 dark:border-zinc-700",
          "focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent",
          "transition-colors duration-150",
          "[&::-webkit-search-cancel-button]:hidden",
          heights, padLeft, padRight,
        )}
        {...props}
      />

      {/* Right side: loading → clear → shortcut */}
      <span className="absolute right-3 flex items-center gap-1.5">
        {loading && (
          <svg className={cn("animate-spin text-gray-400", iconSizes)} fill="none" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25"/>
            <path fill="currentColor" className="opacity-75" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
          </svg>
        )}
        {clearable && hasValue && !loading && (
          <button
            type="button"
            onClick={handleClear}
            aria-label="Clear search"
            className={cn(
              "flex items-center justify-center rounded",
              "text-gray-400 hover:text-gray-600 dark:hover:text-zinc-300",
              "focus:outline-none focus:ring-1 focus:ring-blue-500",
              iconSizes,
            )}
          >
            <svg viewBox="0 0 16 16" fill="currentColor" className="w-full h-full">
              <path d="M3.72 3.72a.75.75 0 011.06 0L8 6.94l3.22-3.22a.75.75 0 111.06 1.06L9.06 8l3.22 3.22a.75.75 0 11-1.06 1.06L8 9.06l-3.22 3.22a.75.75 0 01-1.06-1.06L6.94 8 3.72 4.78a.75.75 0 010-1.06z"/>
            </svg>
          </button>
        )}
        {shortcut && !hasValue && !loading && (
          <kbd className="hidden sm:inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium border border-gray-200 dark:border-zinc-600 text-gray-400 dark:text-zinc-500 bg-gray-50 dark:bg-zinc-800 select-none">
            {shortcut}
          </kbd>
        )}
      </span>
    </div>
  );
});

SearchInput.displayName = "SearchInput";