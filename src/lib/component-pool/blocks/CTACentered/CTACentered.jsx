import { cn } from '../../utils/cn.js';

/** CTACentered block — implement based on design spec */
export function CTACentered({ className, ...props }) {
  return <section className={cn('py-20', className)} {...props}>{/* CTACentered */}</section>;
}
