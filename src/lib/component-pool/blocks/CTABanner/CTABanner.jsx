import { cn } from '../../utils/cn.js';

/** CTABanner block — implement based on design spec */
export function CTABanner({ className, ...props }) {
  return <section className={cn('py-20', className)} {...props}>{/* CTABanner */}</section>;
}
