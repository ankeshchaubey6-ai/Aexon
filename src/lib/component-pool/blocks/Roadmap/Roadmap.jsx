import { cn } from '../../utils/cn.js';

/** Roadmap block — implement based on design spec */
export function Roadmap({ className, ...props }) {
  return <section className={cn('py-20', className)} {...props}>{/* Roadmap */}</section>;
}
