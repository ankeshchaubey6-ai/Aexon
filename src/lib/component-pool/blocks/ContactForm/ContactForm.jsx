import { cn } from '../../utils/cn.js';

/** ContactForm block — implement based on design spec */
export function ContactForm({ className, ...props }) {
  return <section className={cn('py-20', className)} {...props}>{/* ContactForm */}</section>;
}
