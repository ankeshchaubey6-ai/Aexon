import { useState } from "react";
import { cn } from "../../utils/cn.js";
import { Button } from "../../primitives/Button/Button.jsx";
import { Badge } from "../../primitives/Badge/Badge.jsx";
import { Check } from "lucide-react";

/**
 * Full pricing section with monthly/annual toggle.
 * @param {object[]} plans - Array of plan objects
 * @param {string}   title
 * @param {string}   subtitle
 */
export function Pricing({ title = "Simple, transparent pricing", subtitle, plans = [] }) {
  const [annual, setAnnual] = useState(false);
  return (
    <section className="py-20 sm:py-28">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white">{title}</h2>
        {subtitle && <p className="mt-4 text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">{subtitle}</p>}

        {/* Billing toggle */}
        <div className="mt-8 inline-flex items-center gap-3 bg-gray-100 dark:bg-gray-800 rounded-full p-1">
          <button onClick={() => setAnnual(false)} className={cn("px-4 py-1.5 rounded-full text-sm font-medium transition-all", !annual ? "bg-white dark:bg-gray-700 shadow text-gray-900 dark:text-white" : "text-gray-500")}>Monthly</button>
          <button onClick={() => setAnnual(true)}  className={cn("px-4 py-1.5 rounded-full text-sm font-medium transition-all", annual ? "bg-white dark:bg-gray-700 shadow text-gray-900 dark:text-white" : "text-gray-500")}>
            Annual <span className="ml-1 text-xs text-emerald-600 font-semibold">−20%</span>
          </button>
        </div>

        <div className="mt-12 grid gap-8 lg:grid-cols-3 max-w-5xl mx-auto">
          {plans.map((plan, i) => (
            <div key={i} className={cn("relative rounded-2xl p-8 flex flex-col", plan.featured
              ? "bg-blue-600 text-white shadow-2xl shadow-blue-500/25 scale-105"
              : "bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-sm")}>
              {plan.badge && <Badge variant={plan.featured ? "default" : "primary"} className="absolute -top-3 left-1/2 -translate-x-1/2">{plan.badge}</Badge>}
              <div>
                <h3 className={cn("text-xl font-bold", plan.featured ? "text-white" : "text-gray-900 dark:text-white")}>{plan.name}</h3>
                {plan.description && <p className={cn("mt-1 text-sm", plan.featured ? "text-blue-100" : "text-gray-500 dark:text-gray-400")}>{plan.description}</p>}
                <div className="mt-6 flex items-baseline gap-1">
                  <span className={cn("text-4xl font-extrabold", plan.featured ? "text-white" : "text-gray-900 dark:text-white")}>
                    ${annual ? Math.floor((plan.price ?? 0) * 0.8) : plan.price ?? 0}
                  </span>
                  <span className={cn("text-sm", plan.featured ? "text-blue-100" : "text-gray-500")}>/mo</span>
                </div>
              </div>
              <ul className="mt-8 space-y-3 flex-1">
                {(plan.features ?? []).map((f, j) => (
                  <li key={j} className="flex items-start gap-2 text-sm">
                    <Check size={16} className={cn("mt-0.5 shrink-0", plan.featured ? "text-blue-200" : "text-emerald-500")} />
                    <span className={plan.featured ? "text-blue-50" : "text-gray-700 dark:text-gray-300"}>{f}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-8">
                <Button variant={plan.featured ? "secondary" : "primary"} size="lg" fullWidth onClick={plan.onCTA}>
                  {plan.cta ?? "Get started"}
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
