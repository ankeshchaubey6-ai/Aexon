import { cn } from '../../utils/cn.js';

/** PricingTable block — implement based on design spec */
export function PricingTable({ className, ...props }) {
  return <section className={cn('py-20', className)} {...props}>{/* PricingTable */}</section>;
}
