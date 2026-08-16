import { cn } from '../../utils/cn.js';
export function SlideUp({ children, className, ...props }) { return <div className={cn(className)} {...props}>{children}</div>; }
