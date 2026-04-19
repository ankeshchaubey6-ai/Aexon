import { cn } from '../../utils/cn.js';

/** LeadCaptureForm block — implement based on design spec */
export function LeadCaptureForm({ className, ...props }) {
  return <section className={cn('py-20', className)} {...props}>{/* LeadCaptureForm */}</section>;
}
