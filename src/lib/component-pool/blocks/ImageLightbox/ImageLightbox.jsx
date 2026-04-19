import { cn } from '../../utils/cn.js';

/** ImageLightbox block — implement based on design spec */
export function ImageLightbox({ className, ...props }) {
  return <section className={cn('py-20', className)} {...props}>{/* ImageLightbox */}</section>;
}
