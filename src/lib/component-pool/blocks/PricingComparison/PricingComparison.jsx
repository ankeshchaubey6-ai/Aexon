import { cn } from '../../utils/cn.js';

/** PricingComparison block — implement based on design spec */
export function PricingComparison({ className, ...props }) {
  return <section className={cn('py-20', className)} {...props}>{/* PricingComparison */}</section>;
}
