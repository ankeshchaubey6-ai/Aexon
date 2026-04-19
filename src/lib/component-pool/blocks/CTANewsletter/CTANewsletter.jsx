import { cn } from '../../utils/cn.js';

/** CTANewsletter block — implement based on design spec */
export function CTANewsletter({ className, ...props }) {
  return <section className={cn('py-20', className)} {...props}>{/* CTANewsletter */}</section>;
}
