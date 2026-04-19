import { cn } from '../../utils/cn.js';
export function RotateIn({ children, className, ...props }) { return <div className={cn(className)} {...props}>{children}</div>; }
