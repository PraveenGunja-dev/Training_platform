import { Input } from '@/components/ui/input';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { AUDIT_ACTION_OPTIONS } from './auditActionLabels';
import type { User } from '@/lib/types';

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
  users: Pick<User, 'id' | 'full_name' | 'email'>[];
}

const TARGET_TYPES = [
  'User', 'ClassGroup', 'ClassSession', 'AssignmentTask',
  'AttendanceRecord', 'ParticipantSharedDoc', 'Document', 'GroupManager',
];

export function AuditFilters({ filters, onChange, users }: AuditFiltersProps) {
  const set = (key: keyof AuditFilterValues, value: string) =>
    onChange({ ...filters, [key]: value });

  const reset = () =>
    onChange({ actorId: '', action: '', targetType: '', from: '', to: '' });

  const hasFilters = Object.values(filters).some(Boolean);

  return (
    <div className="flex flex-wrap gap-3 items-end">
      <div className="space-y-1">
        <p className="text-xs text-muted-foreground font-medium">Actor</p>
        <Select value={filters.actorId || '__all'} onValueChange={v => set('actorId', v === '__all' ? '' : v)}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="All actors" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all">All actors</SelectItem>
            {users.map(u => (
              <SelectItem key={u.id} value={u.id}>
                {u.full_name || u.email}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

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
