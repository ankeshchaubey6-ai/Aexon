import { cn } from '../../utils/cn.js';

/** FAQAccordion block — implement based on design spec */
export function FAQAccordion({ className, ...props }) {
  return <section className={cn('py-20', className)} {...props}>{/* FAQAccordion */}</section>;
}
