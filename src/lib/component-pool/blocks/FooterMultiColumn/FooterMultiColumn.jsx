import { cn } from '../../utils/cn.js';

/** FooterMultiColumn block — implement based on design spec */
export function FooterMultiColumn({ className, ...props }) {
  return <section className={cn('py-20', className)} {...props}>{/* FooterMultiColumn */}</section>;
}
