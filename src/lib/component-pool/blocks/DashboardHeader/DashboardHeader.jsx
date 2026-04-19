import { cn } from '../../utils/cn.js';

/** DashboardHeader block — implement based on design spec */
export function DashboardHeader({ className, ...props }) {
  return <section className={cn('py-20', className)} {...props}>{/* DashboardHeader */}</section>;
}
