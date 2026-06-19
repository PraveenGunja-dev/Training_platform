import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, UserCircle } from 'lucide-react';
import { useAuthStore } from '@/store/auth';
import { groupsApi } from '@/api/groups';
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from '@/components/ui/table';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { ErrorState } from '@/components/states/ErrorState';

function Skeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="h-4 w-32 bg-teal-100 rounded" />
      <div className="h-28 bg-teal-100 rounded-2xl" />
      <div className="h-48 bg-white rounded-2xl border border-teal-100" />
    </div>
  );
}

export default function GroupAdminSubGroupDetailPage() {
  const { subGroupId } = useParams<{ subGroupId: string }>();
  const { user } = useAuthStore();
  const groupIds = user?.admin_of_group_ids ?? [];
  const [selectedGroupId, setSelectedGroupId] = useState<string>(groupIds[0] ?? '');

  const { data: groupData } = useQuery({
    queryKey: ['group', selectedGroupId],
    queryFn: () => groupsApi.get(selectedGroupId!),
    enabled: !!selectedGroupId,
    staleTime: 60_000,
  });

  const { data: sgData, isLoading, isError, refetch } = useQuery({
    queryKey: ['sub-group', selectedGroupId, subGroupId],
    queryFn: () => groupsApi.getSubGroup(selectedGroupId!, subGroupId!),
    enabled: !!selectedGroupId && !!subGroupId,
    staleTime: 0,
  });

  const groupName = groupData?.data?.name ?? 'Group';
  const sg = sgData?.data;

  if (groupIds.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-slate-500">
        <p className="text-sm">You are not assigned as admin for any group.</p>
        <p className="text-xs mt-1 text-slate-400">Contact a Super Admin to get access.</p>
      </div>
    );
  }

  if (isLoading) return <Skeleton />;

  if (isError || !sg) {
    return (
      <div className="space-y-4">
        <Link
          to="/group-admin/dashboard"
          className="inline-flex items-center gap-1.5 text-sm text-teal-600 hover:text-teal-800 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Dashboard
        </Link>
        <ErrorState title="Sub-group not found" onRetry={() => void refetch()} />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {groupIds.length > 1 && (
        <div className="mb-4">
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
        </div>
      )}

      {/* Back link */}
      <Link
        to="/group-admin/dashboard"
        className="inline-flex items-center gap-1.5 text-sm text-teal-600 hover:text-teal-800 transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Dashboard
      </Link>

      {/* Header card */}
      <div className="bg-white rounded-2xl border border-teal-100 shadow-sm overflow-hidden">
        <div
          className="relative px-6 py-5 overflow-hidden"
          style={{ background: 'linear-gradient(135deg, #0f766e 0%, #0d9488 50%, #14b8a6 100%)' }}
        >
          <div className="absolute -top-6 -right-6 w-32 h-32 rounded-full bg-white/8 pointer-events-none" />
          <div className="absolute -bottom-4 -right-16 w-24 h-24 rounded-full bg-white/5 pointer-events-none" />
          <div className="relative space-y-1.5">
            <p className="text-xs font-semibold text-teal-200 uppercase tracking-widest">Sub-Group</p>
            <h1 className="text-xl font-bold text-white">{sg.name}</h1>
            <p className="text-sm text-teal-200">{groupName}</p>
          </div>
          <div className="mt-3">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/20 text-white text-sm font-semibold border border-white/25">
              <UserCircle className="h-3.5 w-3.5" />
              {sg.participants_count} member{sg.participants_count !== 1 ? 's' : ''}
            </span>
          </div>
        </div>
      </div>

      {/* Participants table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="h-1 bg-gradient-to-r from-teal-500 to-teal-300" />
        <div className="p-4 border-b border-slate-100">
          <h2 className="font-semibold text-slate-800">Participants</h2>
        </div>
        {sg.participants.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-14">
            <UserCircle className="h-10 w-10 text-teal-200 mb-2" />
            <p className="text-sm text-slate-500">No participants in this sub-group.</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>#</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sg.participants.map((p, i) => (
                <TableRow key={p.id}>
                  <TableCell className="text-slate-400 text-xs w-10">{i + 1}</TableCell>
                  <TableCell className="font-medium text-slate-800">{p.full_name}</TableCell>
                  <TableCell className="text-slate-500 text-sm">{p.email}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
