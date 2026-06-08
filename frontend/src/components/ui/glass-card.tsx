import { forwardRef } from 'react';
import { cn } from '@/lib/utils';

export const GlassCard = forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        'rounded-xl border border-white/20 bg-white/[0.06] backdrop-blur-md shadow-2xl shadow-black/40 p-6',
        className,
      )}
      {...props}
    />
  ),
);
GlassCard.displayName = 'GlassCard';
