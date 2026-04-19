import { cn } from '../../utils/cn.js';

/** DiscountBanner block — implement based on design spec */
export function DiscountBanner({ className, ...props }) {
  return <section className={cn('py-20', className)} {...props}>{/* DiscountBanner */}</section>;
}
