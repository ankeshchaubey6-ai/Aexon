import { cn } from '../../utils/cn.js';

/** AnnouncementBar block — implement based on design spec */
export function AnnouncementBar({ className, ...props }) {
  return <section className={cn('py-20', className)} {...props}>{/* AnnouncementBar */}</section>;
}
