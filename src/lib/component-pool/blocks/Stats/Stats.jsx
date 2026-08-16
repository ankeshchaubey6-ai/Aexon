import { cn } from '../../utils/cn.js';

/** Stats block — implement based on design spec */
export function Stats({ className, ...props }) {
  return <section className={cn('py-20', className)} {...props}>{/* Stats */}</section>;
}
