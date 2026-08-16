import { cn } from '../../utils/cn.js';

/** Error500 block — implement based on design spec */
export function Error500({ className, ...props }) {
  return <section className={cn('py-20', className)} {...props}>{/* Error500 */}</section>;
}
