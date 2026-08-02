import { useState, useRef, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronsUpDown, X } from 'lucide-react';
import { usersApi } from '@/api/users';
import { useDebounce } from '@/hooks/useDebounce';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Popover, PopoverContent, PopoverTrigger,
} from '@/components/ui/popover';
import { AUDIT_ACTION_OPTIONS } from './auditActionLabels';

export interface AuditFilterValues {
  actorId: string;
  action: string;
  targetType: string;
  from: string;
  to: string;
}

interface AuditFiltersProps {
  filters: AuditFilterValues;
  onChange: (filters: AuditFilterValues) => void;
}

const TARGET_TYPES = [
  'User',
  'ClassGroup',
  'Class',
  'AssignmentTask',
  'AttendanceRecord',
  'AttendanceSession',
  'ParticipantSharedDoc',
  'Document',
  'Submission',
  'SubmissionReview',
  'SystemSettings',
  'ParticipantUploadPermission',
];

export function AuditFilters({ filters, onChange }: AuditFiltersProps) {
  const set = (key: keyof AuditFilterValues, value: string) =>
    onChange({ ...filters, [key]: value });

  const reset = () =>
    onChange({ actorId: '', action: '', targetType: '', from: '', to: '' });

  const hasFilters = Object.values(filters).some(Boolean);

  // ── Actor combobox state ────────────────────────────────────────────
  const [actorOpen, setActorOpen] = useState(false);
  const [actorSearch, setActorSearch] = useState('');
  const [actorLabel, setActorLabel] = useState('');
  const debouncedSearch = useDebounce(actorSearch, 300);
  const inputRef = useRef<HTMLInputElement>(null);

  const { data: actorResults, isFetching: actorFetching } = useQuery({
    queryKey: ['audit-actor-search', debouncedSearch],
    queryFn: () => usersApi.list({ search: debouncedSearch || undefined, page_size: 20 }),
    enabled: actorOpen,
  });
  const actorOptions = actorResults?.data ?? [];

  useEffect(() => {
    if (actorOpen) {
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [actorOpen]);

  const selectActor = (id: string, label: string) => {
    set('actorId', id);
    setActorLabel(label);
    setActorSearch('');
    setActorOpen(false);
  };

  const clearActor = (e: React.MouseEvent) => {
    e.stopPropagation();
    set('actorId', '');
    setActorLabel('');
    setActorSearch('');
  };
  // ───────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-wrap gap-3 items-end">

      {/* Actor combobox */}
      <div className="space-y-1">
        <p className="text-xs text-muted-foreground font-medium">Actor</p>
        <Popover open={actorOpen} onOpenChange={setActorOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              role="combobox"
              aria-expanded={actorOpen}
              className="w-48 justify-between font-normal"
            >
              <span className="truncate">
                {filters.actorId ? actorLabel || 'Selected actor' : 'All actors'}
              </span>
              <span className="flex items-center gap-1 ml-1 shrink-0">
                {filters.actorId && (
                  <X
                    className="h-3 w-3 text-slate-400 hover:text-slate-600"
                    onClick={clearActor}
                  />
                )}
                <ChevronsUpDown className="h-3.5 w-3.5 text-slate-400" />
              </span>
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-72 p-2" align="start">
            <Input
              ref={inputRef}
              placeholder="Search by name or email…"
              value={actorSearch}
              onChange={e => setActorSearch(e.target.value)}
              className="mb-2 h-8 text-sm"
            />
            <div className="max-h-52 overflow-y-auto space-y-0.5">
              <button
                type="button"
                className="w-full text-left px-2 py-1.5 rounded text-sm hover:bg-slate-100 text-slate-500"
                onClick={() => selectActor('', '')}
              >
                All actors
              </button>
              {actorFetching && (
                <p className="text-xs text-slate-400 px-2 py-1">Searching…</p>
              )}
              {!actorFetching && actorOptions.length === 0 && debouncedSearch && (
                <p className="text-xs text-slate-400 px-2 py-1">No users found.</p>
              )}
              {actorOptions.map(u => (
                <button
                  key={u.id}
                  type="button"
                  className="w-full text-left px-2 py-1.5 rounded text-sm hover:bg-slate-100"
                  onClick={() => selectActor(u.id, u.full_name || u.email)}
                >
                  <span className="font-medium">{u.full_name || '(no name)'}</span>
                  <span className="text-slate-400 ml-1 text-xs">{u.email}</span>
                </button>
              ))}
            </div>
          </PopoverContent>
        </Popover>
      </div>

      {/* Action */}
      <div className="space-y-1">
        <p className="text-xs text-muted-foreground font-medium">Action</p>
        <Select value={filters.action || '__all'} onValueChange={v => set('action', v === '__all' ? '' : v)}>
          <SelectTrigger className="w-52">
            <SelectValue placeholder="All actions" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all">All actions</SelectItem>
            {AUDIT_ACTION_OPTIONS.map(opt => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Target Type */}
      <div className="space-y-1">
        <p className="text-xs text-muted-foreground font-medium">Target Type</p>
        <Select value={filters.targetType || '__all'} onValueChange={v => set('targetType', v === '__all' ? '' : v)}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="All types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all">All types</SelectItem>
            {TARGET_TYPES.map(t => (
              <SelectItem key={t} value={t}>{t}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Date range */}
      <div className="space-y-1">
        <p className="text-xs text-muted-foreground font-medium">From</p>
        <Input
          type="date"
          className="w-36"
          value={filters.from}
          onChange={e => set('from', e.target.value)}
        />
      </div>

      <div className="space-y-1">
        <p className="text-xs text-muted-foreground font-medium">To</p>
        <Input
          type="date"
          className="w-36"
          value={filters.to}
          onChange={e => set('to', e.target.value)}
        />
      </div>

      {hasFilters && (
        <Button variant="outline" size="sm" onClick={reset}>
          Clear
        </Button>
      )}
    </div>
  );
}
