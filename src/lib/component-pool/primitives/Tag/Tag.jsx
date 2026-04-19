import { cn } from "../../utils/cn.js";

/**
 * Tag — a small keyword label, typically used in:
 * - Blog post categories
 * - Search filter chips
 * - CMS tag lists
 * - Selectable filter pills
 *
 * Different from Badge in that Tags are usually clickable/selectable
 * and always dismissible, whereas Badges are status indicators.
 *
 * @param {string}   [color]       - Preset color name or any Tailwind bg class
 * @param {boolean}  [selected]    - Toggled/active state
 * @param {function} [onDismiss]   - Shows × when provided
 * @param {function} [onClick]     - Makes tag clickable/selectable
 * @param {"sm"|"md"|"lg"} [size="sm"]
 * @param {React.ReactNode} [leftIcon]
 *
 * @example
 * // Static label
 * <Tag>React</Tag>
 * <Tag color="blue">TypeScript</Tag>
 *
 * // Selectable filter
 * <Tag selected={active} onClick={() => toggle("design")}>Design</Tag>
 *
 * // Dismissible
 * <Tag onDismiss={() => removeTag("react")}>React</Tag>
 */

const COLOR_PRESETS = {
  gray:    "bg-gray-100   text-gray-700   dark:bg-zinc-800  dark:text-zinc-300",
  blue:    "bg-blue-100   text-blue-700   dark:bg-blue-900  dark:text-blue-300",
  violet:  "bg-violet-100 text-violet-700 dark:bg-violet-900 dark:text-violet-300",
  green:   "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300",
  yellow:  "bg-amber-100  text-amber-700  dark:bg-amber-900  dark:text-amber-300",
  red:     "bg-red-100    text-red-700    dark:bg-red-900    dark:text-red-300",
  pink:    "bg-pink-100   text-pink-700   dark:bg-pink-900   dark:text-pink-300",
  sky:     "bg-sky-100    text-sky-700    dark:bg-sky-900    dark:text-sky-300",
  orange:  "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300",
  teal:    "bg-teal-100   text-teal-700   dark:bg-teal-900   dark:text-teal-300",
};

const SIZES = {
  sm: "px-2   py-0.5 text-xs  gap-1   rounded",
  md: "px-2.5 py-1   text-xs  gap-1.5 rounded-md",
  lg: "px-3   py-1   text-sm  gap-1.5 rounded-md",
};

export function Tag({
  color      = "gray",
  selected   = false,
  onDismiss,
  onClick,
  size       = "sm",
  leftIcon,
  children,
  className,
  ...props
}) {
  const colorClass  = COLOR_PRESETS[color] ?? color;
  const isClickable = Boolean(onClick);

  const selectedOverlay = selected
    ? "ring-2 ring-blue-500 ring-offset-1 dark:ring-offset-zinc-900"
    : "";

  const Tag = isClickable ? "button" : "span";

  return (
    <Tag
      type={isClickable ? "button" : undefined}
      onClick={onClick}
      className={cn(
        "inline-flex items-center font-medium transition-all duration-100",
        SIZES[size] ?? SIZES.sm,
        colorClass,
        isClickable && "cursor-pointer hover:opacity-80 focus:outline-none focus:ring-2 focus:ring-blue-500",
        selectedOverlay,
        className
      )}
      {...props}
    >
      {leftIcon && <span className="shrink-0">{leftIcon}</span>}
      {children}
      {onDismiss && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onDismiss(); }}
          className="shrink-0 ml-0.5 hover:opacity-70 rounded focus:outline-none"
          aria-label="Remove tag"
        >
          <svg viewBox="0 0 12 12" fill="currentColor" className="w-3 h-3">
            <path d="M6 4.94L9.47 1.47l1.06 1.06L7.06 6l3.47 3.47-1.06 1.06L6 7.06 2.53 10.53 1.47 9.47 4.94 6 1.47 2.53 2.53 1.47 6 4.94z"/>
          </svg>
        </button>
      )}
    </Tag>
  );
}

/**
 * TagInput — an input field that manages a list of tags.
 * Press Enter or comma to add a tag.
 *
 * @param {string[]} tags
 * @param {function} onChange      - (tags: string[]) => void
 * @param {string}   [placeholder]
 * @param {number}   [maxTags]
 * @param {string}   [tagColor]
 *
 * @example
 * const [tags, setTags] = useState([]);
 * <TagInput tags={tags} onChange={setTags} placeholder="Add tag…" maxTags={10} />
 */
export function TagInput({ tags = [], onChange, placeholder = "Add tag…", maxTags, tagColor = "blue", className }) {
  const addTag = (e) => {
    if (e.key !== "Enter" && e.key !== ",") return;
    e.preventDefault();
    const val = e.target.value.trim().replace(/,$/, "");
    if (!val || tags.includes(val) || (maxTags && tags.length >= maxTags)) return;
    onChange([...tags, val]);
    e.target.value = "";
  };

  const removeTag = (tag) => onChange(tags.filter((t) => t !== tag));

  return (
    <div className={cn("flex flex-wrap items-center gap-1.5 min-h-[2.5rem] w-full rounded-lg border border-gray-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 px-3 py-1.5 focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-transparent transition-colors", className)}>
      {tags.map((tag) => (
        <Tag key={tag} color={tagColor} size="sm" onDismiss={() => removeTag(tag)}>{tag}</Tag>
      ))}
      <input
        type="text"
        onKeyDown={addTag}
        placeholder={(!maxTags || tags.length < maxTags) ? placeholder : `Max ${maxTags} tags`}
        disabled={maxTags != null && tags.length >= maxTags}
        className="flex-1 min-w-[120px] bg-transparent outline-none text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-zinc-500 disabled:cursor-not-allowed"
      />
    </div>
  );
}