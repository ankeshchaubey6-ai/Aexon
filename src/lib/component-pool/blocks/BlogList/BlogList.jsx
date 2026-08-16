import { cn } from '../../utils/cn.js';

/** BlogList block — implement based on design spec */
export function BlogList({ className, ...props }) {
  return <section className={cn('py-20', className)} {...props}>{/* BlogList */}</section>;
}
