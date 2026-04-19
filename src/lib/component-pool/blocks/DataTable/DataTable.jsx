import { cn } from '../../utils/cn.js';

/** DataTable block — implement based on design spec */
export function DataTable({ className, ...props }) {
  return <section className={cn('py-20', className)} {...props}>{/* DataTable */}</section>;
}
