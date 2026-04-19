import { cn } from '../../utils/cn.js';

/** GalleryCarousel block — implement based on design spec */
export function GalleryCarousel({ className, ...props }) {
  return <section className={cn('py-20', className)} {...props}>{/* GalleryCarousel */}</section>;
}
