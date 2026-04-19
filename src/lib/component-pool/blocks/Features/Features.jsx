import { cn } from "../../utils/cn.js";

/**
 * Feature grid section.
 * @param {object[]} features - Array of { icon, title, description }
 * @param {2|3|4}    columns
 */
export function Features({ title, subtitle, features = [], columns = 3, className }) {
  const cols = { 2:"sm:grid-cols-2", 3:"sm:grid-cols-2 lg:grid-cols-3", 4:"sm:grid-cols-2 lg:grid-cols-4" };
  return (
    <section className={cn("py-20 sm:py-28", className)}>
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        {(title || subtitle) && (
          <div className="text-center max-w-2xl mx-auto mb-16">
            {title && <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white">{title}</h2>}
            {subtitle && <p className="mt-4 text-lg text-gray-600 dark:text-gray-400">{subtitle}</p>}
          </div>
        )}
        <div className={cn("grid gap-8", cols[columns] ?? cols[3])}>
          {features.map(({ icon: Icon, title: t, description: d, badge }, i) => (
            <div key={i} className="flex flex-col gap-4">
              {Icon && (
                <div className="w-12 h-12 rounded-xl bg-blue-50 dark:bg-blue-950 flex items-center justify-center text-blue-600 dark:text-blue-400">
                  <Icon size={24} />
                </div>
              )}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{t}</h3>
                <p className="mt-2 text-gray-600 dark:text-gray-400 leading-relaxed">{d}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
