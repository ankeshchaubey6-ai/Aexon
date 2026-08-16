import { cn } from "../../utils/cn.js";

/** Loading shimmer / skeleton effect */
export function Shimmer({ className, ...props }) {
  return (
    <div className={cn("relative overflow-hidden rounded-md bg-gray-200 dark:bg-gray-800", className)} {...props}>
      <div className="absolute inset-0 -translate-x-full animate-[shimmer_1.5s_infinite] bg-gradient-to-r from-transparent via-white/40 dark:via-white/10 to-transparent" />
      <style>{`@keyframes shimmer{100%{transform:translateX(100%)}}`}</style>
    </div>
  );
}
