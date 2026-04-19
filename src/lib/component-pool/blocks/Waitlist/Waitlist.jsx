import { cn } from '../../utils/cn.js';

/** Waitlist block — implement based on design spec */
export function Waitlist({ className, ...props }) {
  return <section className={cn('py-20', className)} {...props}>{/* Waitlist */}</section>;
}
