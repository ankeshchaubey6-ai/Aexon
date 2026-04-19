import { cn } from '../../utils/cn.js';

/** TestimonialsGrid block — implement based on design spec */
export function TestimonialsGrid({ className, ...props }) {
  return <section className={cn('py-20', className)} {...props}>{/* TestimonialsGrid */}</section>;
}
