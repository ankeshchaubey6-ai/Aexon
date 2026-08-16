import { cn } from '../../utils/cn.js';

/** Maintenance block — implement based on design spec */
export function Maintenance({ className, ...props }) {
  return <section className={cn('py-20', className)} {...props}>{/* Maintenance */}</section>;
}
