import { cn } from "../../utils/cn.js";

/**
 * Stepper — a step-progress indicator for multi-step forms and wizards.
 *
 * @param {{ label: string, description?: string, icon?: ReactNode }[]} steps
 * @param {number}  currentStep    - 0-indexed current step
 * @param {"horizontal"|"vertical"} [orientation="horizontal"]
 * @param {"default"|"circles"|"numbered"|"minimal"} [variant="default"]
 * @param {boolean} [clickable=false]   - Allow clicking past steps to navigate back
 * @param {function} [onStepClick]      - (index) => void
 *
 * @example
 * <Stepper
 *   steps={[
 *     { label: "Account",  description: "Create your account" },
 *     { label: "Profile",  description: "Set up your profile" },
 *     { label: "Billing",  description: "Payment details" },
 *     { label: "Review",   description: "Confirm everything" },
 *   ]}
 *   currentStep={1}
 * />
 */
export function Stepper({
  steps       = [],
  currentStep = 0,
  orientation = "horizontal",
  variant     = "default",
  clickable   = false,
  onStepClick,
  className,
}) {
  const isVertical = orientation === "vertical";

  return (
    <nav aria-label="Progress" className={cn(className)}>
      <ol
        className={cn(
          "flex",
          isVertical ? "flex-col gap-0" : "flex-row items-start",
        )}
      >
        {steps.map((step, i) => {
          const isComplete = i < currentStep;
          const isCurrent  = i === currentStep;
          const isLast     = i === steps.length - 1;

          const canClick = clickable && isComplete && onStepClick;

          return (
            <li
              key={i}
              className={cn(
                "flex",
                isVertical ? "flex-row gap-4 pb-8 last:pb-0" : "flex-col items-center flex-1 last:flex-none",
              )}
            >
              {/* Step indicator + connector */}
              <div className={cn(
                "flex",
                isVertical ? "flex-col items-center" : "flex-row items-center w-full",
              )}>
                {/* Circle */}
                <button
                  type="button"
                  onClick={() => canClick && onStepClick(i)}
                  disabled={!canClick}
                  aria-current={isCurrent ? "step" : undefined}
                  aria-label={`Step ${i + 1}: ${step.label}${isComplete ? " (completed)" : isCurrent ? " (current)" : ""}`}
                  className={cn(
                    "relative flex shrink-0 items-center justify-center rounded-full",
                    "transition-all duration-200",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2",
                    variant === "minimal" ? "w-3 h-3" : "w-9 h-9",
                    isComplete && "bg-blue-600 dark:bg-blue-500",
                    isCurrent && "bg-white dark:bg-zinc-900 border-2 border-blue-600 dark:border-blue-400",
                    !isComplete && !isCurrent && "bg-white dark:bg-zinc-900 border-2 border-gray-300 dark:border-zinc-600",
                    canClick && "cursor-pointer hover:opacity-80",
                    !canClick && "cursor-default",
                  )}
                >
                  {variant !== "minimal" && (
                    isComplete ? (
                      // Checkmark
                      <svg viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4 text-white">
                        <path d="M13.78 4.22a.75.75 0 010 1.06l-7.25 7.25a.75.75 0 01-1.06 0L2.22 9.28a.75.75 0 011.06-1.06L6 10.94l6.72-6.72a.75.75 0 011.06 0z"/>
                      </svg>
                    ) : isCurrent ? (
                      // Filled dot
                      <span className="w-2.5 h-2.5 rounded-full bg-blue-600 dark:bg-blue-400" />
                    ) : (
                      // Number
                      <span className={cn(
                        "text-xs font-semibold",
                        "text-gray-400 dark:text-zinc-500",
                      )}>
                        {i + 1}
                      </span>
                    )
                  )}
                  {variant === "minimal" && (
                    <span className={cn(
                      "w-full h-full rounded-full",
                      isComplete && "bg-blue-600",
                      isCurrent  && "bg-blue-600 scale-125",
                      !isComplete && !isCurrent && "bg-gray-300 dark:bg-zinc-600",
                    )} />
                  )}
                </button>

                {/* Connector line */}
                {!isLast && (
                  <div className={cn(
                    "flex-1 transition-colors duration-300",
                    isVertical
                      ? "w-0.5 min-h-[2rem] my-2 ml-[calc(50%-1px)] -mt-[calc(100%-2.25rem)]"
                      : "h-0.5 mx-2",
                    isComplete
                      ? "bg-blue-600 dark:bg-blue-500"
                      : "bg-gray-200 dark:bg-zinc-700",
                  )} />
                )}
              </div>

              {/* Labels */}
              {variant !== "minimal" && (
                <div className={cn(
                  isVertical ? "flex-1 pb-0" : "mt-3 text-center",
                )}>
                  <p className={cn(
                    "text-sm font-semibold",
                    isCurrent  && "text-blue-600 dark:text-blue-400",
                    isComplete && "text-gray-900 dark:text-zinc-100",
                    !isComplete && !isCurrent && "text-gray-400 dark:text-zinc-500",
                  )}>
                    {step.label}
                  </p>
                  {step.description && (
                    <p className="text-xs text-gray-500 dark:text-zinc-400 mt-0.5">
                      {step.description}
                    </p>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}