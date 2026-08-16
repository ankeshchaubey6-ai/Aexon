import { forwardRef, useId, useEffect, useRef } from "react";
import { cn } from "../../utils/cn.js";

/**
 * Production Checkbox with label, description, error state, and
 * indeterminate support (for "select all" patterns).
 *
 * @param {string}          [label]
 * @param {string}          [description]   - Secondary text beneath label
 * @param {string}          [error]
 * @param {boolean}         [indeterminate] - Dash state for "select all"
 * @param {"sm"|"md"|"lg"}  [size="md"]
 *
 * @example
 * <Checkbox
 *   label="Accept terms & conditions"
 *   description="You agree to our privacy policy."
 *   checked={agreed}
 *   onChange={(e) => setAgreed(e.target.checked)}
 *   error={errors.agreed}
 * />
 *
 * // Select-all checkbox
 * <Checkbox
 *   label="Select all"
 *   indeterminate={someChecked && !allChecked}
 *   checked={allChecked}
 *   onChange={toggleAll}
 * />
 */
export const Checkbox = forwardRef(function Checkbox(
  {
    label,
    description,
    error,
    indeterminate,
    size        = "md",
    id: idProp,
    className,
    disabled,
    checked,
    ...props
  },
  ref
) {
  const autoId   = useId();
  const inputId  = idProp ?? autoId;
  const descId   = `${inputId}-desc`;
  const innerRef = useRef(null);
  const hasError = Boolean(error);

  // Merge refs
  const setRef = (el) => {
    innerRef.current = el;
    if (typeof ref === "function") ref(el);
    else if (ref) ref.current = el;
  };

  // Set indeterminate imperatively (can't be done via HTML attribute)
  useEffect(() => {
    if (innerRef.current) {
      innerRef.current.indeterminate = !!indeterminate;
    }
  }, [indeterminate]);

  const boxSize = { sm: "w-3.5 h-3.5", md: "w-4 h-4", lg: "w-5 h-5" }[size] ?? "w-4 h-4";
  const labelSize = { sm: "text-xs", md: "text-sm", lg: "text-base" }[size] ?? "text-sm";

  return (
    <div className={cn("relative flex items-start gap-3", className)}>
      <div className="flex items-center h-5 mt-0.5">
        <input
          ref={setRef}
          id={inputId}
          type="checkbox"
          disabled={disabled}
          checked={checked}
          aria-invalid={hasError}
          aria-describedby={description ? descId : undefined}
          className={cn(
            boxSize,
            "cursor-pointer rounded border-2 appearance-none",
            "transition-colors duration-100",
            "focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2",
            "dark:focus:ring-offset-zinc-900",
            // Unchecked
            "border-gray-300 dark:border-zinc-600 bg-white dark:bg-zinc-900",
            // Checked / indeterminate via Tailwind peer-checked (we use JS-driven custom styling)
            "checked:bg-blue-600 checked:border-blue-600",
            "indeterminate:bg-blue-600 indeterminate:border-blue-600",
            hasError && "border-red-400 dark:border-red-500",
            disabled && "opacity-50 cursor-not-allowed",
            // Checkmark drawn via box-shadow trick (works without pseudo-elements in Tailwind)
          )}
          style={
            checked && !indeterminate
              ? { backgroundImage: "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 12 12' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1.5 6l3 3 6-6' stroke='white' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E\")", backgroundRepeat: "no-repeat", backgroundPosition: "center", backgroundSize: "75%" }
              : indeterminate
              ? { backgroundImage: "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 12 12' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M2 6h8' stroke='white' stroke-width='2' stroke-linecap='round'/%3E%3C/svg%3E\")", backgroundRepeat: "no-repeat", backgroundPosition: "center" }
              : {}
          }
          {...props}
        />
      </div>

      {(label || description) && (
        <div className="flex flex-col">
          {label && (
            <label
              htmlFor={inputId}
              className={cn(labelSize, "font-medium text-gray-900 dark:text-gray-100 cursor-pointer leading-5", disabled && "opacity-50 cursor-not-allowed")}
            >
              {label}
            </label>
          )}
          {description && (
            <p id={descId} className="text-xs text-gray-500 dark:text-zinc-400 leading-relaxed mt-0.5">
              {description}
            </p>
          )}
          {error && (
            <p role="alert" className="text-xs text-red-600 dark:text-red-400 mt-0.5">{error}</p>
          )}
        </div>
      )}
    </div>
  );
});

Checkbox.displayName = "Checkbox";