import { X, SlidersHorizontal } from 'lucide-react';

const DOC_TYPE_LABELS: Record<string, string> = {
  SLIDES: 'Slides', TEMPLATE: 'Template', QUIZ: 'Quiz', GUIDE: 'Guide',
  REFERENCE: 'Reference', CASE_STUDY: 'Case Study', SCHEDULE: 'Schedule',
  REPORT: 'Report', SHARED: 'Shared', OTHER: 'Other',
};

const DOC_TYPE_COLORS: Record<string, string> = {
  SLIDES:     'bg-blue-50 text-[#0052A5] border-blue-200',
  GUIDE:      'bg-violet-50 text-violet-700 border-violet-200',
  REPORT:     'bg-rose-50   text-rose-700   border-rose-200',
  TEMPLATE:   'bg-teal-50   text-teal-700   border-teal-200',
  REFERENCE:  'bg-amber-50  text-amber-700  border-amber-200',
  CASE_STUDY: 'bg-orange-50 text-orange-700 border-orange-200',
  QUIZ:       'bg-emerald-50 text-emerald-700 border-emerald-200',
  SCHEDULE:   'bg-sky-50    text-sky-700    border-sky-200',
};

interface DocumentFiltersProps {
  groups: Array<{ id: string; name: string }>;
  docTypes: string[];
  selectedGroup: string;
  selectedDocType: string;
  onGroupChange: (id: string) => void;
  onDocTypeChange: (type: string) => void;
  onReset: () => void;
}

export function DocumentFilters({
  groups, docTypes, selectedGroup, selectedDocType,
  onGroupChange, onDocTypeChange, onReset,
}: DocumentFiltersProps) {
  const hasFilter = selectedGroup !== '' || selectedDocType !== '';

  return (
    <aside className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3.5 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="h-4 w-4 text-violet-500" />
          <span className="text-sm font-semibold text-slate-900">Filters</span>
        </div>
        {hasFilter && (
          <button
            onClick={onReset}
            className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-700 transition-colors"
          >
            <X className="h-3 w-3" />
            Reset
          </button>
        )}
      </div>

      <div className="p-4 space-y-5">
        {/* Group filter */}
        {groups.length > 1 && (
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-2">Group</p>
            <div className="space-y-0.5">
              <button
                onClick={() => onGroupChange('')}
                className={`w-full text-left text-sm rounded-lg px-3 py-2 transition-colors font-medium ${
                  selectedGroup === ''
                    ? 'bg-violet-100 text-violet-700'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                All Groups
              </button>
              {groups.map(g => (
                <button
                  key={g.id}
                  onClick={() => onGroupChange(g.id)}
                  className={`w-full text-left text-sm rounded-lg px-3 py-2 transition-colors ${
                    selectedGroup === g.id
                      ? 'bg-violet-100 text-violet-700 font-medium'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {g.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Doc type filter */}
        {docTypes.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-2">Type</p>
            <div className="flex flex-wrap gap-1.5">
              <button
                onClick={() => onDocTypeChange('')}
                className={`text-xs font-semibold px-2.5 py-1 rounded-full border transition-colors ${
                  selectedDocType === ''
                    ? 'bg-[#E31837] text-white border-violet-600'
                    : 'bg-slate-50 text-slate-600 border-slate-200 hover:border-violet-300 hover:bg-violet-50 hover:text-violet-700'
                }`}
              >
                All
              </button>
              {docTypes.map(type => (
                <button
                  key={type}
                  onClick={() => onDocTypeChange(type)}
                  className={`text-xs font-semibold px-2.5 py-1 rounded-full border transition-colors ${
                    selectedDocType === type
                      ? 'bg-[#E31837] text-white border-violet-600'
                      : `${DOC_TYPE_COLORS[type] ?? 'bg-slate-50 text-slate-600 border-slate-200'} hover:opacity-80`
                  }`}
                >
                  {DOC_TYPE_LABELS[type] ?? type}
                </button>
              ))}
            </div>
          </div>
        )}

        {groups.length <= 1 && docTypes.length === 0 && (
          <p className="text-xs text-slate-400 text-center py-2">No filters available yet.</p>
        )}
      </div>
    </aside>
  );
}
