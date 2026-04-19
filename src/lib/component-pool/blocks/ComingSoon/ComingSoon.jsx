import { cn } from '../../utils/cn.js';

/** ComingSoon block — implement based on design spec */
export function ComingSoon({ className, ...props }) {
  return <section className={cn('py-20', className)} {...props}>{/* ComingSoon */}</section>;
}
