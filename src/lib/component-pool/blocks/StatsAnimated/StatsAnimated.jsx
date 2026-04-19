import { cn } from '../../utils/cn.js';

/** StatsAnimated block — implement based on design spec */
export function StatsAnimated({ className, ...props }) {
  return <section className={cn('py-20', className)} {...props}>{/* StatsAnimated */}</section>;
}
