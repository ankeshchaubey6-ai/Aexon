import { cn } from '../../utils/cn.js';

/** ComparisonCards block — implement based on design spec */
export function ComparisonCards({ className, ...props }) {
  return <section className={cn('py-20', className)} {...props}>{/* ComparisonCards */}</section>;
}
