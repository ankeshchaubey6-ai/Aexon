import { useState } from "react";
import { cn } from "../../utils/cn.js";

export function DashboardLayout({ sidebar, header, children, className }) {
  const [collapsed, setCollapsed] = useState(false);
  return (
    <div className="flex h-screen overflow-hidden bg-gray-50 dark:bg-gray-950">
      <aside className={cn("flex-shrink-0 transition-all duration-300 border-r border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900", collapsed ? "w-16" : "w-64")}>
        {sidebar}
      </aside>
      <div className="flex flex-col flex-1 overflow-hidden">
        <header className="h-16 flex items-center border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-6 shrink-0">{header}</header>
        <main className={cn("flex-1 overflow-y-auto p-6", className)}>{children}</main>
      </div>
    </div>
  );
}
