import { cn } from '../../utils/cn.js';

/** RecentTransactions block — implement based on design spec */
export function RecentTransactions({ className, ...props }) {
  return <section className={cn('py-20', className)} {...props}>{/* RecentTransactions */}</section>;
}
