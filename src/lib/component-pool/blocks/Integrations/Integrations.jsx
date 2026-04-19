import { cn } from '../../utils/cn.js';

/** Integrations block — implement based on design spec */
export function Integrations({ className, ...props }) {
  return <section className={cn('py-20', className)} {...props}>{/* Integrations */}</section>;
}
