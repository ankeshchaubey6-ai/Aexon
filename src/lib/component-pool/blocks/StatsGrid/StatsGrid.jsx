import { cn } from '../../utils/cn.js';

/** StatsGrid block — implement based on design spec */
export function StatsGrid({ className, ...props }) {
  return <section className={cn('py-20', className)} {...props}>{/* StatsGrid */}</section>;
}
