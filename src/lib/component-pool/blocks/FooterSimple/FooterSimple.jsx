import { cn } from '../../utils/cn.js';

/** FooterSimple block — implement based on design spec */
export function FooterSimple({ className, ...props }) {
  return <section className={cn('py-20', className)} {...props}>{/* FooterSimple */}</section>;
}
