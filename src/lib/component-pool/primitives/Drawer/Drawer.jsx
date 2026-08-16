import { useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { cn } from "../../utils/cn.js";
import { useScrollLock } from "../../hooks/useScrollLock.js";
import { useKeyboard, useFocusTrap } from "../../hooks/useKeyboard.js";
import { useClickOutside } from "../../hooks/useClickOutside.js";

// ─────────────────────────────────────────────────────────────────────────────
// Side → translate class when closed
// ─────────────────────────────────────────────────────────────────────────────
const SLIDE_FROM = {
  left:   "data-[state=closed]:-translate-x-full",
  right:  "data-[state=closed]:translate-x-full",
  top:    "data-[state=closed]:-translate-y-full",
  bottom: "data-[state=closed]:translate-y-full",
};

const POSITION = {
  left:   "left-0 top-0 bottom-0",
  right:  "right-0 top-0 bottom-0",
  top:    "top-0 left-0 right-0",
  bottom: "bottom-0 left-0 right-0",
};

const SIZE_AXIS = {
  left:   "max-w-xs w-full h-full",
  right:  "max-w-xs w-full h-full",
  top:    "w-full max-h-[60vh]",
  bottom: "w-full max-h-[90vh]",
};

/**
 * Drawer — a slide-in panel from any edge of the screen.
 *
 * @param {boolean}  open
 * @param {function} onClose
 * @param {"left"|"right"|"top"|"bottom"} [side="right"]
 * @param {string}   [title]
 * @param {string}   [description]
 * @param {boolean}  [showCloseButton=true]
 * @param {boolean}  [closeOnOverlay=true]
 * @param {React.ReactNode} [footer]
 * @param {string}   [size]  - Tailwind max-width class to override default
 *
 * @example
 * <Drawer open={open} onClose={close} side="right" title="Cart">
 *   <CartContents />
 *   <Drawer.Footer>
 *     <Button fullWidth>Checkout</Button>
 *   </Drawer.Footer>
 * </Drawer>
 */
export function Drawer({
  open,
  onClose,
  side             = "right",
  title,
  description,
  showCloseButton  = true,
  closeOnOverlay   = true,
  footer,
  children,
  size,
  className,
}) {
  useScrollLock(open);
  useKeyboard({ Escape: onClose }, { enabled: open });

  const panelRef = useRef(null);
  useFocusTrap(panelRef, open);

  useEffect(() => {
    if (open) panelRef.current?.focus();
  }, [open]);

  useClickOutside(panelRef, () => { if (closeOnOverlay && open) onClose?.(); }, { enabled: open });

  if (typeof document === "undefined") return null;
  if (!open) return null;

  const isVertical = side === "left" || side === "right";

  return createPortal(
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-labelledby={title ? "drawer-title" : undefined}>
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-[1px] animate-in fade-in duration-200"
        onClick={() => closeOnOverlay && onClose?.()}
        aria-hidden="true"
      />

      {/* Panel */}
      <div
        ref={panelRef}
        tabIndex={-1}
        className={cn(
          "absolute flex flex-col outline-none",
          "bg-white dark:bg-zinc-900 shadow-2xl",
          POSITION[side],
          size ?? SIZE_AXIS[side],
          "animate-in duration-300",
          side === "left"   && "slide-in-from-left",
          side === "right"  && "slide-in-from-right",
          side === "top"    && "slide-in-from-top",
          side === "bottom" && "slide-in-from-bottom",
          className,
        )}
      >
        {/* Header */}
        {(title || showCloseButton) && (
          <div className={cn(
            "flex items-start gap-3 shrink-0",
            isVertical ? "px-5 py-4 border-b border-gray-100 dark:border-zinc-800"
                       : "px-5 pt-4 pb-3 border-b border-gray-100 dark:border-zinc-800",
          )}>
            <div className="flex-1 min-w-0">
              {title && (
                <h2 id="drawer-title" className="text-base font-semibold text-gray-900 dark:text-white">
                  {title}
                </h2>
              )}
              {description && (
                <p className="mt-0.5 text-sm text-gray-500 dark:text-zinc-400">{description}</p>
              )}
            </div>
            {showCloseButton && (
              <button
                type="button"
                onClick={onClose}
                className="shrink-0 flex items-center justify-center w-8 h-8 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-300 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
                aria-label="Close"
              >
                <svg viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4">
                  <path d="M3.72 3.72a.75.75 0 011.06 0L8 6.94l3.22-3.22a.75.75 0 111.06 1.06L9.06 8l3.22 3.22a.75.75 0 11-1.06 1.06L8 9.06l-3.22 3.22a.75.75 0 01-1.06-1.06L6.94 8 3.72 4.78a.75.75 0 010-1.06z"/>
                </svg>
              </button>
            )}
          </div>
        )}

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div className="shrink-0 px-5 py-4 border-t border-gray-100 dark:border-zinc-800">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}

Drawer.Footer = function DrawerFooter({ children, className }) {
  return <div className={cn("flex items-center gap-3", className)}>{children}</div>;
};

Drawer.displayName = "Drawer";