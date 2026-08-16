import { cn } from "../../utils/cn.js";

/**
 * Chip — an interactive, selectable element used in filter rows,
 * contact/people pickers, and attribute selectors.
 *
 * The key difference from Tag and Badge:
 * - Badge  → read-only status indicator
 * - Tag    → label attached to content (blog posts, etc.)
 * - Chip   → interactive: selectable, optionally avatar-fronted, form-like
 *
 * @param {boolean}          [selected=false]
 * @param {function}         [onSelect]         - Called when chip is clicked
 * @param {function}         [onDismiss]        - Renders × to remove chip
 * @param {React.ReactNode}  [avatar]           - Avatar/icon shown before label
 * @param {React.ReactNode}  [leftIcon]
 * @param {React.ReactNode}  [rightIcon]
 * @param {"sm"|"md"|"lg"}   [size="md"]
 * @param {"filled"|"outline"|"ghost"} [variant="filled"]
 * @param {boolean}          [disabled]
 *
 * @example
 * // Filter chip bar
 * {categories.map(cat => (
 *   <Chip
 *     key={cat.id}
 *     selected={filters.includes(cat.id)}
 *     onSelect={() => toggleFilter(cat.id)}
 *   >
 *     {cat.label}
 *   </Chip>
 * ))}
 *
 * // Contact / people picker chip
 * <Chip
 *   avatar={<Avatar src={user.avatar} name={user.name} size="xs"/>}
 *   onDismiss={() => removeRecipient(user.id)}
 *   selected
 * >
 *   {user.name}
 * </Chip>
 */
export function Chip({
  selected   = false,
  onSelect,
  onDismiss,
  avatar,
  leftIcon,
  rightIcon,
  size       = "md",
  variant    = "filled",
  disabled   = false,
  children,
  className,
  ...props
}) {
  const isClickable = Boolean(onSelect);

  const sizeClass = {
    sm: "h-6  px-2   text-xs  gap-1   rounded-full",
    md: "h-7  px-2.5 text-xs  gap-1.5 rounded-full",
    lg: "h-8  px-3   text-sm  gap-1.5 rounded-full",
  }[size] ?? "h-7 px-2.5 text-xs gap-1.5 rounded-full";

  // Variant + selected state styles
  const styleMap = {
    filled: {
      base:     "bg-gray-100 text-gray-700 dark:bg-zinc-800 dark:text-zinc-300 border border-gray-200 dark:border-zinc-700",
      selected: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300 border-blue-200 dark:border-blue-700",
    },
    outline: {
      base:     "bg-transparent text-gray-700 dark:text-zinc-300 border-2 border-gray-300 dark:border-zinc-600",
      selected: "bg-transparent text-blue-700 dark:text-blue-300 border-2 border-blue-500 dark:border-blue-400",
    },
    ghost: {
      base:     "bg-transparent text-gray-700 dark:text-zinc-300 border border-transparent",
      selected: "bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800",
    },
  };

  const variantClass = styleMap[variant] ?? styleMap.filled;
  const stateClass   = selected ? variantClass.selected : variantClass.base;

  const avatarSize = { sm: "w-4 h-4", md: "w-5 h-5", lg: "w-6 h-6" }[size] ?? "w-5 h-5";

  const content = (
    <>
      {avatar && (
        <span className={cn("shrink-0 rounded-full overflow-hidden -ml-0.5", avatarSize)}>
          {avatar}
        </span>
      )}
      {leftIcon && <span className="shrink-0">{leftIcon}</span>}
      <span className="truncate max-w-[160px]">{children}</span>
      {rightIcon && !onDismiss && <span className="shrink-0">{rightIcon}</span>}
      {onDismiss && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onDismiss(); }}
          disabled={disabled}
          className="shrink-0 -mr-0.5 rounded-full hover:opacity-70 focus:outline-none focus:ring-1 focus:ring-current"
          aria-label="Remove"
        >
          <svg viewBox="0 0 12 12" fill="currentColor" className="w-3 h-3">
            <path d="M6 4.94L9.47 1.47l1.06 1.06L7.06 6l3.47 3.47-1.06 1.06L6 7.06 2.53 10.53 1.47 9.47 4.94 6 1.47 2.53 2.53 1.47 6 4.94z"/>
          </svg>
        </button>
      )}
    </>
  );

  if (isClickable) {
    return (
      <button
        type="button"
        onClick={() => !disabled && onSelect?.()}
        disabled={disabled}
        aria-pressed={selected}
        className={cn(
          "inline-flex items-center font-medium transition-all duration-100",
          "focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 dark:focus:ring-offset-zinc-900",
          "disabled:opacity-40 disabled:cursor-not-allowed",
          isClickable && "cursor-pointer hover:opacity-80",
          sizeClass,
          stateClass,
          className
        )}
        {...props}
      >
        {content}
      </button>
    );
  }

  return (
    <span
      className={cn(
        "inline-flex items-center font-medium",
        sizeClass,
        stateClass,
        disabled && "opacity-40",
        className
      )}
      {...props}
    >
      {content}
    </span>
  );
}

/**
 * ChipGroup — a horizontal scrollable group of Chips.
 * Handles overflow gracefully on mobile with scroll indicators.
 *
 * @example
 * <ChipGroup>
 *   {categories.map(cat => <Chip key={cat.id} onSelect={...}>{cat.label}</Chip>)}
 * </ChipGroup>
 */
export function ChipGroup({ children, className, scrollable = true, ...props }) {
  return (
    <div
      className={cn(
        "flex items-center gap-2 flex-wrap",
        scrollable && "overflow-x-auto scrollbar-none pb-1 flex-nowrap",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}