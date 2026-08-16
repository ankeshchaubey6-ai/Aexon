import { cn } from "../../utils/cn.js";
import { Card } from "../../primitives/Card/Card.jsx";
import { formatCompact } from "../../utils/format.js";
import { TrendingUp, TrendingDown } from "lucide-react";

function StatCard({ label, value, change, changeLabel, icon: Icon, prefix = "", suffix = "" }) {
  const isPositive = change >= 0;
  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{label}</p>
        {Icon && <div className="w-9 h-9 rounded-lg bg-blue-50 dark:bg-blue-950 flex items-center justify-center text-blue-600 dark:text-blue-400"><Icon size={18}/></div>}
      </div>
      <p className="text-3xl font-bold text-gray-900 dark:text-white">{prefix}{typeof value === "number" ? formatCompact(value) : value}{suffix}</p>
      {change !== undefined && (
        <div className={cn("inline-flex items-center gap-1 text-sm font-medium", isPositive ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400")}>
          {isPositive ? <TrendingUp size={14}/> : <TrendingDown size={14}/>}
          {isPositive ? "+" : ""}{change}% {changeLabel ?? "vs last period"}
        </div>
      )}
    </Card>
  );
}

export function StatsCards({ stats = [], columns = 4, className }) {
  const cols = { 2:"sm:grid-cols-2", 3:"sm:grid-cols-3", 4:"sm:grid-cols-2 lg:grid-cols-4" };
  return <div className={cn("grid gap-4", cols[columns] ?? cols[4], className)}>{stats.map((s, i) => <StatCard key={i} {...s}/>)}</div>;
}
