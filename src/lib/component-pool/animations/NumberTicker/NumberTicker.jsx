import { cn } from '../../utils/cn.js';
export function NumberTicker({ children, className, ...props }) { return <div className={cn(className)} {...props}>{children}</div>; }
