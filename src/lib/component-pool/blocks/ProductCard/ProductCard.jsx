import { cn } from '../../utils/cn.js';

/** ProductCard block — implement based on design spec */
export function ProductCard({ className, ...props }) {
  return <section className={cn('py-20', className)} {...props}>{/* ProductCard */}</section>;
}
