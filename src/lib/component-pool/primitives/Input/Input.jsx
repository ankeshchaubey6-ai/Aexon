import { forwardRef, useId } from "react";
import { cn } from "../../utils/cn.js";

// ─────────────────────────────────────────────────────────────────────────────
// Size map
// ─────────────────────────────────────────────────────────────────────────────
const SIZES = {
  sm: { wrapper: "h-8",  input: "text-sm  px-3",    icon: "w-4 h-4" },
  md: { wrapper: "h-9",  input: "text-sm  px-3",    icon: "w-4 h-4" },
  lg: { wrapper: "h-11", input: "text-base px-4",   icon: "w-5 h-5" },
};

/**
 * Production Input component.
 *
 * @param {string}          [label]         - Floating label above the input
 * @param {string}          [error]         - Error message (also styles the border red)
 * @param {string}          [hint]          - Helper text below (hidden when error present)
 * @param {React.ReactNode} [leftElement]   - Icon or addon rendered inside left side
 * @param {React.ReactNode} [rightElement]  - Icon, button, or addon rendered inside right side
 * @param {React.ReactNode} [prefix]        - Text/element rendered as a left addon (outside border)
 * @param {React.ReactNode} [suffix]        - Text/element rendered as a right addon (outside border)
 * @param {"sm"|"md"|"lg"}  [size="md"]
 * @param {boolean}         [optional=false] - Appends "(optional)" to label
 * @param {boolean}         [required=false] - Appends "*" to label
 * @param {string}          [id]
 *
 * @example
 * <Input
 *   label="Email address"
 *   type="email"
 *   placeholder="you@example.com"
 *   leftElement={<MailIcon size={16} className="text-gray-400"/>}
 *   error={errors.email}
 *   required
 * />
 *
 * // With prefix addon
 * <Input label="Website" prefix="https://" placeholder="example.com" />
 */
export const Input = forwardRef(function Input(
  {
    label,
    error,
    hint,
    leftElement,
    rightElement,
    prefix,
    suffix,
    size        = "md",
    optional    = false,
    required    = false,
    id: idProp,
    className,
    disabled,
    readOnly,
    type        = "text",
    ...props
  },
  ref
) {
  const autoId  = useId();
  const inputId = idProp ?? autoId;
  const hintId  = `${inputId}-hint`;
  const errorId = `${inputId}-error`;

  const { wrapper, input, icon } = SIZES[size] ?? SIZES.md;
  const hasError = Boolean(error);

  return (
    <div className="w-full">
      {/* Label */}
      {label && (
        <label
          htmlFor={inputId}
          className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5"
        >
          {label}
          {required && <span className="ml-0.5 text-red-500" aria-hidden="true">*</span>}
          {optional && (
            <span className="ml-1.5 text-xs font-normal text-gray-400">(optional)</span>
          )}
        </label>
      )}

      {/* Input wrapper (handles prefix/suffix addons) */}
      <div className={cn("flex items-stretch", prefix || suffix ? "rounded-lg overflow-hidden border" : "", hasError ? "border-red-400 dark:border-red-500" : "border-gray-300 dark:border-zinc-600")}>
        {/* Prefix addon */}
        {prefix && (
          <div className="flex items-center px-3 bg-gray-50 dark:bg-zinc-800 border-r border-inherit text-sm text-gray-500 dark:text-gray-400 select-none whitespace-nowrap">
            {prefix}
          </div>
        )}

        {/* Inner wrapper (for left/right icon elements) */}
        <div className={cn("relative flex items-center flex-1", !prefix && !suffix && "rounded-lg border", !prefix && !suffix && (hasError ? "border-red-400 dark:border-red-500" : "border-gray-300 dark:border-zinc-600"))}>
          {/* Left element */}
          {leftElement && (
            <div className={cn("absolute left-3 flex items-center pointer-events-none text-gray-400 dark:text-zinc-500", icon)}>
              {leftElement}
            </div>
          )}

          <input
            ref={ref}
            id={inputId}
            type={type}
            disabled={disabled}
            readOnly={readOnly}
            required={required}
            aria-invalid={hasError}
            aria-describedby={cn(error && errorId, hint && hintId)}
            className={cn(
              // Base
              "w-full bg-white dark:bg-zinc-900",
              "text-gray-900 dark:text-gray-100",
              "placeholder:text-gray-400 dark:placeholder:text-zinc-500",
              // Sizing
              wrapper, input,
              // Padding overrides for icons
              leftElement  ? "pl-9"  : "",
              rightElement ? "pr-9"  : "",
              // Focus
              "focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-0",
              hasError && "focus:ring-red-400",
              // Disabled / readonly
              (disabled || readOnly) && "cursor-not-allowed opacity-60",
              // Border — suppressed when inside prefix/suffix wrapper
              (prefix || suffix) ? "border-0 focus:ring-0" : "rounded-lg",
              className
            )}
            {...props}
          />

          {/* Right element */}
          {rightElement && (
            <div className={cn("absolute right-3 flex items-center text-gray-400 dark:text-zinc-500", icon)}>
              {rightElement}
            </div>
          )}
        </div>

        {/* Suffix addon */}
        {suffix && (
          <div className="flex items-center px-3 bg-gray-50 dark:bg-zinc-800 border-l border-inherit text-sm text-gray-500 dark:text-gray-400 select-none whitespace-nowrap">
            {suffix}
          </div>
        )}
      </div>

      {/* Error / hint */}
      {error ? (
        <p id={errorId} role="alert" className="mt-1.5 text-xs text-red-600 dark:text-red-400 flex items-center gap-1">
          <svg viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5 shrink-0">
            <path d="M8 1a7 7 0 100 14A7 7 0 008 1zm-.75 4a.75.75 0 011.5 0v3a.75.75 0 01-1.5 0V5zm.75 7a1 1 0 110-2 1 1 0 010 2z"/>
          </svg>
          {error}
        </p>
      ) : hint ? (
        <p id={hintId} className="mt-1.5 text-xs text-gray-500 dark:text-zinc-400">{hint}</p>
      ) : null}
    </div>
  );
});

Input.displayName = "Input";