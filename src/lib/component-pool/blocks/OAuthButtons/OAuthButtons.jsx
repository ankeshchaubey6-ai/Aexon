import { cn } from '../../utils/cn.js';

/** OAuthButtons block — implement based on design spec */
export function OAuthButtons({ className, ...props }) {
  return <section className={cn('py-20', className)} {...props}>{/* OAuthButtons */}</section>;
}
