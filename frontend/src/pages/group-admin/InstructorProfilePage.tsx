import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, Mail, GraduationCap, Briefcase, BadgeCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface InstructorData {
  id: string;
  full_name: string;
  email: string;
  employee_code?: string;
  business_unit?: string;
}

interface ProfileState {
  instructor?: InstructorData;
  groupName?: string;
}

export default function InstructorProfilePage() {
  const { state } = useLocation() as { state: ProfileState | null };
  const navigate = useNavigate();

  const ins = state?.instructor;

  if (!ins) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
        <GraduationCap className="h-12 w-12 text-slate-300" />
        <p className="text-sm text-slate-500">Instructor info not available.</p>
        <Button variant="outline" size="sm" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4 mr-1.5" />
          Go Back
        </Button>
      </div>
    );
  }

  const initials = ins.full_name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(n => n[0].toUpperCase())
    .join('');

  return (
    <div className="space-y-6 max-w-2xl">

      <Button
        variant="ghost"
        size="sm"
        className="text-muted-foreground -ml-1"
        onClick={() => navigate(-1)}
      >
        <ArrowLeft className="h-4 w-4 mr-1.5" />
        Back
      </Button>

      <div className="bg-white rounded-2xl border border-[#C5D8EC] shadow-sm overflow-hidden">
        <div className="h-1.5 bg-gradient-to-r from-teal-500 to-[#0052A5]" />

        <div className="p-6 space-y-6">

          <div className="flex items-start gap-5">
            <div className="w-16 h-16 rounded-full bg-teal-50 border-2 border-teal-100 flex items-center justify-center text-teal-700 text-2xl font-bold shrink-0 select-none">
              {initials || '?'}
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-xl font-bold text-[#00285A] leading-tight">{ins.full_name}</h1>
              <div className="flex items-center gap-1.5 mt-1 text-sm text-slate-500">
                <Mail className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{ins.email}</span>
              </div>
              {(ins.employee_code || ins.business_unit) && (
                <div className="flex flex-wrap gap-3 mt-1.5">
                  {ins.employee_code && (
                    <div className="flex items-center gap-1 text-xs text-slate-500">
                      <BadgeCheck className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                      <span className="font-medium text-slate-600">Emp Code:</span>
                      <span>{ins.employee_code}</span>
                    </div>
                  )}
                  {ins.business_unit && (
                    <div className="flex items-center gap-1 text-xs text-slate-500">
                      <Briefcase className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                      <span className="font-medium text-slate-600">BU:</span>
                      <span>{ins.business_unit}</span>
                    </div>
                  )}
                </div>
              )}
              <div className="flex items-center gap-2 mt-2.5 flex-wrap">
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-teal-100 text-teal-700 border border-teal-200">
                  <GraduationCap className="h-3 w-3" /> Instructor
                </span>
                {state?.groupName && (
                  <span className="text-xs text-slate-500 bg-[#EBF3FB] px-2.5 py-0.5 rounded-full border border-[#D6E8F8]">
                    {state.groupName}
                  </span>
                )}
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
