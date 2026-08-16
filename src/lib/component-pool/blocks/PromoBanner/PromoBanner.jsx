import { cn } from '../../utils/cn.js';

/** PromoBanner block — implement based on design spec */
export function PromoBanner({ className, ...props }) {
  return <section className={cn('py-20', className)} {...props}>{/* PromoBanner */}</section>;
}
