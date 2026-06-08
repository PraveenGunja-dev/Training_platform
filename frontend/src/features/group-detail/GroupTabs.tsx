import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { ParticipantsTab } from './tabs/ParticipantsTab';
import { ClassesTab } from './tabs/ClassesTab';
import { AssignmentsTab } from './tabs/AssignmentsTab';
import { DocumentsTab } from './tabs/DocumentsTab';
import { AnalyticsTab } from './tabs/AnalyticsTab';
import type { GroupDetail } from '@/lib/types';

const TRIGGER = "rounded-lg text-sm font-semibold text-slate-500 data-[state=active]:bg-white data-[state=active]:text-[#0052A5] data-[state=active]:shadow-sm data-[state=active]:border data-[state=active]:border-[#D6E8F8]";

export function GroupTabs({ group }: { group: GroupDetail }) {
  return (
    <Tabs defaultValue="participants" className="w-full">
      <TabsList className="flex-wrap h-auto gap-1 p-1.5 rounded-xl border border-[#D6E8F8] bg-[#EBF3FB]/60">
        <TabsTrigger value="participants" className={TRIGGER}>
          Participants ({group.participants_count})
        </TabsTrigger>
        <TabsTrigger value="classes"     className={TRIGGER}>Classes</TabsTrigger>
        <TabsTrigger value="assignments" className={TRIGGER}>Assignments</TabsTrigger>
        <TabsTrigger value="documents"   className={TRIGGER}>Documents</TabsTrigger>
        <TabsTrigger value="analytics"   className={TRIGGER}>Analytics</TabsTrigger>
      </TabsList>

      <TabsContent value="participants">
        <ParticipantsTab groupId={group.id} participants={group.participants} />
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
