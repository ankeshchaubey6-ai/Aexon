import { forwardRef, useId, useEffect, useRef, useCallback } from "react";
import { cn } from "../../utils/cn.js";

/**
 * Production Textarea with optional auto-resize, character counter,
 * label, error, and hint support.
 *
 * @param {string}  [label]
 * @param {string}  [error]
 * @param {string}  [hint]
 * @param {boolean} [autoResize=false] - Grows to fit content (no scrollbar)
 * @param {number}  [maxLength]        - Shows character counter when set
 * @param {number}  [rows=3]
 * @param {boolean} [required=false]
 * @param {boolean} [optional=false]
 * @param {boolean} [resize=true]      - Whether user can manually resize
 *
 * @example
 * <Textarea
 *   label="Message"
 *   placeholder="Tell us about your project…"
 *   autoResize
 *   maxLength={500}
 *   error={errors.message}
 * />
 */
export const Textarea = forwardRef(function Textarea(
  {
    label,
    error,
    hint,
    autoResize  = false,
    maxLength,
    rows        = 3,
    required    = false,
    optional    = false,
    resize      = true,
    id: idProp,
    className,
    disabled,
    onChange,
    value,
    defaultValue,
    ...props
  },
  ref
) {
  const autoId   = useId();
  const inputId  = idProp ?? autoId;
  const errorId  = `${inputId}-error`;
  const hintId   = `${inputId}-hint`;
  const innerRef = useRef(null);
  const hasError = Boolean(error);

  // Merge refs
  const setRef = useCallback((el) => {
    innerRef.current = el;
    if (typeof ref === "function") ref(el);
    else if (ref) ref.current = el;
  }, [ref]);

  // Auto-resize logic
  const adjustHeight = useCallback(() => {
    const el = innerRef.current;
    if (!el || !autoResize) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [autoResize]);

  useEffect(() => { adjustHeight(); }, [value, defaultValue, adjustHeight]);

  const handleChange = useCallback((e) => {
    adjustHeight();
    onChange?.(e);
  }, [onChange, adjustHeight]);

  const charCount = typeof value === "string" ? value.length : 0;

  return (
    <div className="w-full">
      {/* Label row */}
      {(label || maxLength) && (
        <div className="flex items-baseline justify-between mb-1.5">
          {label && (
            <label htmlFor={inputId} className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              {label}
              {required && <span className="ml-0.5 text-red-500">*</span>}
              {optional && <span className="ml-1.5 text-xs font-normal text-gray-400">(optional)</span>}
            </label>
          )}
          {maxLength && (
            <span className={cn("text-xs tabular-nums", charCount > maxLength ? "text-red-500" : "text-gray-400")}>
              {charCount}/{maxLength}
            </span>
          )}
        </div>
      )}

      <textarea
        ref={setRef}
        id={inputId}
        rows={rows}
        disabled={disabled}
        required={required}
        maxLength={maxLength}
        aria-invalid={hasError}
        aria-describedby={cn(error && errorId, hint && hintId)}
        value={value}
        defaultValue={defaultValue}
        onChange={handleChange}
        className={cn(
          "w-full rounded-lg border bg-white dark:bg-zinc-900",
          "px-3 py-2 text-sm text-gray-900 dark:text-gray-100",
          "placeholder:text-gray-400 dark:placeholder:text-zinc-500",
          "transition-colors duration-150",
          "focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent",
          hasError
            ? "border-red-400 dark:border-red-500 focus:ring-red-400"
            : "border-gray-300 dark:border-zinc-600",
          disabled && "cursor-not-allowed opacity-60",
          !resize && "resize-none",
          autoResize && "overflow-hidden",
          className
        )}
        {...props}
      />

      {error ? (
        <p id={errorId} role="alert" className="mt-1.5 text-xs text-red-600 dark:text-red-400">
          {error}
        </p>
      ) : hint ? (
        <p id={hintId} className="mt-1.5 text-xs text-gray-500 dark:text-zinc-400">{hint}</p>
      ) : null}
    </div>
  );
});

Textarea.displayName = "Textarea";