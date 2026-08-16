import { cn } from '../../utils/cn.js';

/** Gallery block — implement based on design spec */
export function Gallery({ className, ...props }) {
  return <section className={cn('py-20', className)} {...props}>{/* Gallery */}</section>;
}
