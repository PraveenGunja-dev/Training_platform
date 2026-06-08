interface TooltipPayload {
  color?: string;
  name?: string;
  value?: number | string;
  dataKey?: string;
}

interface ChartTooltipProps {
  active?: boolean;
  payload?: TooltipPayload[];
  label?: string;
  unit?: string;
  formatter?: (v: number | string) => string;
}

export function ChartTooltip({ active, payload, label, unit = '', formatter }: ChartTooltipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-[#C5D8EC] rounded-xl shadow-card-md px-3 py-2.5 text-xs min-w-[120px]">
      {label && (
        <p className="font-semibold text-[#00285A] mb-1.5 border-b border-[#EBF3FB] pb-1.5">{label}</p>
      )}
      <div className="space-y-1">
        {payload.map((p, i) => (
          <div key={i} className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-1.5">
              <span
                className="w-2 h-2 rounded-full flex-shrink-0"
                style={{ backgroundColor: p.color ?? '#4F46E5' }}
              />
              <span className="text-[#7C7AAE]">{p.name}</span>
            </div>
            <span className="font-semibold text-[#00285A]">
              {formatter ? formatter(p.value ?? 0) : `${p.value}${unit}`}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
