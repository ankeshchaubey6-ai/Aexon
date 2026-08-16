import { cn } from '../../utils/cn.js';

/** SocialProof block — implement based on design spec */
export function SocialProof({ className, ...props }) {
  return <section className={cn('py-20', className)} {...props}>{/* SocialProof */}</section>;
}
