import { cn } from '../../utils/cn.js';

/** TeamGrid block — implement based on design spec */
export function TeamGrid({ className, ...props }) {
  return <section className={cn('py-20', className)} {...props}>{/* TeamGrid */}</section>;
}
