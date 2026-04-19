import { cn } from '../../utils/cn.js';

/** Blog block — implement based on design spec */
export function Blog({ className, ...props }) {
  return <section className={cn('py-20', className)} {...props}>{/* Blog */}</section>;
}
