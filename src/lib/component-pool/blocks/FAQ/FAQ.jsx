import { cn } from '../../utils/cn.js';

/** FAQ block — implement based on design spec */
export function FAQ({ className, ...props }) {
  return <section className={cn('py-20', className)} {...props}>{/* FAQ */}</section>;
}
