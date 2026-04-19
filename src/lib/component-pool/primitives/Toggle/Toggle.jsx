import { createContext, useContext, useId } from "react";
import { cn } from "../../utils/cn.js";

// ─────────────────────────────────────────────────────────────────────────────
// Context
// ─────────────────────────────────────────────────────────────────────────────
const ToggleContext = createContext(null);

/**
 * ToggleGroup — a segmented button bar where only one (or multiple) items
 * can be active at a time. Great for view-mode selectors, filter tabs,
 * billing period switches, etc.
 *
 * @param {string|string[]}  value         - Controlled active value(s)
 * @param {function}         onChange      - (value | value[]) => void
 * @param {"single"|"multi"} [type="single"]
 * @param {"sm"|"md"|"lg"}   [size="md"]
 * @param {"default"|"pills"|"underline"|"outline"} [variant="default"]
 * @param {"horizontal"|"vertical"} [orientation="horizontal"]
 * @param {boolean}          [fullWidth=false]
 *
 * @example
 * // Billing period toggle
 * const [period, setPeriod] = useState("monthly");
 * <ToggleGroup value={period} onChange={setPeriod}>
 *   <ToggleItem value="monthly">Monthly</ToggleItem>
 *   <ToggleItem value="annual">Annual  <span className="ml-1 text-xs text-emerald-500">-20%</span></ToggleItem>
 * </ToggleGroup>
 *
 * // Multi-select filter
 * const [filters, setFilters] = useState([]);
 * <ToggleGroup type="multi" value={filters} onChange={setFilters} variant="pills">
 *   <ToggleItem value="design">Design</ToggleItem>
 *   <ToggleItem value="dev">Development</ToggleItem>
 *   <ToggleItem value="product">Product</ToggleItem>
 * </ToggleGroup>
 */
export function ToggleGroup({
  value,
  onChange,
  type          = "single",
  size          = "md",
  variant       = "default",
  orientation   = "horizontal",
  fullWidth     = false,
  children,
  className,
  ...props
}) {
  const isVertical = orientation === "vertical";

  const handleSelect = (itemValue) => {
    if (!onChange) return;
    if (type === "multi") {
      const current = Array.isArray(value) ? value : [];
      onChange(
        current.includes(itemValue)
          ? current.filter((v) => v !== itemValue)
          : [...current, itemValue]
      );
    } else {
      onChange(value === itemValue ? null : itemValue);
    }
  };

  const isActive = (itemValue) => {
    if (type === "multi") return Array.isArray(value) && value.includes(itemValue);
    return value === itemValue;
  };

  // Wrapper classes per variant
  const wrapperClass = {
    default:  "inline-flex bg-gray-100 dark:bg-zinc-800 p-1 rounded-lg gap-0.5",
    pills:    "inline-flex flex-wrap gap-2",
    underline:"inline-flex border-b border-gray-200 dark:border-zinc-700 gap-0",
    outline:  "inline-flex border border-gray-200 dark:border-zinc-700 rounded-lg overflow-hidden divide-x divide-gray-200 dark:divide-zinc-700",
  }[variant] ?? "";

  return (
    <ToggleContext.Provider value={{ size, variant, isActive, onSelect: handleSelect }}>
      <div
        role={type === "single" ? "radiogroup" : "group"}
        className={cn(
          wrapperClass,
          isVertical && "flex-col",
          fullWidth && "w-full",
          className
        )}
        {...props}
      >
        {children}
      </div>
    </ToggleContext.Provider>
  );
}

/**
 * ToggleItem — a single option inside ToggleGroup.
 *
 * @param {string}          value
 * @param {boolean}         [disabled]
 * @param {React.ReactNode} [leftIcon]
 * @param {React.ReactNode} [rightIcon]
 *
 * @example
 * <ToggleItem value="grid" leftIcon={<GridIcon size={14}/>}>Grid</ToggleItem>
 */
export function ToggleItem({
  value,
  disabled,
  leftIcon,
  rightIcon,
  children,
  className,
  ...props
}) {
  const ctx  = useContext(ToggleContext);
  const id   = useId();
  const active   = ctx?.isActive(value) ?? false;
  const size     = ctx?.size ?? "md";
  const variant  = ctx?.variant ?? "default";

  const sizeClass = {
    sm: "text-xs px-2.5 py-1   gap-1",
    md: "text-sm px-3   py-1.5 gap-1.5",
    lg: "text-sm px-4   py-2   gap-2",
  }[size] ?? "text-sm px-3 py-1.5 gap-1.5";

  // Active + idle styles per variant
  const activeStyle = {
    default:  "bg-white dark:bg-zinc-700 text-gray-900 dark:text-white shadow-sm",
    pills:    "bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800",
    underline:"border-b-2 border-blue-600 dark:border-blue-400 text-blue-600 dark:text-blue-400 -mb-px",
    outline:  "bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300",
  }[variant] ?? "";

  const idleStyle = {
    default:  "text-gray-600 dark:text-zinc-400 hover:text-gray-900 dark:hover:text-zinc-200",
    pills:    "text-gray-600 dark:text-zinc-400 hover:bg-gray-100 dark:hover:bg-zinc-800 border border-transparent",
    underline:"text-gray-500 dark:text-zinc-400 hover:text-gray-700 dark:hover:text-zinc-200 border-b-2 border-transparent -mb-px",
    outline:  "text-gray-600 dark:text-zinc-400 hover:bg-gray-50 dark:hover:bg-zinc-800",
  }[variant] ?? "";

  const baseShape = {
    default:  "rounded-md",
    pills:    "rounded-full",
    underline:"rounded-none pb-2",
    outline:  "rounded-none first:rounded-l-lg last:rounded-r-lg",
  }[variant] ?? "rounded-md";

  return (
    <button
      id={id}
      type="button"
      role="radio"
      aria-checked={active}
      disabled={disabled}
      onClick={() => !disabled && ctx?.onSelect(value)}
      className={cn(
        "inline-flex items-center justify-center font-medium whitespace-nowrap",
        "transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500",
        "disabled:pointer-events-none disabled:opacity-40",
        sizeClass,
        baseShape,
        active ? activeStyle : idleStyle,
        className
      )}
      {...props}
    >
      {leftIcon  && <span className="shrink-0">{leftIcon}</span>}
      {children}
      {rightIcon && <span className="shrink-0">{rightIcon}</span>}
    </button>
  );
}







