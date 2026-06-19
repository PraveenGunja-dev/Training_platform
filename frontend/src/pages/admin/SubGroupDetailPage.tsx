import { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft, Users, Trash2, AlertTriangle,
  UserCircle, Pencil,
} from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from 'recharts';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from '@/components/ui/table';
import { ErrorState } from '@/components/states/ErrorState';
import { groupsApi } from '@/api/groups';

const PIE_COLORS = ['#7c3aed', '#ede9fe'];
const TRIGGER = "rounded-lg text-sm font-semibold text-slate-500 data-[state=active]:bg-white data-[state=active]:text-violet-700 data-[state=active]:shadow-sm data-[state=active]:border data-[state=active]:border-violet-200";

// ── Skeleton ──────────────────────────────────────────────────────────────
function Skeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-4 w-28 bg-violet-100 rounded" />
      <div className="h-40 bg-violet-100 rounded-2xl" />
      <div className="h-10 bg-violet-50 rounded-xl" />
      <div className="h-64 bg-white rounded-2xl border border-violet-100" />
    </div>
  );
}

// ── ParticipantsPanel ─────────────────────────────────────────────────────
function ParticipantsPanel({ participants }: { participants: Array<{ id: string; full_name: string; email: string }> }) {
  const navigate = useNavigate();
  if (participants.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-14 rounded-xl border-2 border-dashed border-violet-100 bg-violet-50/40">
        <UserCircle className="h-10 w-10 text-violet-200 mb-2" />
        <p className="text-sm font-medium text-slate-500">No participants in this sub-group</p>
      </div>
    );
  }
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="h-1 bg-gradient-to-r from-violet-500 to-purple-400" />
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>#</TableHead>
            <TableHead>Name</TableHead>
            <TableHead>Email</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {participants.map((p, i) => (
            <TableRow
              key={p.id}
              className="cursor-pointer hover:bg-violet-50/50 transition-colors"
              onClick={() => navigate(`/admin/users/${p.id}`)}
            >
              <TableCell className="text-slate-400 text-xs w-10">{i + 1}</TableCell>
              <TableCell className="font-medium text-[#00285A] hover:text-violet-700 hover:underline">
                {p.full_name}
              </TableCell>
              <TableCell className="text-slate-500 text-sm">{p.email}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

// ── AnalyticsPanel ────────────────────────────────────────────────────────
function AnalyticsPanel({ groupId, subGroupId }: { groupId: string; subGroupId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ['group-analytics', groupId, subGroupId],
    queryFn: () => groupsApi.analytics(groupId, { sub_group_id: subGroupId }),
  });

  if (isLoading) return <div className="py-10 text-center text-sm text-slate-400">Loading analytics…</div>;

  const analytics = data?.data;
  if (!analytics) return null;

  const { attendance_trend, submission_completion, top_participants } = analytics;
  const pct = submission_completion.total > 0
    ? Math.round((submission_completion.completed / submission_completion.total) * 100) : 0;
  const pieData = [
    { name: 'Completed', value: submission_completion.completed },
    { name: 'Remaining', value: submission_completion.total - submission_completion.completed },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Attendance Trend */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="h-1.5 bg-gradient-to-r from-violet-500 to-purple-400" />
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
                  <Line type="monotone" dataKey="rate" stroke="#7c3aed" strokeWidth={2} dot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Submission Completion */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="h-1.5 bg-gradient-to-r from-violet-500 to-purple-400" />
          <div className="p-4 border-b border-slate-100">
            <p className="text-sm font-semibold text-slate-800">Submission Completion ({pct}%)</p>
          </div>
          <div className="p-4">
            <div className="h-48 flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={75}
                    dataKey="value" startAngle={90} endAngle={-270}>
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

      {/* Top Participants */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="h-1.5 bg-gradient-to-r from-violet-500 to-purple-400" />
        <div className="p-4 border-b border-slate-100">
          <p className="text-sm font-semibold text-slate-800">Top Participants by Activity</p>
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
            {top_participants.length === 0 ? (
              <TableRow>
                <TableCell colSpan={3} className="text-center text-slate-400 text-sm py-6">
                  No activity data yet.
                </TableCell>
              </TableRow>
            ) : (
              top_participants.map(p => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.name}</TableCell>
                  <TableCell>
                    <span className={p.attendance_rate >= 80 ? 'text-green-600' : 'text-amber-600'}>
                      {p.attendance_rate}%
                    </span>
                  </TableCell>
                  <TableCell>{p.submissions}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────
export default function AdminSubGroupDetailPage() {
  const { groupId, subGroupId } = useParams<{ groupId: string; subGroupId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editName, setEditName] = useState('');

  const { data: groupData } = useQuery({
    queryKey: ['group', groupId],
    queryFn: () => groupsApi.get(groupId!),
    enabled: !!groupId,
    staleTime: 60_000,
  });

  const { data: sgData, isLoading, isError, refetch } = useQuery({
    queryKey: ['sub-group', groupId, subGroupId],
    queryFn: () => groupsApi.getSubGroup(groupId!, subGroupId!),
    enabled: !!groupId && !!subGroupId,
    staleTime: 0,
  });

  const deleteMutation = useMutation({
    mutationFn: () => groupsApi.deleteSubGroup(groupId!, subGroupId!),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['sub-groups', groupId] });
      toast.success('Sub-group deleted.');
      navigate(`/admin/groups/${groupId}`);
    },
    onError: () => toast.error('Failed to delete sub-group.'),
  });

  const renameMutation = useMutation({
    mutationFn: (name: string) => groupsApi.updateSubGroup(groupId!, subGroupId!, { name }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['sub-group', groupId, subGroupId] });
      void queryClient.invalidateQueries({ queryKey: ['sub-groups', groupId] });
      toast.success('Sub-group renamed.');
      setEditOpen(false);
    },
    onError: () => toast.error('Failed to rename sub-group.'),
  });

  const groupName = groupData?.data?.name ?? 'Group';
  const sg = sgData?.data;

  if (isLoading) return <Skeleton />;
  if (isError || !sg) return (
    <div className="space-y-4">
      <Link to={`/admin/groups/${groupId}`}
        className="inline-flex items-center gap-1.5 text-sm text-[#5A7A9A] hover:text-[#00285A] transition-colors">
        <ArrowLeft className="h-4 w-4" /> Back to {groupName}
      </Link>
      <ErrorState title="Sub-group not found" onRetry={() => void refetch()} />
    </div>
  );

  return (
    <div className="space-y-6">

      {/* Back link */}
      <Link
        to={`/admin/groups/${groupId}`}
        className="inline-flex items-center gap-1.5 text-sm text-[#5A7A9A] hover:text-[#00285A] transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to {groupName}
      </Link>

      {/* Header card */}
      <div className="bg-white rounded-2xl border border-violet-100 shadow-sm overflow-hidden">
        <div
          className="relative px-6 py-5 overflow-hidden"
          style={{ background: 'linear-gradient(135deg, #5b21b6 0%, #7c3aed 50%, #9333ea 100%)' }}
        >
          <div className="absolute -top-6 -right-6 w-32 h-32 rounded-full bg-white/8 pointer-events-none" />
          <div className="absolute -bottom-4 -right-16 w-24 h-24 rounded-full bg-white/5 pointer-events-none" />
          <div className="relative flex items-start justify-between gap-4 flex-wrap">
            <div className="space-y-1.5">
              <p className="text-xs font-semibold text-violet-200 uppercase tracking-widest">Sub-Group</p>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-white leading-snug">{sg.name}</h1>
                <button
                  onClick={() => { setEditName(sg.name); setEditOpen(true); }}
                  className="p-1 rounded hover:bg-white/20 text-violet-200 hover:text-white transition-colors"
                  aria-label="Rename sub-group"
                >
                  <Pencil className="h-4 w-4" />
                </button>
              </div>
              <p className="text-sm text-violet-200">{groupName}</p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/20 text-white text-sm font-semibold border border-white/25">
                <Users className="h-3.5 w-3.5" />
                {sg.participants_count} member{sg.participants_count !== 1 ? 's' : ''}
              </span>
              <Button
                size="sm"
                variant="outline"
                className="border-white/30 text-white hover:bg-white/15 hover:text-white bg-transparent"
                onClick={() => setDeleteOpen(true)}
              >
                <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                Delete Sub-Group
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="participants" className="w-full">
        <TabsList className="flex-wrap h-auto gap-1 p-1.5 rounded-xl border border-violet-100 bg-violet-50/60">
          <TabsTrigger value="participants" className={TRIGGER}>
            Participants ({sg.participants_count})
          </TabsTrigger>
          <TabsTrigger value="analytics" className={TRIGGER}>
            Analytics
          </TabsTrigger>
        </TabsList>

        <TabsContent value="participants" className="mt-4">
          <ParticipantsPanel participants={sg.participants} />
        </TabsContent>

        <TabsContent value="analytics" className="mt-4">
          <AnalyticsPanel groupId={groupId!} subGroupId={subGroupId!} />
        </TabsContent>
      </Tabs>

      {/* Rename dialog */}
      <Dialog open={editOpen} onOpenChange={open => { if (!open) setEditOpen(false); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Rename Sub-Group</DialogTitle>
            <DialogDescription>Enter a new name for this sub-group.</DialogDescription>
          </DialogHeader>
          <Input
            value={editName}
            onChange={e => setEditName(e.target.value)}
            placeholder="Sub-group name"
            maxLength={200}
            onKeyDown={e => {
              if (e.key === 'Enter' && editName.trim() && editName.trim() !== sg.name) {
                renameMutation.mutate(editName.trim());
              }
            }}
          />
          <DialogFooter className="gap-2 mt-2">
            <Button variant="outline" onClick={() => setEditOpen(false)} disabled={renameMutation.isPending}>
              Cancel
            </Button>
            <Button
              disabled={!editName.trim() || editName.trim() === sg.name || renameMutation.isPending}
              onClick={() => renameMutation.mutate(editName.trim())}
            >
              {renameMutation.isPending ? 'Saving…' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm dialog */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <div className="flex items-center gap-3 mb-1">
              <div className="flex items-center justify-center w-10 h-10 rounded-full bg-rose-100 shrink-0">
                <AlertTriangle className="h-5 w-5 text-rose-600" />
              </div>
              <DialogTitle>Delete Sub-Group?</DialogTitle>
            </div>
            <DialogDescription>
              Delete <span className="font-semibold">"{sg.name}"</span>?
              Participants remain in the parent group. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>Cancel</Button>
            <Button variant="destructive" disabled={deleteMutation.isPending}
              onClick={() => deleteMutation.mutate()}>
              {deleteMutation.isPending ? 'Deleting…' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}
