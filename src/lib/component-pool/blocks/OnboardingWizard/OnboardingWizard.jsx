import { cn } from '../../utils/cn.js';

/** OnboardingWizard block — implement based on design spec */
export function OnboardingWizard({ className, ...props }) {
  return <section className={cn('py-20', className)} {...props}>{/* OnboardingWizard */}</section>;
}
