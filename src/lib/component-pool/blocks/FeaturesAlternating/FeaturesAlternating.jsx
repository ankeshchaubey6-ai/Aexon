import { cn } from '../../utils/cn.js';

/** FeaturesAlternating block — implement based on design spec */
export function FeaturesAlternating({ className, ...props }) {
  return <section className={cn('py-20', className)} {...props}>{/* FeaturesAlternating */}</section>;
}
