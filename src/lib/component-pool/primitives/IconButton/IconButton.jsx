import { forwardRef } from "react";
import { cn } from "../../utils/cn.js";
import { Button } from "../Button/Button.jsx";

/**
 * IconButton — a square button containing only an icon.
 * Automatically adds aria-label for accessibility.
 * Renders a native title tooltip on hover.
 *
 * @param {React.ReactNode} icon       - The icon element
 * @param {string}          label      - Accessible label (required for a11y)
 * @param {"xs"|"sm"|"md"|"lg"|"xl"}   [size="md"]
 * @param {"primary"|"secondary"|"ghost"|"danger"|"outline"} [variant="ghost"]
 * @param {boolean}         [rounded=false] - Full circle instead of rounded-lg
 *
 * @example
 * <IconButton icon={<SearchIcon size={16}/>} label="Search" />
 * <IconButton icon={<TrashIcon size={16}/>} label="Delete" variant="danger" />
 * <IconButton icon={<MoreHorizontalIcon size={16}/>} label="More options" rounded />
 */
export const IconButton = forwardRef(function IconButton(
  {
    icon,
    label,
    size    = "md",
    variant = "ghost",
    rounded = false,
    className,
    children,
    ...props
  },
  ref
) {
  return (
    <Button
      ref={ref}
      variant={variant}
      size={`icon-${size}`}
      aria-label={label}
      title={label}
      className={cn(rounded && "rounded-full", className)}
      {...props}
    >
      {icon ?? children}
    </Button>
  );
});

IconButton.displayName = "IconButton";