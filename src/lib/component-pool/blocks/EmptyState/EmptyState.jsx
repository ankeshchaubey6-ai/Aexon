import { cn } from '../../utils/cn.js';

/** EmptyState block — implement based on design spec */
export function EmptyState({ className, ...props }) {
  return <section className={cn('py-20', className)} {...props}>{/* EmptyState */}</section>;
}
