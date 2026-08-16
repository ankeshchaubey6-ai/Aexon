import { cn } from '../../utils/cn.js';
export function Pulse({ children, className, ...props }) { return <div className={cn(className)} {...props}>{children}</div>; }
