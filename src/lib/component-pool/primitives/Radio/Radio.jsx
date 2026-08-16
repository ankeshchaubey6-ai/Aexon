import { forwardRef, useId, createContext, useContext } from "react";
import { cn } from "../../utils/cn.js";

// Context to share name + value from RadioGroup to Radio
const RadioContext = createContext(null);

/**
 * RadioGroup — wraps a set of Radio buttons sharing the same name.
 *
 * @param {string}   name           - Required: input name attribute
 * @param {string}   [value]        - Controlled selected value
 * @param {function} [onChange]     - (value: string) => void
 * @param {"vertical"|"horizontal"|"cards"} [orientation="vertical"]
 * @param {string}   [label]        - Group label
 * @param {string}   [error]
 *
 * @example
 * <RadioGroup name="plan" value={plan} onChange={setPlan} label="Billing plan">
 *   <Radio value="monthly" label="Monthly" description="Billed every month" />
 *   <Radio value="annual"  label="Annual"  description="Save 20%" />
 * </RadioGroup>
 */
export function RadioGroup({
  name,
  value,
  onChange,
  orientation = "vertical",
  label,
  error,
  hint,
  children,
  className,
}) {
  return (
    <RadioContext.Provider value={{ name, selectedValue: value, onChange }}>
      <fieldset className={cn("w-full", className)}>
        {label && (
          <legend className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
            {label}
          </legend>
        )}
        <div className={cn(
          orientation === "horizontal" ? "flex flex-wrap gap-4"
          : orientation === "cards"   ? "grid gap-3 sm:grid-cols-2"
          : "flex flex-col gap-3"
        )}>
          {children}
        </div>
        {error && <p role="alert" className="mt-2 text-xs text-red-600 dark:text-red-400">{error}</p>}
        {!error && hint && <p className="mt-2 text-xs text-gray-500 dark:text-zinc-400">{hint}</p>}
      </fieldset>
    </RadioContext.Provider>
  );
}

/**
 * Radio button — must be used inside RadioGroup.
 *
 * @param {string}          value
 * @param {string}          [label]
 * @param {string}          [description]
 * @param {React.ReactNode} [icon]        - Icon shown in card variant
 * @param {boolean}         [disabled]
 *
 * @example
 * <Radio value="pro" label="Pro" description="$20/month" icon={<StarIcon/>} />
 */
export const Radio = forwardRef(function Radio(
  { value, label, description, icon, disabled, className, ...props },
  ref
) {
  const ctx      = useContext(RadioContext);
  const autoId   = useId();
  const isChecked = ctx?.selectedValue === value;

  const handleChange = () => ctx?.onChange?.(value);

  return (
    <label
      htmlFor={autoId}
      className={cn(
        "relative flex items-start gap-3 cursor-pointer",
        "p-0",
        disabled && "opacity-50 cursor-not-allowed",
        className
      )}
    >
      <div className="flex items-center h-5 mt-0.5 shrink-0">
        <input
          ref={ref}
          id={autoId}
          type="radio"
          name={ctx?.name}
          value={value}
          checked={isChecked}
          disabled={disabled}
          onChange={handleChange}
          className={cn(
            "w-4 h-4 appearance-none rounded-full border-2 transition-colors",
            "focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-zinc-900",
            isChecked
              ? "border-blue-600 bg-blue-600"
              : "border-gray-300 dark:border-zinc-600 bg-white dark:bg-zinc-900"
          )}
          style={isChecked ? {
            backgroundImage: "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 12 12' xmlns='http://www.w3.org/2000/svg'%3E%3Ccircle cx='6' cy='6' r='3' fill='white'/%3E%3C/svg%3E\")",
            backgroundRepeat: "no-repeat",
            backgroundPosition: "center",
          } : {}}
          {...props}
        />
      </div>

      {(label || description) && (
        <div>
          {label && (
            <span className="block text-sm font-medium text-gray-900 dark:text-gray-100">{label}</span>
          )}
          {description && (
            <span className="block text-xs text-gray-500 dark:text-zinc-400 mt-0.5">{description}</span>
          )}
        </div>
      )}
    </label>
  );
});

Radio.displayName = "Radio";

/**
 * RadioCard — a card-style radio option with icon, title, description.
 * Use inside RadioGroup with orientation="cards".
 *
 * @example
 * <RadioGroup name="billing" value={plan} onChange={setPlan} orientation="cards">
 *   <RadioCard value="starter" title="Starter" description="For individuals" icon={<UserIcon/>} price="$9/mo" />
 *   <RadioCard value="pro"     title="Pro"     description="For teams"        icon={<UsersIcon/>} price="$29/mo" />
 * </RadioGroup>
 */
export function RadioCard({ value, title, description, icon, price, badge, disabled, className }) {
  const ctx       = useContext(RadioContext);
  const autoId    = useId();
  const isChecked = ctx?.selectedValue === value;

  return (
    <label
      htmlFor={autoId}
      className={cn(
        "relative flex flex-col gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all duration-150",
        isChecked
          ? "border-blue-600 bg-blue-50 dark:bg-blue-950 dark:border-blue-400"
          : "border-gray-200 dark:border-zinc-700 hover:border-gray-300 dark:hover:border-zinc-600 bg-white dark:bg-zinc-900",
        disabled && "opacity-50 cursor-not-allowed",
        className
      )}
    >
      <input
        id={autoId}
        type="radio"
        name={ctx?.name}
        value={value}
        checked={isChecked}
        disabled={disabled}
        onChange={() => ctx?.onChange?.(value)}
        className="sr-only"
      />

      <div className="flex items-start justify-between gap-2">
        {icon && (
          <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center shrink-0",
            isChecked ? "bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300" : "bg-gray-100 dark:bg-zinc-800 text-gray-500")}>
            {icon}
          </div>
        )}
        {/* Checked indicator ring */}
        <div className={cn("w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 mt-1",
          isChecked ? "border-blue-600" : "border-gray-300 dark:border-zinc-600")}>
          {isChecked && <div className="w-2 h-2 rounded-full bg-blue-600" />}
        </div>
      </div>

      <div>
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">{title}</span>
          {badge && <span className="text-xs px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300 font-medium">{badge}</span>}
        </div>
        {description && <p className="text-xs text-gray-500 dark:text-zinc-400 mt-0.5">{description}</p>}
        {price && <p className="text-sm font-semibold text-blue-600 dark:text-blue-400 mt-1">{price}</p>}
      </div>
    </label>
  );
}