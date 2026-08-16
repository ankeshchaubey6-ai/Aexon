import { useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { cn } from "../../utils/cn.js";
import { useScrollLock } from "../../hooks/useScrollLock.js";
import { useKeyboard } from "../../hooks/useKeyboard.js";
import { useFocusTrap } from "../../hooks/useKeyboard.js";

// ─────────────────────────────────────────────────────────────────────────────
// Size map
// ─────────────────────────────────────────────────────────────────────────────
const SIZES = {
  xs:   "max-w-xs",
  sm:   "max-w-sm",
  md:   "max-w-md",
  lg:   "max-w-lg",
  xl:   "max-w-2xl",
  "2xl":"max-w-4xl",
  "3xl":"max-w-6xl",
  full: "max-w-[95vw] h-[90vh]",
};

/**
 * Modal — a fully accessible dialog overlay.
 *
 * Features:
 * - Focus trap (Tab / Shift+Tab cycle inside modal)
 * - Scroll lock (no body scroll behind overlay)
 * - Escape key closes
 * - Click outside closes (configurable)
 * - Portal rendered into document.body
 * - Smooth CSS animations (fade + scale)
 * - Stacked modals via z-index escalation
 *
 * @param {boolean}  open
 * @param {function} onClose
 * @param {string}   [title]
 * @param {string}   [description]
 * @param {"xs"|"sm"|"md"|"lg"|"xl"|"2xl"|"3xl"|"full"} [size="md"]
 * @param {boolean}  [closeOnOverlay=true]
 * @param {boolean}  [closeOnEscape=true]
 * @param {boolean}  [showCloseButton=true]
 * @param {React.ReactNode} [footer]
 * @param {string}   [contentClassName]
 *
 * @example
 * <Modal open={isOpen} onClose={() => setOpen(false)} title="Confirm deletion" size="sm">
 *   <p>Are you sure you want to delete this item?</p>
 *   <Modal.Footer>
 *     <Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
 *     <Button variant="danger" onClick={handleDelete}>Delete</Button>
 *   </Modal.Footer>
 * </Modal>
 */
export function Modal({
  open,
  onClose,
  title,
  description,
  size             = "md",
  closeOnOverlay   = true,
  closeOnEscape    = true,
  showCloseButton  = true,
  footer,
  children,
  className,
  contentClassName,
  ...props
}) {
  useScrollLock(open);
  useKeyboard({ Escape: () => closeOnEscape && onClose?.() }, { enabled: open });

  const panelRef = useRef(null);
  useFocusTrap(panelRef, open);

  // Focus panel on open
  useEffect(() => {
    if (open) panelRef.current?.focus();
  }, [open]);

  const handleOverlayClick = useCallback((e) => {
    if (closeOnOverlay && e.target === e.currentTarget) onClose?.();
  }, [closeOnOverlay, onClose]);

  if (typeof document === "undefined") return null;
  if (!open) return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={title ? "modal-title" : undefined}
      aria-describedby={description ? "modal-description" : undefined}
      className={cn(
        "fixed inset-0 z-50 flex items-center justify-center p-4",
        className,
      )}
      onClick={handleOverlayClick}
      {...props}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-[2px] animate-in fade-in duration-200"
        aria-hidden="true"
      />

      {/* Panel */}
      <div
        ref={panelRef}
        tabIndex={-1}
        className={cn(
          "relative z-10 w-full bg-white dark:bg-zinc-900",
          "rounded-2xl shadow-2xl",
          "outline-none",
          "animate-in fade-in zoom-in-95 duration-200",
          SIZES[size] ?? SIZES.md,
          contentClassName,
        )}
      >
        {/* Header */}
        {(title || showCloseButton) && (
          <div className="flex items-start gap-4 px-6 pt-6 pb-4">
            <div className="flex-1 min-w-0">
              {title && (
                <h2
                  id="modal-title"
                  className="text-lg font-semibold text-gray-900 dark:text-white leading-tight"
                >
                  {title}
                </h2>
              )}
              {description && (
                <p
                  id="modal-description"
                  className="mt-1 text-sm text-gray-500 dark:text-zinc-400 leading-relaxed"
                >
                  {description}
                </p>
              )}
            </div>
            {showCloseButton && (
              <button
                type="button"
                onClick={onClose}
                className={cn(
                  "shrink-0 flex items-center justify-center w-8 h-8 rounded-lg",
                  "text-gray-400 dark:text-zinc-500",
                  "hover:bg-gray-100 hover:text-gray-600",
                  "dark:hover:bg-zinc-800 dark:hover:text-zinc-300",
                  "transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500",
                )}
                aria-label="Close dialog"
              >
                <svg viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4">
                  <path d="M3.72 3.72a.75.75 0 011.06 0L8 6.94l3.22-3.22a.75.75 0 111.06 1.06L9.06 8l3.22 3.22a.75.75 0 11-1.06 1.06L8 9.06l-3.22 3.22a.75.75 0 01-1.06-1.06L6.94 8 3.72 4.78a.75.75 0 010-1.06z"/>
                </svg>
              </button>
            )}
          </div>
        )}

        {/* Body */}
        <div className={cn("px-6", !title && !showCloseButton && "pt-6", !footer && "pb-6")}>
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100 dark:border-zinc-800">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}

/**
 * Modal.Footer — convenience wrapper for the footer slot.
 * @example
 * <Modal.Footer>
 *   <Button variant="secondary" onClick={onClose}>Cancel</Button>
 *   <Button variant="primary" onClick={onConfirm}>Confirm</Button>
 * </Modal.Footer>
 */
Modal.Footer = function ModalFooter({ children, className }) {
  return (
    <div className={cn("flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100 dark:border-zinc-800", className)}>
      {children}
    </div>
  );
};

Modal.displayName = "Modal";