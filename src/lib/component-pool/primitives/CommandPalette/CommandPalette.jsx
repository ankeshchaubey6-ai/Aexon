import { useState, useCallback, useEffect, useRef, useId } from "react";
import { createPortal } from "react-dom";
import { cn } from "../../utils/cn.js";
import { useScrollLock } from "../../hooks/useScrollLock.js";

/**
 * CommandPalette — a ⌘K-style command menu with fuzzy search,
 * grouped items, keyboard navigation, and portal rendering.
 *
 * @param {boolean}  open
 * @param {function} onClose
 * @param {{ group?: string, label: string, description?: string, icon?: ReactNode, shortcut?: string, onSelect: () => void, keywords?: string[] }[]} items
 * @param {string}   [placeholder]
 * @param {boolean}  [showRecentEmpty=true] - Show items even when query is empty
 *
 * @example
 * <CommandPalette
 *   open={open}
 *   onClose={() => setOpen(false)}
 *   items={[
 *     { group: "Navigation", label: "Go to Dashboard", icon: <HomeIcon/>, shortcut: "G D", onSelect: () => router.push("/") },
 *     { group: "Actions",    label: "New project",     icon: <PlusIcon/>, shortcut: "⌘N", onSelect: createProject },
 *     { group: "Actions",    label: "Invite member",   icon: <UserIcon/>, onSelect: openInvite },
 *   ]}
 * />
 */
export function CommandPalette({
  open,
  onClose,
  items       = [],
  placeholder = "Search commands…",
  showRecentEmpty = true,
}) {
  const [query,       setQuery]   = useState("");
  const [highlighted, setHL]      = useState(0);
  const inputRef    = useRef(null);
  const listRef     = useRef(null);
  const id          = useId();

  useScrollLock(open);

  // Reset on open
  useEffect(() => {
    if (open) { setQuery(""); setHL(0); setTimeout(() => inputRef.current?.focus(), 50); }
  }, [open]);

  // Filter items
  const filtered = query
    ? items.filter((item) => {
        const q = query.toLowerCase();
        return (
          item.label.toLowerCase().includes(q) ||
          item.description?.toLowerCase().includes(q) ||
          item.keywords?.some(k => k.toLowerCase().includes(q)) ||
          item.group?.toLowerCase().includes(q)
        );
      })
    : (showRecentEmpty ? items : []);

  // Group
  const grouped = filtered.reduce((acc, item, i) => {
    const g = item.group ?? "";
    if (!acc[g]) acc[g] = [];
    acc[g].push({ ...item, _flatIndex: i });
    return acc;
  }, {});

  const total = filtered.length;

  // Keyboard navigation
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (e.key === "ArrowDown") { e.preventDefault(); setHL(h => (h + 1) % Math.max(total, 1)); }
      if (e.key === "ArrowUp")   { e.preventDefault(); setHL(h => (h - 1 + Math.max(total, 1)) % Math.max(total, 1)); }
      if (e.key === "Enter") {
        e.preventDefault();
        const item = filtered[highlighted];
        if (item) { item.onSelect(); onClose(); }
      }
      if (e.key === "Escape") { e.preventDefault(); onClose(); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, highlighted, filtered, total, onClose]);

  // Scroll highlighted into view
  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-index="${highlighted}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [highlighted]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[90] flex items-start justify-center pt-[15vh] px-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
      role="dialog" aria-modal="true" aria-label="Command palette"
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-in fade-in duration-150" aria-hidden="true" />

      {/* Panel */}
      <div className="relative z-10 w-full max-w-xl bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-zinc-700 overflow-hidden animate-in fade-in zoom-in-95 duration-150">

        {/* Search bar */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-gray-100 dark:border-zinc-800">
          <svg viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5 text-gray-400 dark:text-zinc-500 shrink-0">
            <path fillRule="evenodd" d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z"/>
          </svg>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setHL(0); }}
            placeholder={placeholder}
            className="flex-1 bg-transparent text-sm text-gray-900 dark:text-zinc-100 placeholder:text-gray-400 dark:placeholder:text-zinc-500 outline-none"
            autoComplete="off"
            spellCheck={false}
          />
          <kbd className="shrink-0 hidden sm:inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium border border-gray-200 dark:border-zinc-700 text-gray-400 dark:text-zinc-500 bg-gray-50 dark:bg-zinc-800">
            Esc
          </kbd>
        </div>

        {/* Results */}
        <div ref={listRef} className="max-h-[60vh] overflow-y-auto overscroll-contain py-2">
          {total === 0 && (
            <div className="flex flex-col items-center justify-center py-12 gap-2 text-gray-400 dark:text-zinc-500">
              <svg viewBox="0 0 24 24" fill="currentColor" className="w-10 h-10 opacity-30">
                <path d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z"/>
              </svg>
              <p className="text-sm">No results for "{query}"</p>
            </div>
          )}

          {Object.entries(grouped).map(([group, groupItems]) => (
            <div key={group}>
              {group && (
                <p className="px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-zinc-500">
                  {group}
                </p>
              )}
              {groupItems.map((item) => {
                const isHL = item._flatIndex === highlighted;
                return (
                  <button
                    key={item._flatIndex}
                    data-index={item._flatIndex}
                    type="button"
                    onClick={() => { item.onSelect(); onClose(); }}
                    onMouseEnter={() => setHL(item._flatIndex)}
                    className={cn(
                      "w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors",
                      isHL
                        ? "bg-blue-50 dark:bg-blue-950 text-blue-900 dark:text-blue-100"
                        : "text-gray-700 dark:text-zinc-200 hover:bg-gray-50 dark:hover:bg-zinc-800",
                    )}
                  >
                    {item.icon && (
                      <span className={cn("shrink-0 w-5 h-5 flex items-center justify-center", isHL ? "text-blue-600 dark:text-blue-400" : "text-gray-400 dark:text-zinc-500")}>
                        {item.icon}
                      </span>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{item.label}</p>
                      {item.description && (
                        <p className="text-xs text-gray-400 dark:text-zinc-500 truncate mt-0.5">{item.description}</p>
                      )}
                    </div>
                    {item.shortcut && (
                      <kbd className="shrink-0 hidden sm:inline-flex gap-1 items-center text-[10px] font-medium text-gray-400 dark:text-zinc-500">
                        {item.shortcut.split(" ").map((k, ki) => (
                          <span key={ki} className="px-1.5 py-0.5 rounded border border-gray-200 dark:border-zinc-600 bg-gray-50 dark:bg-zinc-800">{k}</span>
                        ))}
                      </kbd>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="flex items-center gap-3 px-4 py-2 border-t border-gray-100 dark:border-zinc-800 text-xs text-gray-400 dark:text-zinc-500">
          <span className="flex items-center gap-1">
            <kbd className="px-1 py-0.5 rounded border border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800">↑↓</kbd> navigate
          </span>
          <span className="flex items-center gap-1">
            <kbd className="px-1 py-0.5 rounded border border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800">↵</kbd> select
          </span>
          <span className="flex items-center gap-1">
            <kbd className="px-1 py-0.5 rounded border border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800">Esc</kbd> close
          </span>
        </div>
      </div>
    </div>,
    document.body,
  );
}