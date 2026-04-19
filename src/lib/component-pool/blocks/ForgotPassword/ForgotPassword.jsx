import { cn } from '../../utils/cn.js';

/** ForgotPassword block — implement based on design spec */
export function ForgotPassword({ className, ...props }) {
  return <section className={cn('py-20', className)} {...props}>{/* ForgotPassword */}</section>;
}
