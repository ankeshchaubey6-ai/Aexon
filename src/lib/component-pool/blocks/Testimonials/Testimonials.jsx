import { cn } from '../../utils/cn.js';

/** Testimonials block — implement based on design spec */
export function Testimonials({ className, ...props }) {
  return <section className={cn('py-20', className)} {...props}>{/* Testimonials */}</section>;
}
