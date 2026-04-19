import { cn } from '../../utils/cn.js';

/** OrderSummary block — implement based on design spec */
export function OrderSummary({ className, ...props }) {
  return <section className={cn('py-20', className)} {...props}>{/* OrderSummary */}</section>;
}
