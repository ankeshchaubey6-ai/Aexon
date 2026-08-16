import { cn } from '../../utils/cn.js';

/** NoResults block — implement based on design spec */
export function NoResults({ className, ...props }) {
  return <section className={cn('py-20', className)} {...props}>{/* NoResults */}</section>;
}
