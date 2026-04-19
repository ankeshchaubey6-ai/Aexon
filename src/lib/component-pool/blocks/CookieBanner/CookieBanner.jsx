import { cn } from '../../utils/cn.js';

/** CookieBanner block — implement based on design spec */
export function CookieBanner({ className, ...props }) {
  return <section className={cn('py-20', className)} {...props}>{/* CookieBanner */}</section>;
}
