import { cn } from "../../utils/cn.js";

/**
 * Timeline — a vertical (or horizontal) sequence of events.
 *
 * @param {{ id?, time?, title, description?, icon?, color?, badge?, meta? }[]} items
 * @param {"left"|"right"|"alternate"|"horizontal"} [layout="left"]
 * @param {"default"|"compact"|"activity"} [variant="default"]
 *
 * @example
 * <Timeline items={[
 *   { time: "Jan 2024", title: "Project started", description: "Kicked off with the design team.", color: "blue" },
 *   { time: "Mar 2024", title: "Beta launch",     description: "1 000 users onboarded.", color: "green", badge: "Milestone" },
 *   { time: "Jun 2024", title: "Public launch",   color: "violet" },
 * ]} />
 */

const DOT_COLORS = {
  blue:   "bg-blue-600   ring-blue-100   dark:ring-blue-950",
  green:  "bg-emerald-500 ring-emerald-100 dark:ring-emerald-950",
  violet: "bg-violet-600  ring-violet-100  dark:ring-violet-950",
  amber:  "bg-amber-500   ring-amber-100   dark:ring-amber-950",
  red:    "bg-red-500     ring-red-100     dark:ring-red-950",
  gray:   "bg-gray-400    ring-gray-100    dark:ring-zinc-800",
};

function TimelineDot({ icon, color = "blue", size = "md" }) {
  const dotSize = size === "sm" ? "w-3 h-3" : "w-4 h-4";
  const wrapSize = size === "sm" ? "w-6 h-6" : "w-9 h-9";
  const dotColor = DOT_COLORS[color] ?? DOT_COLORS.blue;

  if (icon) {
    return (
      <span className={cn(
        "relative z-10 flex shrink-0 items-center justify-center rounded-full ring-4 ring-white dark:ring-zinc-950",
        wrapSize,
        dotColor,
        "text-white",
      )}>
        <span className={cn("w-4 h-4 flex items-center justify-center")}>{icon}</span>
      </span>
    );
  }

  return (
    <span className={cn(
      "relative z-10 flex shrink-0 items-center justify-center rounded-full ring-4 ring-white dark:ring-zinc-950",
      dotSize,
      dotColor,
    )} />
  );
}

export function Timeline({
  items    = [],
  layout   = "left",
  variant  = "default",
  className,
}) {
  const isCompact = variant === "compact";

  if (layout === "horizontal") {
    return (
      <div className={cn("w-full overflow-x-auto", className)}>
        <div className="flex items-start min-w-max gap-0">
          {items.map((item, i) => {
            const isLast = i === items.length - 1;
            return (
              <div key={item.id ?? i} className="flex flex-col items-center">
                <div className="flex items-center">
                  <TimelineDot icon={item.icon} color={item.color} size="sm" />
                  {!isLast && (
                    <div className="w-16 h-0.5 bg-gray-200 dark:bg-zinc-700 mx-1" />
                  )}
                </div>
                <div className="mt-3 text-center max-w-[100px]">
                  {item.time && (
                    <p className="text-xs text-gray-400 dark:text-zinc-500">{item.time}</p>
                  )}
                  <p className="text-xs font-semibold text-gray-900 dark:text-zinc-100 mt-0.5 leading-snug">{item.title}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className={cn("flow-root", className)}>
      <ul className="-mb-8">
        {items.map((item, i) => {
          const isLast = i === items.length - 1;
          return (
            <li key={item.id ?? i}>
              <div className="relative pb-8">
                {/* Connector line */}
                {!isLast && (
                  <span
                    className="absolute left-4 top-4 -ml-px h-full w-0.5 bg-gray-200 dark:bg-zinc-700"
                    aria-hidden="true"
                  />
                )}
                <div className={cn(
                  "relative flex",
                  isCompact ? "gap-3" : "gap-4",
                )}>
                  <TimelineDot icon={item.icon} color={item.color} size={isCompact ? "sm" : "md"} />

                  <div className={cn("flex-1 min-w-0", !isLast && "pb-2")}>
                    <div className="flex items-start justify-between gap-2 flex-wrap">
                      <div>
                        <p className={cn(
                          "font-semibold text-gray-900 dark:text-zinc-100",
                          isCompact ? "text-sm" : "text-base",
                        )}>
                          {item.title}
                        </p>
                        {item.time && (
                          <p className="text-xs text-gray-400 dark:text-zinc-500 mt-0.5">{item.time}</p>
                        )}
                      </div>
                      {item.badge && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                          {item.badge}
                        </span>
                      )}
                    </div>

                    {item.description && (
                      <p className={cn(
                        "text-gray-600 dark:text-zinc-400 leading-relaxed mt-1",
                        isCompact ? "text-xs" : "text-sm",
                      )}>
                        {item.description}
                      </p>
                    )}
                    {item.meta && (
                      <div className="mt-2">{item.meta}</div>
                    )}
                  </div>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}