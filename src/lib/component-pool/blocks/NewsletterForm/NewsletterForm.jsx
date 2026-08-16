import { cn } from '../../utils/cn.js';

/** NewsletterForm block — implement based on design spec */
export function NewsletterForm({ className, ...props }) {
  return <section className={cn('py-20', className)} {...props}>{/* NewsletterForm */}</section>;
}
