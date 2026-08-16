import { forwardRef, useId } from "react";
import { cn } from "../../utils/cn.js";

/**
 * Production Select (native <select> with custom styling).
 * For a searchable/multi dropdown, use MultiSelect.
 *
 * @param {string}   [label]
 * @param {string}   [error]
 * @param {string}   [hint]
 * @param {string}   [placeholder]    - First disabled option
 * @param {Array}    [options]         - [{ value, label, disabled?, group? }]
 * @param {"sm"|"md"|"lg"} [size="md"]
 * @param {boolean}  [required=false]
 * @param {boolean}  [optional=false]
 *
 * @example
 * <Select
 *   label="Country"
 *   placeholder="Select country…"
 *   options={[
 *     { value: "us", label: "United States" },
 *     { value: "gb", label: "United Kingdom" },
 *   ]}
 *   error={errors.country}
 * />
 */
export const Select = forwardRef(function Select(
  {
    label,
    error,
    hint,
    placeholder,
    options     = [],
    size        = "md",
    required    = false,
    optional    = false,
    id: idProp,
    className,
    disabled,
    children,
    ...props
  },
  ref
) {
  const autoId  = useId();
  const inputId = idProp ?? autoId;
  const errorId = `${inputId}-error`;
  const hintId  = `${inputId}-hint`;
  const hasError = Boolean(error);

  const heights = { sm: "h-8 text-sm", md: "h-9 text-sm", lg: "h-11 text-base" };

  // Group options if any have a `group` property
  const grouped = options.reduce((acc, opt) => {
    const g = opt.group ?? "__ungrouped__";
    if (!acc[g]) acc[g] = [];
    acc[g].push(opt);
    return acc;
  }, {});

  const hasGroups = Object.keys(grouped).some(k => k !== "__ungrouped__");

  return (
    <div className="w-full">
      {label && (
        <label htmlFor={inputId} className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
          {label}
          {required && <span className="ml-0.5 text-red-500">*</span>}
          {optional && <span className="ml-1.5 text-xs font-normal text-gray-400">(optional)</span>}
        </label>
      )}

      {/* Wrapper for custom chevron */}
      <div className="relative">
        <select
          ref={ref}
          id={inputId}
          disabled={disabled}
          required={required}
          aria-invalid={hasError}
          aria-describedby={cn(error && errorId, hint && hintId)}
          className={cn(
            "w-full appearance-none rounded-lg border bg-white dark:bg-zinc-900",
            "px-3 pr-8 text-gray-900 dark:text-gray-100",
            "focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent",
            "transition-colors duration-150 cursor-pointer",
            heights[size] ?? heights.md,
            hasError
              ? "border-red-400 dark:border-red-500 focus:ring-red-400"
              : "border-gray-300 dark:border-zinc-600",
            disabled && "cursor-not-allowed opacity-60",
            className
          )}
          {...props}
        >
          {placeholder && (
            <option value="" disabled hidden>{placeholder}</option>
          )}

          {/* Render from options prop */}
          {options.length > 0 && !children && (
            hasGroups
              ? Object.entries(grouped).map(([group, opts]) =>
                  group === "__ungrouped__"
                    ? opts.map(o => (
                        <option key={o.value} value={o.value} disabled={o.disabled}>
                          {o.label}
                        </option>
                      ))
                    : (
                        <optgroup key={group} label={group}>
                          {opts.map(o => (
                            <option key={o.value} value={o.value} disabled={o.disabled}>
                              {o.label}
                            </option>
                          ))}
                        </optgroup>
                      )
                )
              : options.map(o => (
                  <option key={o.value} value={o.value} disabled={o.disabled}>
                    {o.label}
                  </option>
                ))
          )}

          {/* Allow raw children too */}
          {children}
        </select>

        {/* Chevron icon */}
        <div className="pointer-events-none absolute inset-y-0 right-2.5 flex items-center text-gray-400 dark:text-zinc-500">
          <svg viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4">
            <path fillRule="evenodd" d="M4.22 6.22a.75.75 0 011.06 0L8 8.94l2.72-2.72a.75.75 0 111.06 1.06l-3.25 3.25a.75.75 0 01-1.06 0L4.22 7.28a.75.75 0 010-1.06z"/>
          </svg>
        </div>
      </div>

      {error ? (
        <p id={errorId} role="alert" className="mt-1.5 text-xs text-red-600 dark:text-red-400">{error}</p>
      ) : hint ? (
        <p id={hintId} className="mt-1.5 text-xs text-gray-500 dark:text-zinc-400">{hint}</p>
      ) : null}
    </div>
  );
});

Select.displayName = "Select";