import { cn } from '../../utils/cn.js';

/** Brands block — implement based on design spec */
export function Brands({ className, ...props }) {
  return <section className={cn('py-20', className)} {...props}>{/* Brands */}</section>;
}
