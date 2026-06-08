import { FileText } from 'lucide-react';
import { DocumentCard } from './DocumentCard';
import type { Document } from '@/lib/types';

interface DocumentListProps {
  documents: Document[];
  groupMap: Map<string, string>;
  isFiltered: boolean;
  onReset?: () => void;
}

export function DocumentList({ documents, groupMap, isFiltered, onReset }: DocumentListProps) {
  if (documents.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <FileText className="h-12 w-12 text-slate-200 mb-4" />
        {isFiltered ? (
          <>
            <p className="text-slate-500 font-medium">No documents match your filters.</p>
            {onReset && (
              <button
                onClick={onReset}
                className="mt-2 text-sm text-[#0052A5] hover:underline"
              >
                Reset filters
              </button>
            )}
          </>
        ) : (
          <p className="text-slate-500 font-medium">No documents available yet.</p>
        )}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
      {documents.map(doc => (
        <DocumentCard
          key={doc.id}
          doc={doc}
          groupName={groupMap.get(doc.group_id)}
        />
      ))}
    </div>
  );
}
