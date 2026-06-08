import { useNavigate } from 'react-router-dom';
import { FileText, BookOpen, Presentation, ClipboardList, BookMarked, FileBarChart2 } from 'lucide-react';
import type { Document } from '@/lib/types';

function docConfig(docType: string): { label: string; bg: string; text: string; Icon: React.ElementType } {
  const map: Record<string, { label: string; bg: string; text: string; Icon: React.ElementType }> = {
    SLIDES:     { label: 'Slides',      bg: 'bg-blue-50',  text: 'text-[#0052A5]',  Icon: Presentation    },
    TEMPLATE:   { label: 'Template',    bg: 'bg-amber-50',   text: 'text-amber-600',   Icon: ClipboardList   },
    QUIZ:       { label: 'Quiz',        bg: 'bg-rose-50',    text: 'text-rose-600',    Icon: BookOpen        },
    GUIDE:      { label: 'Guide',       bg: 'bg-emerald-50', text: 'text-emerald-600', Icon: BookMarked      },
    REFERENCE:  { label: 'Reference',   bg: 'bg-cyan-50',    text: 'text-cyan-600',    Icon: BookMarked      },
    REPORT:     { label: 'Report',      bg: 'bg-violet-50',  text: 'text-[#E31837]',  Icon: FileBarChart2   },
    SCHEDULE:   { label: 'Schedule',    bg: 'bg-sky-50',     text: 'text-sky-600',     Icon: FileText        },
    CASE_STUDY: { label: 'Case Study',  bg: 'bg-orange-50',  text: 'text-orange-600',  Icon: FileBarChart2   },
  };
  return map[docType] ?? { label: docType, bg: 'bg-[#EBF3FB]', text: 'text-[#4F46E5]', Icon: FileText };
}

export function LatestDocumentsCard({ docs }: { docs: Document[] }) {
  const navigate = useNavigate();

  return (
    <div className="bg-white rounded-2xl border border-[#C5D8EC] shadow-card overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2.5 px-5 py-4 border-b border-[#EBF3FB]">
        <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-cyan-50 text-cyan-600">
          <FileText className="h-3.5 w-3.5" />
        </div>
        <div>
          <p className="text-sm font-semibold text-[#00285A] leading-tight">Latest Documents</p>
          <p className="text-xs text-[#5A7A9A]">Shared with your group</p>
        </div>
      </div>

      {/* Body */}
      <div className="px-4 py-3">
        {docs.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-6 text-center">
            <FileText className="h-7 w-7 text-[#C5D8EC]" />
            <p className="text-sm font-medium text-[#00285A]">No documents yet</p>
            <p className="text-xs text-[#5A7A9A]">Documents shared with your group will appear here.</p>
          </div>
        ) : (
          <div className="space-y-1.5">
            {docs.slice(0, 4).map(doc => {
              const cfg = docConfig(doc.doc_type);
              const Icon = cfg.Icon;
              return (
                <button
                  key={doc.id}
                  type="button"
                  onClick={() => navigate('/me/documents')}
                  className="flex items-center gap-3 w-full text-left py-2 px-2.5 rounded-lg hover:bg-[#EBF3FB] transition-colors group"
                >
                  <div className={`flex-shrink-0 flex items-center justify-center w-7 h-7 rounded-lg ${cfg.bg}`}>
                    <Icon className={`h-3.5 w-3.5 ${cfg.text}`} />
                  </div>
                  <span className="text-sm text-[#00285A] truncate font-medium flex-1 leading-tight">
                    {doc.title}
                  </span>
                  <span className={`flex-shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full ${cfg.bg} ${cfg.text}`}>
                    {cfg.label}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
