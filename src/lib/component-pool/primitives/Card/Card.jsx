import { cn } from "../../utils/cn.js";

const variants = {
  default:  "bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-sm",
  flat:     "bg-gray-50 dark:bg-gray-900/50",
  elevated: "bg-white dark:bg-gray-900 shadow-lg",
  outline:  "border-2 border-gray-200 dark:border-gray-700",
};

export function Card({ variant = "default", padding = "md", hover = false, className, children, ...props }) {
  const paddings = { none: "", sm: "p-4", md: "p-5 sm:p-6", lg: "p-6 sm:p-8" };
  return (
    <div className={cn("rounded-xl", variants[variant], paddings[padding],
      hover && "transition-shadow duration-200 hover:shadow-md cursor-pointer",
      className)} {...props}>{children}</div>
  );
}

export function CardHeader({ className, children, ...props }) {
  return <div className={cn("flex items-center justify-between mb-4", className)} {...props}>{children}</div>;
}

export function CardTitle({ className, children, ...props }) {
  return <h3 className={cn("text-lg font-semibold text-gray-900 dark:text-gray-100", className)} {...props}>{children}</h3>;
}

export function CardDescription({ className, children, ...props }) {
  return <p className={cn("text-sm text-gray-500 dark:text-gray-400 mt-1", className)} {...props}>{children}</p>;
}

export function CardFooter({ className, children, ...props }) {
  return <div className={cn("flex items-center justify-end gap-2 mt-4 pt-4 border-t border-gray-100 dark:border-gray-800", className)} {...props}>{children}</div>;
}




