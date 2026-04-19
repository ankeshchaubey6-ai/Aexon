import { cn } from '../../utils/cn.js';

/** Timeline block — implement based on design spec */
export function Timeline({ className, ...props }) {
  return <section className={cn('py-20', className)} {...props}>{/* Timeline */}</section>;
}
