import { createContext, useContext, useId, useState } from "react";
import { cn } from "../../utils/cn.js";

const TabsContext = createContext(null);

/**
 * Tabs — accessible tab navigation following WAI-ARIA pattern.
 *
 * @param {string}   [defaultValue]   - Uncontrolled initial active tab
 * @param {string}   [value]          - Controlled active tab
 * @param {function} [onChange]
 * @param {"line"|"enclosed"|"pills"|"lifted"|"soft"} [variant="line"]
 * @param {"sm"|"md"|"lg"} [size="md"]
 * @param {"top"|"left"} [orientation="top"]
 * @param {boolean}  [fullWidth=false]
 *
 * @example
 * <Tabs defaultValue="overview">
 *   <TabList>
 *     <Tab value="overview">Overview</Tab>
 *     <Tab value="analytics">Analytics</Tab>
 *     <Tab value="settings">Settings</Tab>
 *   </TabList>
 *   <TabPanel value="overview"><Overview /></TabPanel>
 *   <TabPanel value="analytics"><Analytics /></TabPanel>
 *   <TabPanel value="settings"><Settings /></TabPanel>
 * </Tabs>
 */
export function Tabs({
  defaultValue,
  value: controlledValue,
  onChange,
  variant     = "line",
  size        = "md",
  orientation = "top",
  fullWidth   = false,
  children,
  className,
  ...props
}) {
  const [internalValue, setInternalValue] = useState(defaultValue ?? "");
  const isControlled = controlledValue !== undefined;
  const activeValue  = isControlled ? controlledValue : internalValue;

  const setActive = (v) => {
    if (!isControlled) setInternalValue(v);
    onChange?.(v);
  };

  return (
    <TabsContext.Provider value={{ activeValue, setActive, variant, size, fullWidth, orientation }}>
      <div
        className={cn(
          orientation === "left" && "flex gap-6",
          className,
        )}
        {...props}
      >
        {children}
      </div>
    </TabsContext.Provider>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TabList
// ─────────────────────────────────────────────────────────────────────────────
const TABLIST_VARIANTS = {
  line:     "border-b border-gray-200 dark:border-zinc-700 gap-0",
  enclosed: "border border-gray-200 dark:border-zinc-700 rounded-xl p-1 bg-gray-50 dark:bg-zinc-900 gap-1",
  pills:    "gap-2",
  lifted:   "border-b border-gray-200 dark:border-zinc-700 gap-1",
  soft:     "gap-1",
};

export function TabList({ children, className, ...props }) {
  const { variant, fullWidth, orientation } = useContext(TabsContext);

  return (
    <div
      role="tablist"
      aria-orientation={orientation}
      className={cn(
        "flex items-center",
        orientation === "left" && "flex-col items-stretch shrink-0 w-44",
        fullWidth && "w-full",
        TABLIST_VARIANTS[variant] ?? TABLIST_VARIANTS.line,
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Tab
// ─────────────────────────────────────────────────────────────────────────────
const TAB_SIZE = {
  sm: "px-3 py-1.5 text-xs gap-1.5",
  md: "px-4 py-2   text-sm gap-2",
  lg: "px-5 py-2.5 text-base gap-2",
};

const TAB_ACTIVE = {
  line:     "border-b-2 border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400 -mb-px",
  enclosed: "bg-white dark:bg-zinc-800 text-gray-900 dark:text-zinc-100 shadow-sm rounded-lg",
  pills:    "bg-blue-600 text-white rounded-full shadow-sm",
  lifted:   "bg-white dark:bg-zinc-900 border border-b-white dark:border-zinc-700 dark:border-b-zinc-900 rounded-t-lg text-gray-900 dark:text-zinc-100 -mb-px",
  soft:     "bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 rounded-lg",
};

const TAB_IDLE = {
  line:     "border-b-2 border-transparent text-gray-500 dark:text-zinc-400 hover:text-gray-700 dark:hover:text-zinc-200 hover:border-gray-300 dark:hover:border-zinc-600 -mb-px",
  enclosed: "text-gray-500 dark:text-zinc-400 hover:text-gray-700 dark:hover:text-zinc-200 rounded-lg",
  pills:    "text-gray-600 dark:text-zinc-400 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-full",
  lifted:   "border border-transparent text-gray-500 dark:text-zinc-400 hover:text-gray-700 dark:hover:text-zinc-200 rounded-t-lg -mb-px",
  soft:     "text-gray-600 dark:text-zinc-400 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-lg",
};

/**
 * Tab — a single tab trigger.
 *
 * @param {string}          value
 * @param {boolean}         [disabled]
 * @param {React.ReactNode} [icon]
 * @param {number}          [count]   - Badge count shown next to label
 */
export function Tab({ value, disabled, icon, count, children, className, ...props }) {
  const { activeValue, setActive, variant, size, fullWidth } = useContext(TabsContext);
  const isActive = activeValue === value;
  const id       = useId();

  return (
    <button
      id={`tab-${id}`}
      role="tab"
      type="button"
      aria-selected={isActive}
      aria-controls={`panel-${id}`}
      disabled={disabled}
      tabIndex={isActive ? 0 : -1}
      onClick={() => !disabled && setActive(value)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setActive(value); }
      }}
      className={cn(
        "inline-flex items-center justify-center font-medium whitespace-nowrap",
        "transition-all duration-150 select-none",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2",
        "disabled:opacity-40 disabled:cursor-not-allowed",
        TAB_SIZE[size] ?? TAB_SIZE.md,
        isActive ? (TAB_ACTIVE[variant] ?? TAB_ACTIVE.line) : (TAB_IDLE[variant] ?? TAB_IDLE.line),
        fullWidth && "flex-1",
        className,
      )}
      {...props}
    >
      {icon && <span className="shrink-0">{icon}</span>}
      {children}
      {count != null && (
        <span className={cn(
          "ml-1 inline-flex items-center justify-center min-w-[1.1rem] h-[1.1rem] px-1 rounded-full text-[10px] font-semibold",
          isActive
            ? "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300"
            : "bg-gray-100 text-gray-600 dark:bg-zinc-700 dark:text-zinc-400",
        )}>
          {count}
        </span>
      )}
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TabPanel
// ─────────────────────────────────────────────────────────────────────────────

/**
 * TabPanel — the content area shown when its tab is active.
 * @param {string}  value        - Must match the corresponding Tab value
 * @param {boolean} [keepMounted=false] - Keep DOM when inactive (good for forms)
 */
export function TabPanel({ value, keepMounted = false, children, className, ...props }) {
  const { activeValue } = useContext(TabsContext);
  const id = useId();
  const isActive = activeValue === value;

  if (!keepMounted && !isActive) return null;

  return (
    <div
      id={`panel-${id}`}
      role="tabpanel"
      aria-labelledby={`tab-${id}`}
      hidden={!isActive}
      tabIndex={0}
      className={cn(
        "focus:outline-none",
        isActive && "animate-in fade-in duration-200",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}