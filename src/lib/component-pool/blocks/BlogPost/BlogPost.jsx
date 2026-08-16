import { cn } from '../../utils/cn.js';

/** BlogPost block — implement based on design spec */
export function BlogPost({ className, ...props }) {
  return <section className={cn('py-20', className)} {...props}>{/* BlogPost */}</section>;
}
