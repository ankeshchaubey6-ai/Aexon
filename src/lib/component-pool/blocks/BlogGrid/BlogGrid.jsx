import { cn } from '../../utils/cn.js';

/** BlogGrid block — implement based on design spec */
export function BlogGrid({ className, ...props }) {
  return <section className={cn('py-20', className)} {...props}>{/* BlogGrid */}</section>;
}
