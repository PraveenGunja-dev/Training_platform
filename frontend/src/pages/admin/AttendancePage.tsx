import { CheckSquare } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { SessionsTable } from '@/features/admin/attendance/SessionsTable';

export default function AdminAttendancePage() {
  return (
    <div className="space-y-6">

      {/* ── Page header ──────────────────────────────────────────────── */}
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-teal-100 flex-shrink-0">
          <CheckSquare className="h-5 w-5 text-teal-600" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-slate-900 leading-tight">Attendance</h1>
          <p className="text-sm text-slate-500">Start and end attendance sessions for any ongoing class.</p>
        </div>
      </div>

      {/* ── Tabs container ───────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {/* Teal accent bar */}
        <div className="h-1.5 bg-gradient-to-r from-teal-500 to-emerald-500" />

        <div className="p-6">
          <Tabs defaultValue="active">
            <TabsList className="mb-6 bg-slate-100 p-1 rounded-xl">
              <TabsTrigger
                value="active"
                className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-teal-700 font-medium"
              >
                Active Sessions
              </TabsTrigger>
              <TabsTrigger
                value="past"
                className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-slate-700 font-medium"
              >
                Past Sessions
              </TabsTrigger>
            </TabsList>
            <TabsContent value="active">
              <SessionsTable filter="ACTIVE" />
            </TabsContent>
            <TabsContent value="past">
              <SessionsTable filter="ENDED" />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
