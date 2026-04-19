import { forwardRef } from "react";
import { cn } from "../../utils/cn.js";

// ─────────────────────────────────────────────────────────────────────────────
// Variant → Tailwind class map
// Every variant handles: default, hover, active, focus, disabled, dark mode
// ─────────────────────────────────────────────────────────────────────────────
const VARIANTS = {
  primary: [
    "bg-blue-600 text-white border border-transparent",
    "hover:bg-blue-700 active:bg-blue-800",
    "shadow-sm hover:shadow-md",
    "dark:bg-blue-500 dark:hover:bg-blue-600 dark:active:bg-blue-700",
  ].join(" "),

  secondary: [
    "bg-white text-gray-700 border border-gray-200",
    "hover:bg-gray-50 hover:border-gray-300 active:bg-gray-100",
    "shadow-sm",
    "dark:bg-zinc-800 dark:text-zinc-100 dark:border-zinc-700",
    "dark:hover:bg-zinc-700 dark:hover:border-zinc-600",
  ].join(" "),

  ghost: [
    "bg-transparent text-gray-700 border border-transparent",
    "hover:bg-gray-100 active:bg-gray-200",
    "dark:text-zinc-300 dark:hover:bg-zinc-800 dark:active:bg-zinc-700",
  ].join(" "),

  outline: [
    "bg-transparent text-blue-600 border-2 border-blue-600",
    "hover:bg-blue-50 active:bg-blue-100",
    "dark:text-blue-400 dark:border-blue-400 dark:hover:bg-blue-950",
  ].join(" "),

  danger: [
    "bg-red-600 text-white border border-transparent",
    "hover:bg-red-700 active:bg-red-800",
    "shadow-sm hover:shadow-md",
    "dark:bg-red-500 dark:hover:bg-red-600",
  ].join(" "),

  "danger-outline": [
    "bg-transparent text-red-600 border-2 border-red-500",
    "hover:bg-red-50 active:bg-red-100",
    "dark:text-red-400 dark:border-red-400 dark:hover:bg-red-950",
  ].join(" "),

  success: [
    "bg-emerald-600 text-white border border-transparent",
    "hover:bg-emerald-700 active:bg-emerald-800",
    "shadow-sm",
    "dark:bg-emerald-500 dark:hover:bg-emerald-600",
  ].join(" "),

  warning: [
    "bg-amber-500 text-white border border-transparent",
    "hover:bg-amber-600 active:bg-amber-700",
    "shadow-sm",
  ].join(" "),

  link: [
    "bg-transparent text-blue-600 border border-transparent underline-offset-4",
    "hover:underline hover:text-blue-700",
    "dark:text-blue-400 dark:hover:text-blue-300",
    "p-0 h-auto min-w-0 rounded-none",
  ].join(" "),

  white: [
    "bg-white text-gray-900 border border-white",
    "hover:bg-gray-100 active:bg-gray-200",
    "shadow-sm",
  ].join(" "),

  dark: [
    "bg-gray-900 text-white border border-gray-900",
    "hover:bg-gray-800 active:bg-gray-700",
    "shadow-sm",
    "dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200",
  ].join(" "),
};

// ─────────────────────────────────────────────────────────────────────────────
// Size → Tailwind class map
// ─────────────────────────────────────────────────────────────────────────────
const SIZES = {
  xs:   "h-6  px-2.5 text-xs  rounded-md  gap-1",
  sm:   "h-8  px-3   text-sm  rounded-lg  gap-1.5",
  md:   "h-9  px-4   text-sm  rounded-lg  gap-2",
  lg:   "h-10 px-5   text-base rounded-lg gap-2",
  xl:   "h-12 px-6   text-lg  rounded-xl  gap-2.5",
  "2xl":"h-14 px-8   text-xl  rounded-xl  gap-3",
  // Square icon-only sizes
  "icon-xs":  "h-6  w-6  rounded-md  p-0",
  "icon-sm":  "h-8  w-8  rounded-lg  p-0",
  "icon-md":  "h-9  w-9  rounded-lg  p-0",
  "icon-lg":  "h-10 w-10 rounded-lg  p-0",
  "icon-xl":  "h-12 w-12 rounded-xl  p-0",
};

// ─────────────────────────────────────────────────────────────────────────────
// Inline spinner (no external dep)
// ─────────────────────────────────────────────────────────────────────────────
function ButtonSpinner({ size }) {
  const dim = { xs:"10", sm:"12", md:"14", lg:"16", xl:"18", "2xl":"20" }[size] ?? "14";
  return (
    <svg
      width={dim} height={dim}
      viewBox="0 0 24 24"
      fill="none"
      className="animate-spin shrink-0"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25" />
      <path fill="currentColor" className="opacity-75"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Button
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Production Button component — the most-used primitive.
 *
 * @param {"primary"|"secondary"|"ghost"|"outline"|"danger"|"danger-outline"|"success"|"warning"|"link"|"white"|"dark"} [variant="primary"]
 * @param {"xs"|"sm"|"md"|"lg"|"xl"|"2xl"|"icon-xs"|"icon-sm"|"icon-md"|"icon-lg"|"icon-xl"} [size="md"]
 * @param {boolean}          [loading=false]   - Shows spinner, disables interaction
 * @param {boolean}          [fullWidth=false]
 * @param {React.ReactNode}  [leftIcon]        - Icon before label
 * @param {React.ReactNode}  [rightIcon]       - Icon after label
 * @param {string}           [loadingText]     - Text shown while loading (default: label unchanged)
 * @param {"button"|"submit"|"reset"} [type="button"]
 * @param {string}           [as]              - Render as a different element ("a", "div", etc.)
 * @param {string}           [href]            - If set, renders as <a>
 *
 * @example
 * <Button variant="primary" size="lg" leftIcon={<PlusIcon size={16}/>}>
 *   Create project
 * </Button>
 *
 * <Button variant="danger" loading={isDeleting}>Delete</Button>
 *
 * <Button variant="link" href="/pricing">See pricing →</Button>
 */
export const Button = forwardRef(function Button(
  {
    variant     = "primary",
    size        = "md",
    loading     = false,
    fullWidth   = false,
    leftIcon,
    rightIcon,
    loadingText,
    disabled,
    children,
    className,
    type        = "button",
    href,
    as: Tag,
    onClick,
    ...props
  },
  ref
) {
  const isDisabled = disabled || loading;
  const isIconOnly = size.startsWith("icon-");

  const baseClasses = cn(
    // Base reset + layout
    "inline-flex items-center justify-center",
    "font-medium whitespace-nowrap",
    "select-none cursor-pointer",
    // Transition
    "transition-all duration-150 ease-out",
    // Focus ring (accessibility)
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2",
    "dark:focus-visible:ring-offset-zinc-900",
    // Disabled
    "disabled:pointer-events-none disabled:opacity-50",
    // Variant + Size
    VARIANTS[variant] ?? VARIANTS.primary,
    SIZES[size] ?? SIZES.md,
    // Width
    fullWidth && !isIconOnly && "w-full",
    className
  );

  const content = (
    <>
      {loading
        ? <ButtonSpinner size={size.replace("icon-", "")} />
        : leftIcon && <span className="shrink-0 flex items-center">{leftIcon}</span>
      }
      {!isIconOnly && (
        <span className={cn(loading && "opacity-70")}>
          {loading && loadingText ? loadingText : children}
        </span>
      )}
      {!loading && rightIcon && (
        <span className="shrink-0 flex items-center">{rightIcon}</span>
      )}
    </>
  );

  // Render as <a> if href provided
  if (href && !Tag) {
    return (
      <a ref={ref} href={href} className={baseClasses} aria-disabled={isDisabled} {...props}>
        {content}
      </a>
    );
  }

  const Element = Tag ?? "button";

  return (
    <Element
      ref={ref}
      type={Element === "button" ? type : undefined}
      disabled={Element === "button" ? isDisabled : undefined}
      aria-disabled={isDisabled}
      aria-busy={loading}
      className={baseClasses}
      onClick={isDisabled ? undefined : onClick}
      {...props}
    >
      {content}
    </Element>
  );
});

Button.displayName = "Button";