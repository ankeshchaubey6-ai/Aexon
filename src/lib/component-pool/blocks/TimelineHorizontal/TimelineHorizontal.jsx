import { cn } from '../../utils/cn.js';

/** TimelineHorizontal block — implement based on design spec */
export function TimelineHorizontal({ className, ...props }) {
  return <section className={cn('py-20', className)} {...props}>{/* TimelineHorizontal */}</section>;
}
