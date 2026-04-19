import { createContext, useContext, useState, useCallback, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { cn } from "../../utils/cn.js";

// ─────────────────────────────────────────────────────────────────────────────
// Types & context
// ─────────────────────────────────────────────────────────────────────────────
const ToastContext = createContext(null);

const POSITIONS = {
  "top-left":      "top-4 left-4",
  "top-center":    "top-4 left-1/2 -translate-x-1/2",
  "top-right":     "top-4 right-4",
  "bottom-left":   "bottom-4 left-4",
  "bottom-center": "bottom-4 left-1/2 -translate-x-1/2",
  "bottom-right":  "bottom-4 right-4",
};

const VARIANTS = {
  default: {
    wrapper: "bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 text-gray-900 dark:text-zinc-100",
    icon:    null,
  },
  info: {
    wrapper: "bg-sky-50 dark:bg-sky-950 border border-sky-200 dark:border-sky-800 text-sky-900 dark:text-sky-100",
    icon:    <path d="M12 2a10 10 0 110 20A10 10 0 0112 2zm0 4a1 1 0 100 2 1 1 0 000-2zm-1 4v6h2v-6h-2z"/>,
    iconColor: "text-sky-500",
  },
  success: {
    wrapper: "bg-emerald-50 dark:bg-emerald-950 border border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-100",
    icon:    <path d="M12 2a10 10 0 110 20A10 10 0 0112 2zm-1.5 13.5l-3-3 1.4-1.4 1.6 1.6 4.6-4.6 1.4 1.4-6 6z"/>,
    iconColor: "text-emerald-500",
  },
  warning: {
    wrapper: "bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-100",
    icon:    <path d="M12 2L1 21h22L12 2zm0 3.5L21 19H3L12 5.5zM11 10v4h2v-4h-2zm0 6v2h2v-2h-2z"/>,
    iconColor: "text-amber-500",
  },
  danger: {
    wrapper: "bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 text-red-900 dark:text-red-100",
    icon:    <path d="M12 2a10 10 0 110 20A10 10 0 0112 2zm-1 5v6h2V7h-2zm0 8v2h2v-2h-2z"/>,
    iconColor: "text-red-500",
  },
  loading: {
    wrapper: "bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 text-gray-900 dark:text-zinc-100",
    icon:    null,
    iconColor: "text-blue-500",
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Individual Toast item
// ─────────────────────────────────────────────────────────────────────────────
function ToastItem({ toast, onDismiss, position }) {
  const v = VARIANTS[toast.type] ?? VARIANTS.default;
  const isBottom = position.startsWith("bottom");

  return (
    <div
      role="alert"
      aria-live="polite"
      className={cn(
        "flex items-start gap-3 w-full max-w-sm p-4 rounded-xl shadow-lg pointer-events-auto",
        "animate-in fade-in duration-300",
        isBottom ? "slide-in-from-bottom-2" : "slide-in-from-top-2",
        v.wrapper,
      )}
    >
      {/* Icon */}
      {toast.type === "loading" ? (
        <svg className="w-5 h-5 shrink-0 animate-spin text-blue-500 mt-0.5" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25"/>
          <path fill="currentColor" className="opacity-75" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
        </svg>
      ) : v.icon ? (
        <svg viewBox="0 0 24 24" fill="currentColor" className={cn("w-5 h-5 shrink-0 mt-0.5", v.iconColor)}>
          {v.icon}
        </svg>
      ) : null}

      {/* Content */}
      <div className="flex-1 min-w-0">
        {toast.title && (
          <p className="text-sm font-semibold leading-tight">{toast.title}</p>
        )}
        {toast.description && (
          <p className={cn("text-sm leading-relaxed opacity-90", toast.title && "mt-0.5")}>
            {toast.description}
          </p>
        )}
        {toast.action && (
          <button
            type="button"
            onClick={() => { toast.action.onClick?.(); onDismiss(toast.id); }}
            className="mt-2 text-xs font-semibold underline underline-offset-2 hover:opacity-70 focus:outline-none"
          >
            {toast.action.label}
          </button>
        )}
      </div>

      {/* Dismiss */}
      {toast.dismissible !== false && (
        <button
          type="button"
          onClick={() => onDismiss(toast.id)}
          className="shrink-0 flex items-center justify-center w-5 h-5 opacity-50 hover:opacity-100 transition-opacity focus:outline-none focus:ring-2 focus:ring-blue-500 rounded"
          aria-label="Dismiss"
        >
          <svg viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5">
            <path d="M3.72 3.72a.75.75 0 011.06 0L8 6.94l3.22-3.22a.75.75 0 111.06 1.06L9.06 8l3.22 3.22a.75.75 0 11-1.06 1.06L8 9.06l-3.22 3.22a.75.75 0 01-1.06-1.06L6.94 8 3.72 4.78a.75.75 0 010-1.06z"/>
          </svg>
        </button>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Provider
// ─────────────────────────────────────────────────────────────────────────────

/**
 * ToastProvider — wrap your app root with this.
 * Then call useToast() anywhere inside to show toasts.
 *
 * @param {"top-left"|"top-center"|"top-right"|"bottom-left"|"bottom-center"|"bottom-right"} [position="bottom-right"]
 * @param {number} [defaultDuration=5000] - Auto-dismiss time in ms (0 = no auto-dismiss)
 * @param {number} [maxToasts=5]
 *
 * @example
 * // _app.jsx / layout.jsx
 * <ToastProvider position="bottom-right">
 *   {children}
 * </ToastProvider>
 *
 * // Any component
 * const { toast } = useToast();
 * toast.success({ title: "Saved!", description: "Your changes have been saved." });
 */
export function ToastProvider({
  children,
  position        = "bottom-right",
  defaultDuration = 5000,
  maxToasts       = 5,
}) {
  const [toasts, setToasts] = useState([]);
  const timers = useRef({});

  const dismiss = useCallback((id) => {
    clearTimeout(timers.current[id]);
    delete timers.current[id];
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const add = useCallback(({ type = "default", title, description, duration, action, dismissible = true } = {}) => {
    const id  = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const dur = duration ?? defaultDuration;

    setToasts((prev) => {
      const next = [...prev, { id, type, title, description, action, dismissible }];
      return next.length > maxToasts ? next.slice(-maxToasts) : next;
    });

    if (dur > 0) {
      timers.current[id] = setTimeout(() => dismiss(id), dur);
    }

    return id;
  }, [defaultDuration, maxToasts, dismiss]);

  // Cleanup on unmount
  useEffect(() => () => Object.values(timers.current).forEach(clearTimeout), []);

  const toast = {
    show:    (opts)             => add(opts),
    success: (opts)             => add({ ...opts, type: "success" }),
    error:   (opts)             => add({ ...opts, type: "danger" }),
    warning: (opts)             => add({ ...opts, type: "warning" }),
    info:    (opts)             => add({ ...opts, type: "info" }),
    loading: (opts)             => add({ ...opts, type: "loading", duration: 0, dismissible: false }),
    dismiss,
    dismissAll: () => setToasts([]),
    /** Update an existing toast (e.g. loading → success) */
    update: (id, opts) => {
      clearTimeout(timers.current[id]);
      setToasts((prev) => prev.map((t) => t.id === id ? { ...t, ...opts } : t));
      const dur = opts.duration ?? defaultDuration;
      if (dur > 0) timers.current[id] = setTimeout(() => dismiss(id), dur);
    },
  };

  const posClass = POSITIONS[position] ?? POSITIONS["bottom-right"];
  const isBottom = position.startsWith("bottom");

  return (
    <ToastContext.Provider value={toast}>
      {children}
      {typeof document !== "undefined" && createPortal(
        <div
          aria-live="polite"
          aria-atomic="false"
          className={cn(
            "fixed z-[70] flex flex-col gap-2 pointer-events-none w-full max-w-sm",
            posClass,
            isBottom ? "flex-col-reverse" : "flex-col",
          )}
        >
          {toasts.map((t) => (
            <ToastItem key={t.id} toast={t} onDismiss={dismiss} position={position} />
          ))}
        </div>,
        document.body,
      )}
    </ToastContext.Provider>
  );
}

/**
 * useToast — returns the toast controller.
 * Must be called inside <ToastProvider>.
 *
 * @returns {{
 *   show, success, error, warning, info, loading, dismiss, dismissAll, update
 * }}
 */
export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider>");
  return ctx;
}
