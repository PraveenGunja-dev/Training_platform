import { useQuery } from '@tanstack/react-query';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from 'recharts';
import { groupsApi } from '@/api/groups';
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from '@/components/ui/table';
const PIE_COLORS = ['#22c55e', '#e5e7eb'];

export function AnalyticsTab({ groupId }: { groupId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ['group-analytics', groupId],
    queryFn: () => groupsApi.analytics(groupId),
  });

  if (isLoading) {
    return <div className="py-8 text-center text-sm text-muted-foreground/70">Loading analytics...</div>;
  }

  const analytics = data?.data;
  if (!analytics) return null;

  const { attendance_trend, submission_completion, top_participants } = analytics;
  const completedPct = submission_completion.total > 0
    ? Math.round((submission_completion.completed / submission_completion.total) * 100)
    : 0;
  const pieData = [
    { name: 'Completed', value: submission_completion.completed },
    { name: 'Remaining', value: submission_completion.total - submission_completion.completed },
  ];

  return (
    <div className="mt-4 space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Attendance Trend */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="h-1.5 bg-gradient-to-r from-[#0052A5] to-[#E31837]" />
          <div className="p-4 border-b border-slate-100">
            <p className="text-sm font-semibold text-slate-800">Attendance Trend (Last 4 Weeks)</p>
          </div>
          <div className="p-4">
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={attendance_trend} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="week" tick={{ fontSize: 11 }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} unit="%" />
                  <Tooltip formatter={(v: number) => [`${v}%`, 'Rate']} />
                  <Line
                    type="monotone"
                    dataKey="rate"
                    stroke="#0052A5"
                    strokeWidth={2}
                    dot={{ r: 4 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Submission Completion */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="h-1.5 bg-gradient-to-r from-[#0052A5] to-[#E31837]" />
          <div className="p-4 border-b border-slate-100">
            <p className="text-sm font-semibold text-slate-800">Submission Completion ({completedPct}%)</p>
          </div>
          <div className="p-4">
            <div className="h-48 flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={75}
                    dataKey="value"
                    startAngle={90}
                    endAngle={-270}
                  >
                    {pieData.map((entry, i) => (
                      <Cell key={entry.name} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <p className="text-center text-sm text-slate-500">
              {submission_completion.completed} / {submission_completion.total} submitted
            </p>
          </div>
        </div>
      </div>

      {/* Top 5 Participants */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="h-1.5 bg-gradient-to-r from-[#0052A5] to-[#E31837]" />
        <div className="p-4 border-b border-slate-100">
          <p className="text-sm font-semibold text-slate-800">Top 5 Participants by Activity</p>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Attendance</TableHead>
              <TableHead>Submissions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {top_participants.map(p => (
              <TableRow key={p.id}>
                <TableCell className="font-medium">{p.name}</TableCell>
                <TableCell>
                  <span className={p.attendance_rate >= 80 ? 'text-green-600' : 'text-amber-600'}>
                    {p.attendance_rate}%
                  </span>
                </TableCell>
                <TableCell>{p.submissions}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
