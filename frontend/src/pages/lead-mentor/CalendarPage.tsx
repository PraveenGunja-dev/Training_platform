import { CalendarDays } from 'lucide-react';
import { LeadMentorCalendar } from '@/features/lead-mentor/calendar/LeadMentorCalendar';

export default function LeadMentorCalendarPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-teal-50 flex-shrink-0">
          <CalendarDays className="h-5 w-5 text-teal-600" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-[#00285A] leading-tight">Calendar</h1>
          <p className="text-sm text-slate-500">View all scheduled classes for your group</p>
        </div>
      </div>
      <LeadMentorCalendar />
    </div>
  );
}
