import { cn } from '../../utils/cn.js';

/** Team block — implement based on design spec */
export function Team({ className, ...props }) {
  return <section className={cn('py-20', className)} {...props}>{/* Team */}</section>;
}
