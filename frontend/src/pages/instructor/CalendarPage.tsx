import { CalendarDays } from 'lucide-react';
import { InstructorCalendar } from '@/features/instructor/calendar/InstructorCalendar';

export default function InstructorCalendarPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-blue-100">
          <CalendarDays className="h-5 w-5 text-[#0052A5]" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-slate-900 leading-tight">Calendar</h1>
          <p className="text-sm text-slate-500">View all your scheduled classes.</p>
        </div>
      </div>
      <InstructorCalendar />
    </div>
  );
}
