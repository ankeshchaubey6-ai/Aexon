import { cn } from '../../utils/cn.js';

/** FooterDark block — implement based on design spec */
export function FooterDark({ className, ...props }) {
  return <section className={cn('py-20', className)} {...props}>{/* FooterDark */}</section>;
}
