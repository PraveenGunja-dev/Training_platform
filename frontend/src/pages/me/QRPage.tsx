import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, QrCode, CalendarDays, Clock } from 'lucide-react';
import { classesApi } from '@/api/classes';
import { formatDate } from '@/lib/dates';

export default function QRPage() {
  const { classId } = useParams<{ classId: string }>();

  const { data, isLoading, isError } = useQuery({
    queryKey: ['class', classId],
    queryFn: () => classesApi.get(classId!),
    enabled: !!classId,
    staleTime: 0,
  });

  const cls = data?.data;
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(
    `${window.location.origin}/me/classes/${classId}`,
  )}`;

  return (
    <div className="space-y-6">
      <Link
        to="/me/notifications"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Notifications
      </Link>

      <div className="flex flex-col items-center gap-6 py-4">
        {/* Header */}
        <div className="text-center">
          <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-teal-50 mx-auto mb-3">
            <QrCode className="h-7 w-7 text-teal-600" />
          </div>
          <h1 className="text-xl font-bold text-[#00285A]">Late Attendance QR</h1>
          <p className="text-sm text-slate-500 mt-1">Scan this code to mark your late attendance</p>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-10">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#0052A5]" />
          </div>
        ) : isError ? (
          <p className="text-sm text-rose-500">Unable to load class details.</p>
        ) : (
          <>
            {/* QR code */}
            <div className="rounded-2xl border-2 border-[#C5D8EC] p-5 bg-white shadow-sm">
              <img
                src={qrUrl}
                alt="Late Attendance QR Code"
                width={240}
                height={240}
                className="rounded-xl block"
              />
            </div>

            {/* Class info */}
            {cls && (
              <div className="w-full max-w-xs rounded-xl border border-[#C5D8EC] bg-white divide-y divide-slate-100 shadow-sm overflow-hidden">
                <div className="px-4 py-3 bg-gradient-to-r from-[#0052A5] to-[#E31837]">
                  <p className="text-white font-bold text-sm leading-snug line-clamp-2">{cls.title}</p>
                  <p className="text-white/70 text-xs mt-0.5">{cls.group_name}</p>
                </div>
                <div className="px-4 py-2.5 flex items-center gap-2 text-xs text-slate-500">
                  <CalendarDays className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />
                  <span className="font-medium text-slate-700">{formatDate(cls.starts_at, 'EEE, dd MMM yyyy')}</span>
                </div>
                <div className="px-4 py-2.5 flex items-center gap-2 text-xs text-slate-500">
                  <Clock className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />
                  <span>{formatDate(cls.starts_at, 'h:mm a')} – {formatDate(cls.ends_at, 'h:mm a')}</span>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
