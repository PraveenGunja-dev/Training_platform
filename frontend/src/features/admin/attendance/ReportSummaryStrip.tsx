interface Props {
  summary: { total: number; present: number; absent: number };
}

export function ReportSummaryStrip({ summary }: Props) {
  return (
    <div className="grid grid-cols-3 gap-4">
      <div className="rounded-lg border border-white/10 bg-white/[0.04] p-4 text-center">
        <p className="text-3xl font-bold font-display text-foreground">{summary.total}</p>
        <p className="text-xs text-muted-foreground mt-1 uppercase tracking-wider">Total</p>
      </div>
      <div className="rounded-lg border border-brand-teal/30 bg-brand-teal/10 p-4 text-center">
        <p className="text-3xl font-bold font-display text-brand-teal">{summary.present}</p>
        <p className="text-xs text-muted-foreground mt-1 uppercase tracking-wider">Present</p>
      </div>
      <div className="rounded-lg border border-white/10 bg-white/[0.04] p-4 text-center">
        <p className="text-3xl font-bold font-display text-foreground/50">{summary.absent}</p>
        <p className="text-xs text-muted-foreground mt-1 uppercase tracking-wider">Absent</p>
      </div>
    </div>
  );
}
