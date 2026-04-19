import { cn } from '../../utils/cn.js';

/** FeaturesTabs block — implement based on design spec */
export function FeaturesTabs({ className, ...props }) {
  return <section className={cn('py-20', className)} {...props}>{/* FeaturesTabs */}</section>;
}
