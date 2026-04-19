import { cn } from '../../utils/cn.js';

/** VideoPlayer block — implement based on design spec */
export function VideoPlayer({ className, ...props }) {
  return <section className={cn('py-20', className)} {...props}>{/* VideoPlayer */}</section>;
}
