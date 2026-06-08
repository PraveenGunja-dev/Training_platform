import * as XLSX from 'xlsx';
import type { AttendanceSession, ReportRow } from '@/lib/types';

export function exportAttendanceReport(
  session: AttendanceSession,
  records: ReportRow[],
  summary: { total: number; present: number; absent: number },
) {
  const wb = XLSX.utils.book_new();

  // ── Section 1: session metadata ──────────────────────────────
  const metaRows = [
    ['Attendance Report'],
    [],
    ['Class',      session.class_title],
    ['Session ID', session.id],
    ['Status',     session.status],
    ['Started at', new Date(session.started_at).toLocaleString()],
    ['Ended at',   session.ended_at ? new Date(session.ended_at).toLocaleString() : 'Still active'],
    ['Started by', session.started_by.full_name],
    ['Ended by',   session.ended_by ? session.ended_by.full_name : '—'],
    [],
    ['Summary'],
    ['Total',   summary.total],
    ['Present', summary.present],
    ['Absent',  summary.absent],
    ['Attendance Rate', summary.total > 0
      ? `${Math.round((summary.present / summary.total) * 100)}%`
      : '0%'],
    [],
    ['#', 'Full Name', 'Email', 'Status', 'Marked At'],
  ];

  const dataRows = records.map((r, i) => [
    i + 1,
    r.user.full_name,
    r.user.email,
    r.status,
    r.marked_at ? new Date(r.marked_at).toLocaleString() : '—',
  ]);

  const ws = XLSX.utils.aoa_to_sheet([...metaRows, ...dataRows]);

  // Column widths
  ws['!cols'] = [
    { wch: 4 },   // #
    { wch: 28 },  // Full Name
    { wch: 32 },  // Email
    { wch: 12 },  // Status
    { wch: 22 },  // Marked At
  ];

  XLSX.utils.book_append_sheet(wb, ws, 'Attendance Report');

  // ── File name ────────────────────────────────────────────────
  const dateStr = new Date(session.started_at)
    .toLocaleDateString('en-GB')
    .replace(/\//g, '-');
  const safeName = session.class_title.replace(/[^a-zA-Z0-9 _-]/g, '').trim();
  const fileName = `Attendance_${safeName}_${dateStr}.xlsx`;

  XLSX.writeFile(wb, fileName);
}
