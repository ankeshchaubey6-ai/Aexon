import { cn } from "../../utils/cn.js";

/**
 * Divider — a semantic separator line between content sections.
 *
 * @param {"horizontal"|"vertical"} [orientation="horizontal"]
 * @param {React.ReactNode} [label]        - Text or element centered on the line
 * @param {"left"|"center"|"right"}  [labelAlign="center"]
 * @param {"solid"|"dashed"|"dotted"} [variant="solid"]
 * @param {"xs"|"sm"|"md"|"lg"}      [spacing="md"]  - Vertical margin
 * @param {string}                   [color]          - Tailwind border-color class
 *
 * @example
 * // Plain separator
 * <Divider />
 *
 * // "Or" divider (auth forms)
 * <Divider label="or continue with" />
 *
 * // Section title divider
 * <Divider label={<span className="font-semibold text-gray-900">Advanced</span>} labelAlign="left" />
 *
 * // Vertical (inside flex rows)
 * <div className="flex items-center h-8">
 *   <span>Left</span>
 *   <Divider orientation="vertical" spacing="none" className="mx-3" />
 *   <span>Right</span>
 * </div>
 */
export function Divider({
  orientation  = "horizontal",
  label,
  labelAlign   = "center",
  variant      = "solid",
  spacing      = "md",
  color        = "border-gray-200 dark:border-zinc-700",
  className,
  ...props
}) {
  const marginY = {
    none: "",
    xs:   "my-2",
    sm:   "my-3",
    md:   "my-4",
    lg:   "my-6",
    xl:   "my-8",
  }[spacing] ?? "my-4";

  const borderStyle = {
    solid:  "border-solid",
    dashed: "border-dashed",
    dotted: "border-dotted",
  }[variant] ?? "border-solid";

  // Vertical divider
  if (orientation === "vertical") {
    return (
      <span
        role="separator"
        aria-orientation="vertical"
        className={cn("inline-block self-stretch w-px border-l", borderStyle, color, className)}
        {...props}
      />
    );
  }

  // Horizontal — no label
  if (!label) {
    return (
      <hr
        role="separator"
        className={cn("w-full border-t", borderStyle, color, marginY, className)}
        {...props}
      />
    );
  }

  // Horizontal — with label
  const align = {
    left:   "flex-row",
    center: "flex-row",
    right:  "flex-row-reverse",
  }[labelAlign] ?? "flex-row";

  const lineLeft  = labelAlign === "left"   ? "w-8 shrink-0"  : "flex-1";
  const lineRight = labelAlign === "right"  ? "w-8 shrink-0"  : "flex-1";

  return (
    <div
      role="separator"
      className={cn("flex items-center gap-3", align, marginY, className)}
      {...props}
    >
      <span className={cn("block border-t", borderStyle, color, lineLeft)} />
      <span className="shrink-0 text-xs text-gray-400 dark:text-zinc-500 whitespace-nowrap select-none">
        {label}
      </span>
      <span className={cn("block border-t", borderStyle, color, lineRight)} />
    </div>
  );
}