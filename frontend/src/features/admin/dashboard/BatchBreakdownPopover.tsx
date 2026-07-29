import { useState, useCallback, useRef } from 'react';
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from '@/components/ui/popover';

export interface BreakdownRow {
  group_id: string;
  group_name: string;
  value: number;
  /** Optional secondary label shown in muted text after the value, e.g. "/ 240" */
  valueSuffix?: string;
}

interface BatchBreakdownPopoverProps {
  /** The KPI card label shown as the popover header */
  title: string;
  /** Per-batch rows */
  rows: BreakdownRow[];
  /** Total / summary line shown above the batch rows (optional) */
  summary?: string;
  /** The KPI card element to use as the popover trigger */
  children: React.ReactNode;
  /** Disable the popover entirely (e.g. while breakdown data is loading) */
  disabled?: boolean;
}

export function BatchBreakdownPopover({
  title,
  rows,
  summary,
  children,
  disabled = false,
}: BatchBreakdownPopoverProps) {
  const [open, setOpen] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Hover-based control for pointer devices
  const handleMouseEnter = useCallback(() => {
    if (disabled) return;
    if (closeTimer.current) clearTimeout(closeTimer.current);
    setOpen(true);
  }, [disabled]);

  const handleMouseLeave = useCallback(() => {
    // Small delay so cursor can move from trigger into popover content
    closeTimer.current = setTimeout(() => setOpen(false), 120);
  }, []);

  if (disabled || rows.length === 0) {
    // No data yet — render the card as-is with no popover chrome
    return <>{children}</>;
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <div
          className="cursor-default outline-none"
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
        >
          {children}
        </div>
      </PopoverTrigger>
      <PopoverContent
        side="bottom"
        align="start"
        sideOffset={6}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        className="
          w-56 p-0 rounded-xl border border-[#C5D8EC] bg-white shadow-lg
          data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95
          data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95
          duration-150
        "
      >
        {/* Header */}
        <div className="px-3.5 py-2.5 border-b border-[#EBF3FB]">
          <p className="text-xs font-semibold text-[#00285A] uppercase tracking-wide">{title}</p>
          {summary && (
            <p className="text-xs text-[#5A7A9A] mt-0.5">{summary}</p>
          )}
        </div>

        {/* Per-batch rows */}
        <div className="px-3.5 py-2 space-y-1.5 max-h-52 overflow-y-auto">
          {rows.map((row) => (
            <div
              key={row.group_id}
              className="flex items-center justify-between gap-2"
            >
              <span
                className="text-xs text-[#5A7A9A] truncate max-w-[130px]"
                title={row.group_name}
              >
                {row.group_name}
              </span>
              <span className="text-xs font-semibold text-[#00285A] whitespace-nowrap flex-shrink-0">
                {row.value}
                {row.valueSuffix && (
                  <span className="text-[#7C7AAE] font-normal"> {row.valueSuffix}</span>
                )}
              </span>
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
