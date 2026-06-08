import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface ChartContainerProps {
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  children: ReactNode;
  className?: string;
  action?: ReactNode;
}

export function ChartContainer({ title, subtitle, icon, children, className, action }: ChartContainerProps) {
  return (
    <div className={cn('bg-white rounded-2xl border border-[#C5D8EC] shadow-card overflow-hidden', className)}>
      <div className="flex items-center justify-between px-5 py-4 border-b border-[#EBF3FB]">
        <div className="flex items-center gap-2.5">
          {icon && (
            <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-blue-50 text-[#0066BB]">
              {icon}
            </div>
          )}
          <div>
            <p className="text-sm font-semibold text-[#00285A] leading-tight">{title}</p>
            {subtitle && <p className="text-xs text-[#5A7A9A] mt-0.5">{subtitle}</p>}
          </div>
        </div>
        {action && <div>{action}</div>}
      </div>
      <div className="px-5 py-4">{children}</div>
    </div>
  );
}
