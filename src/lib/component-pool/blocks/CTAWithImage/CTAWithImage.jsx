import { cn } from '../../utils/cn.js';

/** CTAWithImage block — implement based on design spec */
export function CTAWithImage({ className, ...props }) {
  return <section className={cn('py-20', className)} {...props}>{/* CTAWithImage */}</section>;
}
