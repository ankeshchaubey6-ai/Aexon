import { cn } from "../../utils/cn.js";

/**
 * Spacer — inserts explicit whitespace between layout elements.
 * Accepts Tailwind spacing values or a `flex-1` grow mode.
 *
 * @param {"1"|"2"|"3"|"4"|"5"|"6"|"8"|"10"|"12"|"16"|"20"|"24"|"32"|"flex"} [size="4"]
 * @param {"both"|"x"|"y"} [axis="both"]  - Which axis to space (both = width + height)
 * @param {boolean} [flex=false]           - Shortcut for size="flex"
 *
 * @example
 * // Vertical gap between sections
 * <Section />
 * <Spacer size="16" axis="y" />
 * <Section />
 *
 * // Push elements to opposite ends of a flex row
 * <div className="flex items-center">
 *   <Logo />
 *   <Spacer flex />
 *   <Button>Sign in</Button>
 * </div>
 *
 * // Fixed square gap
 * <Spacer size="8" />
 */
export function Spacer({
  size = "4",
  axis = "both",
  flex = false,
  className,
  ...props
}) {
  if (flex || size === "flex") {
    return <span className={cn("flex-1", className)} aria-hidden="true" {...props} />;
  }

  const sizeMap = {
    px:   "1px",
    "0":  "0px",
    "0.5":"0.125rem",
    "1":  "0.25rem",
    "1.5":"0.375rem",
    "2":  "0.5rem",
    "2.5":"0.625rem",
    "3":  "0.75rem",
    "3.5":"0.875rem",
    "4":  "1rem",
    "5":  "1.25rem",
    "6":  "1.5rem",
    "7":  "1.75rem",
    "8":  "2rem",
    "9":  "2.25rem",
    "10": "2.5rem",
    "11": "2.75rem",
    "12": "3rem",
    "14": "3.5rem",
    "16": "4rem",
    "20": "5rem",
    "24": "6rem",
    "28": "7rem",
    "32": "8rem",
    "36": "9rem",
    "40": "10rem",
    "48": "12rem",
    "56": "14rem",
    "64": "16rem",
    "80": "20rem",
    "96": "24rem",
  };

  const px = sizeMap[String(size)] ?? `${size}px`;

  const style = {
    both: { display: "block", width: px, height: px, flexShrink: 0 },
    x:    { display: "inline-block", width: px, flexShrink: 0 },
    y:    { display: "block", height: px, flexShrink: 0 },
  }[axis] ?? { display: "block", width: px, height: px, flexShrink: 0 };

  return (
    <span
      aria-hidden="true"
      style={style}
      className={className}
      {...props}
    />
  );
}