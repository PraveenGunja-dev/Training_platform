import { CalendarDays } from 'lucide-react';
import { AdminCalendar } from '@/features/admin/calendar/AdminCalendar';

export default function AdminCalendarPage() {
  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl border border-[#D6E8F8] overflow-hidden shadow-sm">
        <div className="h-1 bg-gradient-to-r from-[#0052A5] to-[#E31837]" />
        <div className="px-5 py-4 flex items-center gap-4">
          <div
            className="flex items-center justify-center w-12 h-12 rounded-xl flex-shrink-0"
            style={{ background: 'linear-gradient(135deg, #EBF3FB 0%, #fce8eb 100%)', border: '1px solid #D6E8F8' }}
          >
            <CalendarDays className="h-6 w-6 text-[#0052A5]" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-[#00285A] leading-tight">Calendar</h1>
            <p className="text-sm text-slate-500">View all scheduled classes across every group</p>
          </div>
        </div>
      </div>

      <AdminCalendar />
    </div>
  );
}
