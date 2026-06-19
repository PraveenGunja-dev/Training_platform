import { useQuery } from '@tanstack/react-query';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { ParticipantsTab } from './tabs/ParticipantsTab';
import { SubGroupsTab } from './tabs/SubGroupsTab';
import { ClassesTab } from './tabs/ClassesTab';
import { AssignmentsTab } from './tabs/AssignmentsTab';
import { DocumentsTab } from './tabs/DocumentsTab';
import { AnalyticsTab } from './tabs/AnalyticsTab';
import { groupsApi } from '@/api/groups';
import { assignmentsApi } from '@/api/assignments';
import { documentsApi } from '@/api/documents';
import type { GroupDetail } from '@/lib/types';

const TRIGGER = "rounded-lg text-sm font-semibold text-slate-500 data-[state=active]:bg-white data-[state=active]:text-[#0052A5] data-[state=active]:shadow-sm data-[state=active]:border data-[state=active]:border-[#D6E8F8]";

export function GroupTabs({ group }: { group: GroupDetail }) {
  const { data: sgCount } = useQuery({
    queryKey: ['sub-groups', group.id],
    queryFn: () => groupsApi.listSubGroups(group.id),
    staleTime: 30_000,
    select: d => d.data.length,
  });

  const { data: assignCount } = useQuery({
    queryKey: ['assignments', 'group', group.id],
    queryFn: () => assignmentsApi.list({ group_id: group.id }),
    staleTime: 30_000,
    select: d => d.data.length,
  });

  const { data: docCount } = useQuery({
    queryKey: ['documents', 'group', group.id],
    queryFn: () => documentsApi.list({ group_id: group.id }),
    staleTime: 0,
    select: d => d.data.length,
  });

  return (
    <Tabs defaultValue="participants" className="w-full">
      <TabsList className="flex-wrap h-auto gap-1 p-1.5 rounded-xl border border-[#D6E8F8] bg-[#EBF3FB]/60">
        <TabsTrigger value="participants" className={TRIGGER}>
          Participants ({group.participants_count})
        </TabsTrigger>
        <TabsTrigger value="sub-groups" className={TRIGGER}>
          Sub-Groups{sgCount !== undefined ? ` (${sgCount})` : ''}
        </TabsTrigger>
        <TabsTrigger value="classes" className={TRIGGER}>Classes</TabsTrigger>
        <TabsTrigger value="assignments" className={TRIGGER}>
          Assignments{assignCount !== undefined ? ` (${assignCount})` : ''}
        </TabsTrigger>
        <TabsTrigger value="documents" className={TRIGGER}>
          Documents{docCount !== undefined ? ` (${docCount})` : ''}
        </TabsTrigger>
        <TabsTrigger value="analytics" className={TRIGGER}>Analytics</TabsTrigger>
      </TabsList>

      <TabsContent value="participants">
        <ParticipantsTab groupId={group.id} participants={group.participants} />
      </TabsContent>
      <TabsContent value="sub-groups">
        <SubGroupsTab groupId={group.id} groupParticipants={group.participants} />
      </TabsContent>
      <TabsContent value="classes">
        <ClassesTab groupId={group.id} group={group} />
      </TabsContent>
      <TabsContent value="assignments">
        <AssignmentsTab groupId={group.id} group={group} />
      </TabsContent>
      <TabsContent value="documents">
        <DocumentsTab groupId={group.id} />
      </TabsContent>
      <TabsContent value="analytics">
        <AnalyticsTab groupId={group.id} />
      </TabsContent>
    </Tabs>
  );
}
