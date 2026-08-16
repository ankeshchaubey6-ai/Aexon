import { cn } from '../../utils/cn.js';

/** GalleryMasonry block — implement based on design spec */
export function GalleryMasonry({ className, ...props }) {
  return <section className={cn('py-20', className)} {...props}>{/* GalleryMasonry */}</section>;
}
