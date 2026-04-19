import { cn } from '../../utils/cn.js';

/** Comments block — implement based on design spec */
export function Comments({ className, ...props }) {
  return <section className={cn('py-20', className)} {...props}>{/* Comments */}</section>;
}
