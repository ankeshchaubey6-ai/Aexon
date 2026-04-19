import { cn } from '../../utils/cn.js';
export function ScaleIn({ children, className, ...props }) { return <div className={cn(className)} {...props}>{children}</div>; }
