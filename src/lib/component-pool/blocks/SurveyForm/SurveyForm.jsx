import { cn } from '../../utils/cn.js';

/** SurveyForm block — implement based on design spec */
export function SurveyForm({ className, ...props }) {
  return <section className={cn('py-20', className)} {...props}>{/* SurveyForm */}</section>;
}
