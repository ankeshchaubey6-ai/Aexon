import { cn } from '../../utils/cn.js';

/** Cart block — implement based on design spec */
export function Cart({ className, ...props }) {
  return <section className={cn('py-20', className)} {...props}>{/* Cart */}</section>;
}
