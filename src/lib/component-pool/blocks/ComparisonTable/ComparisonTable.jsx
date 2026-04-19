import { cn } from '../../utils/cn.js';

/** ComparisonTable block — implement based on design spec */
export function ComparisonTable({ className, ...props }) {
  return <section className={cn('py-20', className)} {...props}>{/* ComparisonTable */}</section>;
}
