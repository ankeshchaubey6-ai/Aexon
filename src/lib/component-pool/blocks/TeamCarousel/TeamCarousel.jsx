import { cn } from '../../utils/cn.js';

/** TeamCarousel block — implement based on design spec */
export function TeamCarousel({ className, ...props }) {
  return <section className={cn('py-20', className)} {...props}>{/* TeamCarousel */}</section>;
}
