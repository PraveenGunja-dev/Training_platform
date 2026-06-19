import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from 'recharts';
import { BarChart2 } from 'lucide-react';
import { useAuthStore } from '@/store/auth';
import { groupsApi } from '@/api/groups';
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from '@/components/ui/table';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';

const PIE_COLORS = ['#0d9488', '#e2e8f0'];

export default function GroupAdminAnalyticsPage() {
  const { user } = useAuthStore();
  const groupIds = user?.admin_of_group_ids ?? [];
  const [selectedGroupId, setSelectedGroupId] = useState<string>(groupIds[0] ?? '');
  const [subGroupId, setSubGroupId] = useState('');

  const { data: subGroupsData } = useQuery({
    queryKey: ['sub-groups', selectedGroupId],
    queryFn: () => groupsApi.listSubGroups(selectedGroupId!),
    enabled: !!selectedGroupId,
    staleTime: 30_000,
  });
  const subGroups = subGroupsData?.data ?? [];

  const { data, isLoading } = useQuery({
    queryKey: ['group-analytics', selectedGroupId, subGroupId || 'all'],
    queryFn: () => groupsApi.analytics(selectedGroupId!, subGroupId ? { sub_group_id: subGroupId } : undefined),
    enabled: !!selectedGroupId,
  });

  const analytics = data?.data;
  const completedPct = analytics && analytics.submission_completion.total > 0
    ? Math.round((analytics.submission_completion.completed / analytics.submission_completion.total) * 100)
    : 0;

  const pieData = analytics
    ? [
        { name: 'Completed', value: analytics.submission_completion.completed },
        { name: 'Remaining', value: Math.max(0, analytics.submission_completion.total - analytics.submission_completion.completed) },
      ]
    : [];

  if (groupIds.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-slate-500">
        <p className="text-sm">You are not assigned as admin for any group.</p>
        <p className="text-xs mt-1 text-slate-400">Contact a Super Admin to get access.</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-teal-100">
            <BarChart2 className="h-5 w-5 text-teal-700" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-800">Analytics</h1>
            <p className="text-sm text-slate-500">Attendance and submission trends for your group</p>
          </div>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {groupIds.length > 1 && (
            <Select value={selectedGroupId} onValueChange={setSelectedGroupId}>
              <SelectTrigger className="w-64">
                <SelectValue placeholder="Select group" />
              </SelectTrigger>
              <SelectContent>
                {groupIds.map(id => (
                  <SelectItem key={id} value={id}>{id}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {subGroups.length > 0 && (
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-slate-600">Filter:</label>
              <select
                value={subGroupId}
                onChange={e => setSubGroupId(e.target.value)}
                className="h-9 rounded-md border border-input bg-background px-3 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">Whole group</option>
                {subGroups.map(sg => (
                  <option key={sg.id} value={sg.id}>{sg.name} ({sg.participants_count})</option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {isLoading || !analytics ? (
        <div className="py-16 text-center text-sm text-slate-400">Loading analytics…</div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Attendance Trend */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="h-1.5 bg-gradient-to-r from-teal-500 to-[#0052A5]" />
              <div className="p-4 border-b border-slate-100">
                <p className="text-sm font-semibold text-slate-800">Attendance Trend (Last 4 Weeks)</p>
              </div>
              <div className="p-4">
                <div className="h-52">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={analytics.attendance_trend} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis dataKey="week" tick={{ fontSize: 11 }} />
                      <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} unit="%" />
                      <Tooltip formatter={(v: number) => [`${v}%`, 'Rate']} />
                      <Line type="monotone" dataKey="rate" stroke="#0d9488" strokeWidth={2} dot={{ r: 4 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* Submission Completion */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="h-1.5 bg-gradient-to-r from-teal-500 to-[#0052A5]" />
              <div className="p-4 border-b border-slate-100">
                <p className="text-sm font-semibold text-slate-800">
                  Submission Completion ({completedPct}%)
                </p>
              </div>
              <div className="p-4 flex flex-col items-center justify-center">
                <div className="h-52 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={pieData} cx="50%" cy="50%" innerRadius={55} outerRadius={80}
                        dataKey="value" startAngle={90} endAngle={-270}>
                        {pieData.map((entry, i) => (
                          <Cell key={entry.name} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <p className="text-sm text-slate-500 -mt-2">
                  {analytics.submission_completion.completed} / {analytics.submission_completion.total} submitted
                </p>
              </div>
            </div>
          </div>

          {/* Top 5 Participants */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="h-1.5 bg-gradient-to-r from-teal-500 to-[#0052A5]" />
            <div className="p-4 border-b border-slate-100">
              <p className="text-sm font-semibold text-slate-800">Top 5 Participants by Activity</p>
            </div>
            {analytics.top_participants.length === 0 ? (
              <p className="py-8 text-center text-sm text-slate-400">No participant data yet.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50/50">
                    <TableHead>Name</TableHead>
                    <TableHead>Attendance</TableHead>
                    <TableHead>Submissions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {analytics.top_participants.map(p => (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium text-slate-800">{p.name}</TableCell>
                      <TableCell>
                        <span className={p.attendance_rate >= 80 ? 'text-green-600 font-medium' : 'text-amber-600 font-medium'}>
                          {p.attendance_rate}%
                        </span>
                      </TableCell>
                      <TableCell className="text-slate-700">{p.submissions}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </>
      )}
    </div>
  );
}
