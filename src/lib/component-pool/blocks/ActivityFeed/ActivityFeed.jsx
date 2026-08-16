import { cn } from '../../utils/cn.js';

/** ActivityFeed block — implement based on design spec */
export function ActivityFeed({ className, ...props }) {
  return <section className={cn('py-20', className)} {...props}>{/* ActivityFeed */}</section>;
}
