import { cn } from '../../utils/cn.js';

/** TrustBadges block — implement based on design spec */
export function TrustBadges({ className, ...props }) {
  return <section className={cn('py-20', className)} {...props}>{/* TrustBadges */}</section>;
}
