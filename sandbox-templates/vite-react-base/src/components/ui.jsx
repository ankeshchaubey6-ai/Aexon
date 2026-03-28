import { cn } from "../lib/utils";
import { X } from "lucide-react";
import { useEffect } from "react";

// =====================
// BUTTON
// =====================
export function Button({
  children,
  variant = "primary",
  size = "md",
  className,
  loading = false,
  disabled,
  ...props
}) {
  const base = "btn";
  const variants = {
    primary:   "btn-primary",
    secondary: "btn-secondary",
    outline:   "btn-outline",
    ghost:     "btn-ghost",
    danger:    "btn-danger",
  };
  const sizes = {
    sm: "btn-sm",
    md: "",
    lg: "btn-lg",
  };

  return (
    <button
      className={cn(base, variants[variant], sizes[size], className)}
      disabled={disabled || loading}
      {...props}
    >
      {loading && (
        <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
      )}
      {children}
    </button>
  );
}

// =====================
// INPUT
// =====================
export function Input({ label, error, className, ...props }) {
  return (
    <div className="w-full">
      {label && <label className="label">{label}</label>}
      <input
        className={cn("input", error && "input-error", className)}
        {...props}
      />
      {error && (
        <p className="mt-1 text-xs text-red-500">{error}</p>
      )}
    </div>
  );
}

// =====================
// TEXTAREA
// =====================
export function Textarea({ label, error, className, ...props }) {
  return (
    <div className="w-full">
      {label && <label className="label">{label}</label>}
      <textarea
        className={cn(
          "input resize-none",
          error && "input-error",
          className
        )}
        rows={4}
        {...props}
      />
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
  );
}

// =====================
// SELECT
// =====================
export function Select({ label, error, options = [], className, ...props }) {
  return (
    <div className="w-full">
      {label && <label className="label">{label}</label>}
      <select className={cn("input", error && "input-error", className)} {...props}>
        {options.map((opt) => (
          <option key={opt.value ?? opt} value={opt.value ?? opt}>
            {opt.label ?? opt}
          </option>
        ))}
      </select>
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
  );
}

// =====================
// CARD
// =====================
export function Card({ children, hover = false, className, ...props }) {
  return (
    <div
      className={cn(hover ? "card-hover" : "card", className)}
      {...props}
    >
      {children}
    </div>
  );
}

// =====================
// BADGE
// =====================
export function Badge({ children, variant = "gray", className }) {
  const variants = {
    primary: "badge-primary",
    success: "badge-success",
    warning: "badge-warning",
    danger:  "badge-danger",
    gray:    "badge-gray",
  };
  return (
    <span className={cn("badge", variants[variant], className)}>
      {children}
    </span>
  );
}

// =====================
// SPINNER
// =====================
export function Spinner({ size = "md", className }) {
  const sizes = { sm: "w-4 h-4", md: "w-6 h-6", lg: "w-10 h-10" };
  return (
    <span
      className={cn(
        "inline-block border-2 border-primary-500 border-t-transparent rounded-full animate-spin",
        sizes[size],
        className
      )}
    />
  );
}

// =====================
// MODAL
// =====================
export function Modal({ isOpen, onClose, title, children, size = "md" }) {
  useEffect(() => {
    if (isOpen) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
    return () => { document.body.style.overflow = ""; };
  }, [isOpen]);

  if (!isOpen) return null;

  const sizes = {
    sm: "max-w-sm",
    md: "max-w-lg",
    lg: "max-w-2xl",
    xl: "max-w-4xl",
    full: "max-w-full mx-4",
  };

  return (
    <div className="overlay flex items-center justify-center p-4" onClick={onClose}>
      <div
        className={cn(
          "w-full bg-white rounded-2xl shadow-xl animate-scale-in",
          sizes[size]
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {(title || onClose) && (
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
            {title && <h3 className="text-lg font-semibold text-slate-900">{title}</h3>}
            {onClose && (
              <button
                onClick={onClose}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
              >
                <X size={18} />
              </button>
            )}
          </div>
        )}
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}

// =====================
// SKELETON
// =====================
export function Skeleton({ className, ...props }) {
  return <div className={cn("skeleton", className)} {...props} />;
}

// =====================
// AVATAR
// =====================
export function Avatar({ src, alt, name, size = "md", className }) {
  const sizes = {
    sm: "w-7 h-7 text-xs",
    md: "w-9 h-9 text-sm",
    lg: "w-12 h-12 text-base",
    xl: "w-16 h-16 text-xl",
  };

  const initials = name
    ? name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()
    : "?";

  if (src) {
    return (
      <img
        src={src}
        alt={alt || name}
        className={cn("rounded-full object-cover", sizes[size], className)}
      />
    );
  }

  return (
    <div
      className={cn(
        "rounded-full bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center text-white font-semibold shrink-0",
        sizes[size],
        className
      )}
    >
      {initials}
    </div>
  );
}

// =====================
// DIVIDER
// =====================
export function Divider({ label, className }) {
  if (!label) return <hr className={cn("divider", className)} />;
  return (
    <div className={cn("flex items-center gap-3 my-6", className)}>
      <div className="flex-1 border-t border-slate-200" />
      <span className="text-xs text-slate-400 font-medium">{label}</span>
      <div className="flex-1 border-t border-slate-200" />
    </div>
  );
}

// =====================
// ALERT
// =====================
export function Alert({ children, variant = "info", className }) {
  const styles = {
    info:    "bg-blue-50 border-blue-200 text-blue-800",
    success: "bg-emerald-50 border-emerald-200 text-emerald-800",
    warning: "bg-amber-50 border-amber-200 text-amber-800",
    error:   "bg-red-50 border-red-200 text-red-800",
  };
  return (
    <div className={cn("border rounded-lg p-4 text-sm", styles[variant], className)}>
      {children}
    </div>
  );
}

// =====================
// TABLE
// =====================
export function Table({ columns = [], data = [], className }) {
  return (
    <div className={cn("overflow-x-auto rounded-xl border border-slate-200", className)}>
      <table className="w-full text-sm">
        <thead className="bg-slate-50 border-b border-slate-200">
          <tr>
            {columns.map((col) => (
              <th
                key={col.key}
                className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider"
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 bg-white">
          {data.map((row, i) => (
            <tr key={i} className="hover:bg-slate-50 transition-colors">
              {columns.map((col) => (
                <td key={col.key} className="px-4 py-3 text-slate-700">
                  {col.render ? col.render(row[col.key], row) : row[col.key]}
                </td>
              ))}
            </tr>
          ))}
          {data.length === 0 && (
            <tr>
              <td
                colSpan={columns.length}
                className="px-4 py-8 text-center text-slate-400"
              >
                No data available
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

// =====================
// PROGRESS BAR
// =====================
export function Progress({ value = 0, max = 100, className, color = "primary" }) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100));
  const colors = {
    primary: "bg-primary-500",
    success: "bg-emerald-500",
    warning: "bg-amber-500",
    danger:  "bg-red-500",
  };
  return (
    <div className={cn("w-full bg-slate-200 rounded-full h-2 overflow-hidden", className)}>
      <div
        className={cn("h-full rounded-full transition-all duration-500", colors[color])}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

// =====================
// TOOLTIP (simple)
// =====================
export function Tooltip({ children, text, className }) {
  return (
    <div className={cn("relative group inline-flex", className)}>
      {children}
      <span className="absolute -top-9 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-xs rounded px-2 py-1 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
        {text}
      </span>
    </div>
  );
}