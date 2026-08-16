import { cn } from "../../utils/cn.js";
import { Button } from "../../primitives/Button/Button.jsx";

export function CTA({ title, subtitle, primaryCTA, secondaryCTA, variant = "gradient", className }) {
  return (
    <section className={cn("py-20 sm:py-28 overflow-hidden relative", className)}>
      {variant === "gradient" && <div className="absolute inset-0 -z-10 bg-gradient-to-br from-blue-600 to-violet-700"/>}
      {variant === "solid"    && <div className="absolute inset-0 -z-10 bg-blue-600"/>}
      {variant === "subtle"   && <div className="absolute inset-0 -z-10 bg-gray-50 dark:bg-gray-900"/>}
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <h2 className={cn("text-3xl sm:text-4xl font-bold", (variant==="gradient"||variant==="solid") ? "text-white" : "text-gray-900 dark:text-white")}>
          {title}
        </h2>
        {subtitle && <p className={cn("mt-4 text-lg max-w-2xl mx-auto", (variant==="gradient"||variant==="solid") ? "text-blue-100" : "text-gray-600 dark:text-gray-400")}>{subtitle}</p>}
        {(primaryCTA || secondaryCTA) && (
          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            {primaryCTA && <Button variant={(variant==="gradient"||variant==="solid") ? "secondary" : "primary"} size="xl" onClick={primaryCTA.onClick}>{primaryCTA.label}</Button>}
            {secondaryCTA && <Button variant="ghost" size="xl" className={(variant==="gradient"||variant==="solid") ? "text-white hover:bg-white/10" : ""} onClick={secondaryCTA.onClick}>{secondaryCTA.label}</Button>}
          </div>
        )}
      </div>
    </section>
  );
}
