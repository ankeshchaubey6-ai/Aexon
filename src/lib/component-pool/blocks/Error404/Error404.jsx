import { cn } from '../../utils/cn.js';

/** Error404 block — implement based on design spec */
export function Error404({ className, ...props }) {
  return <section className={cn('py-20', className)} {...props}>{/* Error404 */}</section>;
}
