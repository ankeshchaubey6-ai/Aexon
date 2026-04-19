import { cn } from '../../utils/cn.js';

/** MultiStepForm block — implement based on design spec */
export function MultiStepForm({ className, ...props }) {
  return <section className={cn('py-20', className)} {...props}>{/* MultiStepForm */}</section>;
}
