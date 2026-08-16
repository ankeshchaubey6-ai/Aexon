import { useState, useRef, useCallback, useId } from "react";
import { cn } from "../../utils/cn.js";
import { useClickOutside } from "../../hooks/useClickOutside.js";
import { useKeyboard } from "../../hooks/useKeyboard.js";

// ─────────────────────────────────────────────────────────────────────────────
// Placement → Tailwind position classes
// ─────────────────────────────────────────────────────────────────────────────
const PLACEMENT_CLASSES = {
  "top":          "bottom-full left-1/2 -translate-x-1/2 mb-2",
  "top-start":    "bottom-full left-0 mb-2",
  "top-end":      "bottom-full right-0 mb-2",
  "bottom":       "top-full left-1/2 -translate-x-1/2 mt-2",
  "bottom-start": "top-full left-0 mt-2",
  "bottom-end":   "top-full right-0 mt-2",
  "left":         "right-full top-1/2 -translate-y-1/2 mr-2",
  "left-start":   "right-full top-0 mr-2",
  "left-end":     "right-full bottom-0 mr-2",
  "right":        "left-full top-1/2 -translate-y-1/2 ml-2",
  "right-start":  "left-full top-0 ml-2",
  "right-end":    "left-full bottom-0 ml-2",
};

/**
 * Popover — a floating content panel attached to a trigger element.
 * Pure CSS positioning (no Floating UI dependency).
 *
 * @param {React.ReactNode}  trigger    - The element that opens the popover
 * @param {React.ReactNode}  children   - Popover content
 * @param {"top"|"top-start"|"top-end"|"bottom"|"bottom-start"|"bottom-end"|"left"|"left-start"|"left-end"|"right"|"right-start"|"right-end"} [placement="bottom-start"]
 * @param {"click"|"hover"}  [trigger="click"]
 * @param {boolean}          [open]     - Controlled open state
 * @param {function}         [onOpenChange]
 * @param {boolean}          [arrow=false]
 * @param {string}           [contentClassName]
 * @param {number}           [hoverDelay=0]
 *
 * @example
 * <Popover
 *   trigger={<Button variant="secondary">Options</Button>}
 *   placement="bottom-start"
 * >
 *   <div className="p-2 flex flex-col gap-1">
 *     <button>Edit</button>
 *     <button>Delete</button>
 *   </div>
 * </Popover>
 */
export function Popover({
  trigger,
  children,
  placement       = "bottom-start",
  triggerType     = "click",
  open: controlledOpen,
  onOpenChange,
  arrow           = false,
  contentClassName,
  className,
  hoverDelay      = 150,
}) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = controlledOpen !== undefined;
  const open         = isControlled ? controlledOpen : internalOpen;
  const id           = useId();

  const containerRef = useRef(null);
  const hoverTimer   = useRef(null);

  const setOpen = useCallback((val) => {
    if (!isControlled) setInternalOpen(val);
    onOpenChange?.(val);
  }, [isControlled, onOpenChange]);

  useClickOutside(containerRef, () => setOpen(false), { enabled: open });
  useKeyboard({ Escape: () => setOpen(false) }, { enabled: open });

  const handleClick = () => {
    if (triggerType === "click") setOpen(!open);
  };

  const handleMouseEnter = () => {
    if (triggerType !== "hover") return;
    clearTimeout(hoverTimer.current);
    hoverTimer.current = setTimeout(() => setOpen(true), hoverDelay);
  };

  const handleMouseLeave = () => {
    if (triggerType !== "hover") return;
    clearTimeout(hoverTimer.current);
    hoverTimer.current = setTimeout(() => setOpen(false), hoverDelay);
  };

  const placementClass = PLACEMENT_CLASSES[placement] ?? PLACEMENT_CLASSES["bottom-start"];

  return (
    <div
      ref={containerRef}
      className={cn("relative inline-block", className)}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Trigger */}
      <div
        onClick={handleClick}
        aria-expanded={open}
        aria-controls={id}
        aria-haspopup="true"
        className="inline-flex"
      >
        {trigger}
      </div>

      {/* Content */}
      {open && (
        <div
          id={id}
          role="dialog"
          className={cn(
            "absolute z-40 min-w-[180px]",
            "bg-white dark:bg-zinc-900",
            "border border-gray-200 dark:border-zinc-700",
            "rounded-xl shadow-lg",
            "animate-in fade-in zoom-in-95 duration-150",
            placementClass,
            contentClassName,
          )}
        >
          {children}
        </div>
      )}
    </div>
  );
}

/**
 * PopoverItem — a styled row inside a Popover panel.
 * Saves writing repetitive li/button markup.
 *
 * @example
 * <Popover trigger={<Button>Actions</Button>}>
 *   <Popover.Content>
 *     <PopoverItem icon={<EditIcon size={14}/>} onClick={edit}>Edit</PopoverItem>
 *     <PopoverItem icon={<TrashIcon size={14}/>} onClick={del} danger>Delete</PopoverItem>
 *   </Popover.Content>
 * </Popover>
 */
export function PopoverItem({ icon, children, danger, onClick, disabled, className }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "w-full flex items-center gap-2.5 px-3 py-2 text-sm rounded-lg",
        "transition-colors text-left",
        "focus:outline-none focus:ring-2 focus:ring-blue-500",
        danger
          ? "text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950"
          : "text-gray-700 dark:text-zinc-200 hover:bg-gray-100 dark:hover:bg-zinc-800",
        disabled && "opacity-40 cursor-not-allowed",
        className,
      )}
    >
      {icon && <span className="shrink-0 w-4 h-4 flex items-center justify-center">{icon}</span>}
      {children}
    </button>
  );
}

Popover.Content = function PopoverContent({ children, className }) {
  return <div className={cn("p-1.5 flex flex-col gap-0.5", className)}>{children}</div>;
};

Popover.Divider = function PopoverDivider() {
  return <hr className="my-1 border-gray-100 dark:border-zinc-800" />;
};