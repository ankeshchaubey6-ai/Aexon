import { forwardRef, useId } from "react";
import { cn } from "../../utils/cn.js";

/**
 * Toggle Switch (iOS-style) with label and description support.
 *
 * @param {boolean}  [checked]
 * @param {function} [onChange]
 * @param {string}   [label]
 * @param {string}   [description]
 * @param {"sm"|"md"|"lg"} [size="md"]
 * @param {"left"|"right"} [labelPosition="right"] - Which side the label appears
 * @param {string}   [onLabel]   - Text inside track when ON (e.g. "Yes")
 * @param {string}   [offLabel]  - Text inside track when OFF (e.g. "No")
 *
 * @example
 * <Switch
 *   label="Email notifications"
 *   description="Receive emails about your account activity."
 *   checked={emailEnabled}
 *   onChange={(e) => setEmailEnabled(e.target.checked)}
 * />
 */
export const Switch = forwardRef(function Switch(
  {
    checked,
    onChange,
    label,
    description,
    size           = "md",
    labelPosition  = "right",
    onLabel,
    offLabel,
    disabled,
    id: idProp,
    className,
    ...props
  },
  ref
) {
  const autoId  = useId();
  const inputId = idProp ?? autoId;

  const track = {
    sm: "w-8  h-4",
    md: "w-11 h-6",
    lg: "w-14 h-7",
  }[size] ?? "w-11 h-6";

  const thumb = {
    sm: "w-3  h-3  translate-x-0.5",
    md: "w-4  h-4  translate-x-1",
    lg: "w-5  h-5  translate-x-1",
  }[size] ?? "w-4 h-4 translate-x-1";

  const checkedTranslate = {
    sm: "translate-x-4",
    md: "translate-x-6",
    lg: "translate-x-8",
  }[size] ?? "translate-x-6";

  const textSize = { sm: "text-xs", md: "text-sm", lg: "text-base" }[size];

  const switchEl = (
    <div className="relative inline-flex shrink-0 items-center cursor-pointer">
      <input
        ref={ref}
        id={inputId}
        type="checkbox"
        role="switch"
        checked={checked}
        onChange={onChange}
        disabled={disabled}
        aria-checked={checked}
        className="sr-only peer"
        {...props}
      />
      <label
        htmlFor={inputId}
        className={cn(
          // Track
          "flex items-center rounded-full transition-colors duration-200 cursor-pointer",
          track,
          checked ? "bg-blue-600" : "bg-gray-200 dark:bg-zinc-700",
          disabled && "opacity-50 cursor-not-allowed",
        )}
      >
        {/* Inner labels */}
        {(onLabel || offLabel) && (
          <span className={cn("absolute text-white font-semibold select-none pointer-events-none", size === "sm" ? "text-[8px]" : "text-[10px]", checked ? "left-1.5" : "right-1.5")}>
            {checked ? onLabel : offLabel}
          </span>
        )}
        {/* Thumb */}
        <span
          className={cn(
            "block rounded-full bg-white shadow-sm transition-transform duration-200",
            thumb,
            checked ? checkedTranslate : ""
          )}
        />
      </label>
    </div>
  );

  if (!label && !description) return switchEl;

  return (
    <div className={cn("flex items-center gap-3", labelPosition === "left" && "flex-row-reverse justify-end", className)}>
      {switchEl}
      {(label || description) && (
        <div className="flex flex-col">
          {label && (
            <span className={cn(textSize, "font-medium text-gray-900 dark:text-gray-100 cursor-pointer", disabled && "opacity-50")}>
              {label}
            </span>
          )}
          {description && (
            <span className="text-xs text-gray-500 dark:text-zinc-400 leading-relaxed mt-0.5">
              {description}
            </span>
          )}
        </div>
      )}
    </div>
  );
});

Switch.displayName = "Switch";