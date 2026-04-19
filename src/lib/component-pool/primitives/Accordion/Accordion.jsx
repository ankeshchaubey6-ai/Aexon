import { createContext, useContext, useId, useRef } from "react";
import { cn } from "../../utils/cn.js";
import { useToggleGroup } from "../../hooks/useToggle.js";

const AccordionContext = createContext(null);

/**
 * Accordion — collapsible content panels.
 *
 * @param {"single"|"multi"} [type="single"]  - One or many panels open at a time
 * @param {string|string[]}  [defaultOpen]    - Initially open panel value(s)
 * @param {string|string[]}  [value]          - Controlled open value(s)
 * @param {function}         [onChange]
 * @param {"default"|"bordered"|"separated"|"flush"} [variant="default"]
 *
 * @example
 * <Accordion type="single" defaultOpen="item-1">
 *   <AccordionItem value="item-1">
 *     <AccordionTrigger>What is your refund policy?</AccordionTrigger>
 *     <AccordionContent>We offer a 30-day money-back guarantee.</AccordionContent>
 *   </AccordionItem>
 *   <AccordionItem value="item-2">
 *     <AccordionTrigger>How do I cancel?</AccordionTrigger>
 *     <AccordionContent>You can cancel anytime from your dashboard.</AccordionContent>
 *   </AccordionItem>
 * </Accordion>
 */
export function Accordion({
  type        = "single",
  defaultOpen,
  value,
  onChange,
  variant     = "default",
  children,
  className,
  ...props
}) {
  const group = useToggleGroup({
    mode: type,
    initialOpen: defaultOpen ?? [],
  });

  const isOpen   = value !== undefined
    ? (id) => Array.isArray(value) ? value.includes(id) : value === id
    : group.isOpen;

  const onSelect = value !== undefined
    ? (id) => onChange?.(type === "single" ? id : (
        (Array.isArray(value) ? value : [value]).includes(id)
          ? (Array.isArray(value) ? value : [value]).filter(v => v !== id)
          : [...(Array.isArray(value) ? value : [value]), id]
      ))
    : (id) => { group.toggle(id); onChange?.(group.openIds); };

  return (
    <AccordionContext.Provider value={{ isOpen, onSelect, variant }}>
      <div
        className={cn(
          variant === "separated" && "flex flex-col gap-2",
          variant === "bordered"  && "border border-gray-200 dark:border-zinc-700 rounded-xl overflow-hidden divide-y divide-gray-200 dark:divide-zinc-700",
          variant === "default"   && "divide-y divide-gray-200 dark:divide-zinc-700",
          className,
        )}
        {...props}
      >
        {children}
      </div>
    </AccordionContext.Provider>
  );
}

/**
 * AccordionItem — a single collapsible section.
 * @param {string}  value
 * @param {boolean} [disabled]
 */
export function AccordionItem({ value, disabled, children, className, ...props }) {
  const { variant } = useContext(AccordionContext);
  return (
    <div
      data-disabled={disabled || undefined}
      className={cn(
        variant === "separated" && "border border-gray-200 dark:border-zinc-700 rounded-xl overflow-hidden",
        disabled && "opacity-50",
        className,
      )}
      {...props}
    >
      {/* Pass value + disabled down via clone pattern */}
      {typeof children === "function"
        ? children({ value, disabled })
        : children
      }
    </div>
  );
}

/**
 * AccordionTrigger — the clickable header row.
 */
export function AccordionTrigger({ value, children, icon, className, ...props }) {
  const { isOpen, onSelect, variant } = useContext(AccordionContext);
  const open = isOpen(value);

  return (
    <button
      type="button"
      aria-expanded={open}
      onClick={() => onSelect(value)}
      className={cn(
        "flex w-full items-center justify-between gap-4",
        "text-left font-medium text-gray-900 dark:text-zinc-100",
        "transition-colors duration-150",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-inset",
        variant === "flush" ? "py-4" : "px-4 py-4",
        "hover:bg-gray-50 dark:hover:bg-zinc-800/50",
        className,
      )}
      {...props}
    >
      <span className="flex items-center gap-3">
        {icon && <span className="shrink-0 text-gray-400">{icon}</span>}
        <span>{children}</span>
      </span>
      <svg
        viewBox="0 0 16 16"
        fill="currentColor"
        className={cn(
          "w-4 h-4 shrink-0 text-gray-400 dark:text-zinc-500 transition-transform duration-200",
          open && "rotate-180",
        )}
      >
        <path fillRule="evenodd" d="M4.22 6.22a.75.75 0 011.06 0L8 8.94l2.72-2.72a.75.75 0 111.06 1.06l-3.25 3.25a.75.75 0 01-1.06 0L4.22 7.28a.75.75 0 010-1.06z"/>
      </svg>
    </button>
  );
}

/**
 * AccordionContent — the collapsible body.
 * Uses CSS max-height transition for smooth open/close.
 */
export function AccordionContent({ value, children, className, ...props }) {
  const { isOpen, variant } = useContext(AccordionContext);
  const open    = isOpen(value);
  const ref     = useRef(null);

  return (
    <div
      role="region"
      hidden={!open}
      className={cn(
        open && "animate-in fade-in duration-200",
        className,
      )}
      {...props}
    >
      <div
        ref={ref}
        className={cn(
          "text-sm text-gray-600 dark:text-zinc-400 leading-relaxed",
          variant === "flush" ? "pb-4" : "px-4 pb-4",
        )}
      >
        {children}
      </div>
    </div>
  );
}

/**
 * SimpleAccordion — a convenience wrapper that wires value passing automatically.
 * Pass items as an array instead of composing Accordion* manually.
 *
 * @param {{ value: string, trigger: ReactNode, content: ReactNode, icon?: ReactNode }[]} items
 * @example
 * <SimpleAccordion items={faqItems} type="single" variant="separated" />
 */
export function SimpleAccordion({ items = [], type = "single", variant = "default", ...props }) {
  return (
    <Accordion type={type} variant={variant} {...props}>
      {items.map((item) => (
        <AccordionItem key={item.value} value={item.value} disabled={item.disabled}>
          <AccordionTrigger value={item.value} icon={item.icon}>
            {item.trigger}
          </AccordionTrigger>
          <AccordionContent value={item.value}>
            {item.content}
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );
}