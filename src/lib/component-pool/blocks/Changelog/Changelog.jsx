import { cn } from '../../utils/cn.js';

/** Changelog block — implement based on design spec */
export function Changelog({ className, ...props }) {
  return <section className={cn('py-20', className)} {...props}>{/* Changelog */}</section>;
}
