/* eslint-disable react-refresh/only-export-components */
import { useState, useRef, useCallback } from 'react';
import Papa from 'papaparse';
import { z } from 'zod';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Download, Upload, Plus, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { usersApi } from '@/api/users';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface EditableRow {
  id: string;
  full_name: string;
  email: string;
  role: string;
  checked: boolean;
  errors: { full_name?: string; email?: string; role?: string };
}

interface ImportResult {
  created: number;
  skipped: number;
  failed: number;
}

export interface BulkRegisterDialogProps {
  open: boolean;
  onClose: () => void;
  /** Roles the current user is permitted to assign */
  allowedRoles: string[];
  /** Async fetcher for available groups (called once when step === 3) */
  groupsFetcher: () => Promise<{ id: string; name: string }[]>;
  /** Called after a successful import */
  onSuccess?: () => void;
}

// ---------------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------------

const emailSchema = z.string().email();

function validateRow(
  row: Pick<EditableRow, 'full_name' | 'email' | 'role'>,
  allowedRoles: string[],
): EditableRow['errors'] {
  const errors: EditableRow['errors'] = {};

  if (!row.full_name.trim()) {
    errors.full_name = 'Full name is required';
  }

  if (!row.email.trim()) {
    errors.email = 'Email is required';
  } else if (!emailSchema.safeParse(row.email.trim()).success) {
    errors.email = 'Invalid email format';
  }

  if (!row.role) {
    errors.role = 'Role is required';
  } else if (!allowedRoles.includes(row.role)) {
    errors.role = `Invalid role "${row.role}"`;
  }

  return errors;
}

function isRowValid(errors: EditableRow['errors']): boolean {
  return !errors.full_name && !errors.email && !errors.role;
}

let _idCounter = 0;
function nextId(): string {
  _idCounter += 1;
  return `row-${Date.now()}-${_idCounter}`;
}

// ---------------------------------------------------------------------------
// Role label helper
// ---------------------------------------------------------------------------

function roleLabel(role: string): string {
  switch (role) {
    case 'ADMIN':        return 'Admin';
    case 'LEAD_MENTOR':  return 'Lead Mentor';
    case 'SUB_MENTOR':   return 'Sub-Mentor';
    case 'PARTICIPANT':  return 'Participant';
    default:             return role;
  }
}

// ---------------------------------------------------------------------------
// Step-indicator component
// ---------------------------------------------------------------------------

function StepIndicator({ step }: { step: 1 | 2 | 3 | 4 }) {
  return (
    <div className="flex gap-1.5 mt-3">
      {([1, 2, 3] as const).map(s => (
        <div
          key={s}
          className={`h-1.5 flex-1 rounded-full transition-colors duration-200 ${
            step > s
              ? 'bg-[#0052A5]'
              : step === s
              ? 'bg-[#0052A5]/70'
              : 'bg-white/10'
          }`}
        />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

const MAX_ROWS = 200;

export function BulkRegisterDialog({
  open,
  onClose,
  allowedRoles,
  groupsFetcher,
  onSuccess,
}: BulkRegisterDialogProps) {
  const qc = useQueryClient();

  // ---- step state ----
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);

  // ---- step 1 ----
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ---- step 2 ----
  const [rows, setRows] = useState<EditableRow[]>([]);

  // ---- step 3 ----
  const [selectedGroupId, setSelectedGroupId] = useState<string>('');
  const [isRegistering, setIsRegistering] = useState(false);

  // ---- step 4 ----
  const [importResult, setImportResult] = useState<ImportResult | null>(null);

  // ---- groups query (enabled only on step 3) ----
  const { data: groups = [], isLoading: groupsLoading } = useQuery({
    queryKey: ['bulk-register-groups'],
    queryFn: groupsFetcher,
    enabled: open && step === 3,
    staleTime: 60_000,
  });

  // ---------------------------------------------------------------------------
  // Reset
  // ---------------------------------------------------------------------------

  const resetAll = useCallback(() => {
    setStep(1);
    setCsvFile(null);
    setRows([]);
    setSelectedGroupId('');
    setIsRegistering(false);
    setImportResult(null);
  }, []);

  const handleClose = useCallback(() => {
    resetAll();
    onClose();
  }, [resetAll, onClose]);

  // ---------------------------------------------------------------------------
  // Step 1 — download template / upload file
  // ---------------------------------------------------------------------------

  const downloadTemplate = () => {
    const content =
      'full_name,email,role\n' +
      'Alice Smith,alice@example.com,PARTICIPANT\n' +
      'Bob Jones,bob@example.com,PARTICIPANT\n';
    const blob = new Blob([content], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'register_template.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleFileChange = (file: File | null) => {
    setCsvFile(file);
  };

  const parseCSV = () => {
    if (!csvFile) return;

    Papa.parse<Record<string, string>>(csvFile, {
      header: true,
      skipEmptyLines: true,
      complete: (result) => {
        const parsed = result.data.slice(0, MAX_ROWS).map((rawRow) => {
          const normalized: Record<string, string> = {};
          for (const [k, v] of Object.entries(rawRow)) {
            normalized[k.toLowerCase().trim()] = (v ?? '').trim();
          }

          const full_name = normalized['full_name'] ?? '';
          const email = normalized['email'] ?? '';
          const role = ((normalized['role'] ?? '').toUpperCase() || allowedRoles[0]) ?? '';

          const errors = validateRow({ full_name, email, role }, allowedRoles);
          return {
            id: nextId(),
            full_name,
            email,
            role,
            checked: true,
            errors,
          } satisfies EditableRow;
        });

        setRows(parsed);
        setStep(2);
      },
    });
  };

  // ---------------------------------------------------------------------------
  // Step 2 — inline-edit table
  // ---------------------------------------------------------------------------

  const updateCell = <K extends keyof Pick<EditableRow, 'full_name' | 'email' | 'role'>>(
    id: string,
    field: K,
    value: string,
  ) => {
    setRows(prev =>
      prev.map(row => {
        if (row.id !== id) return row;
        const updated = { ...row, [field]: value };
        updated.errors = validateRow(updated, allowedRoles);
        return updated;
      }),
    );
  };

  const toggleRowCheck = (id: string) => {
    setRows(prev => prev.map(r => (r.id === id ? { ...r, checked: !r.checked } : r)));
  };

  const allChecked = rows.length > 0 && rows.every(r => r.checked);
  const someChecked = rows.some(r => r.checked);

  const toggleAll = () => {
    const next = !allChecked;
    setRows(prev => prev.map(r => ({ ...r, checked: next })));
  };

  const addRow = () => {
    const defaultRole = allowedRoles[0] ?? '';
    const newRow: EditableRow = {
      id: nextId(),
      full_name: '',
      email: '',
      role: defaultRole,
      checked: true,
      errors: validateRow({ full_name: '', email: '', role: defaultRole }, allowedRoles),
    };
    setRows(prev => [...prev, newRow]);
  };

  // Only checked rows participate in registration
  const checkedRows = rows.filter(r => r.checked);
  const validCheckedCount = checkedRows.filter(r => isRowValid(r.errors)).length;
  const invalidCheckedCount = checkedRows.filter(r => !isRowValid(r.errors)).length;

  const totalValid = rows.filter(r => isRowValid(r.errors)).length;
  const totalInvalid = rows.filter(r => !isRowValid(r.errors)).length;

  // Whether admin can choose a group (multi-role → step 3; single "PARTICIPANT"-only → still step 3)
  // Always go through step 3 so user can optionally assign a group.
  const proceedToGroupSelection = () => {
    if (validCheckedCount === 0) {
      toast.error('No valid rows selected. Fix errors or select valid rows first.');
      return;
    }
    setStep(3);
  };

  // ---------------------------------------------------------------------------
  // Step 3 — group selection + trigger registration
  // ---------------------------------------------------------------------------

  const handleRegister = async () => {
    const toRegister = checkedRows.filter(r => isRowValid(r.errors));
    if (toRegister.length === 0) return;

    setIsRegistering(true);
    try {
      const payload = toRegister.map(r => ({
        email: r.email.trim(),
        role: r.role,
        full_name: r.full_name.trim(),
      }));
      const res = await usersApi.bulkRegister(
        payload,
        selectedGroupId && selectedGroupId !== '__none__' ? selectedGroupId : null,
      );
      setImportResult({
        created: res.data.registered,
        skipped: res.data.skipped,
        failed: res.data.failed,
      });
      await qc.invalidateQueries({ queryKey: ['users'] });
      onSuccess?.();
      setStep(4);
    } catch {
      toast.error('Registration failed. Please try again.');
    } finally {
      setIsRegistering(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Render — role is either a dropdown (admin) or locked text (mentors)
  // ---------------------------------------------------------------------------

  const isRoleLocked = allowedRoles.length === 1 && allowedRoles[0] === 'PARTICIPANT';

  // ---------------------------------------------------------------------------
  // JSX
  // ---------------------------------------------------------------------------

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle className="text-[#00285A]">Bulk Register Users</DialogTitle>
          <StepIndicator step={step} />
        </DialogHeader>

        <div className="flex-1 overflow-y-auto min-h-0 pr-1">

          {/* ================================================================
              STEP 1 — Upload CSV
          ================================================================ */}
          {step === 1 && (
            <div className="space-y-5 py-2">
              <div>
                <p className="text-sm text-muted-foreground">
                  Upload a CSV file with columns: <code className="text-xs bg-[#EBF3FB] text-[#0052A5] px-1 py-0.5 rounded">full_name, email, role</code>.
                  Maximum {MAX_ROWS} rows.
                </p>
                <Button
                  type="button"
                  variant="link"
                  className="px-0 text-[#0052A5] text-sm h-auto mt-1"
                  onClick={downloadTemplate}
                >
                  <Download className="h-3.5 w-3.5 mr-1" />
                  Download template CSV
                </Button>
              </div>

              {/* Drop zone */}
              <div
                className="border-2 border-dashed border-[#C5D8EC] rounded-xl p-10 text-center cursor-pointer hover:border-[#0052A5] hover:bg-[#EBF3FB]/40 transition-colors"
                onClick={() => fileInputRef.current?.click()}
                onDragOver={e => e.preventDefault()}
                onDrop={e => {
                  e.preventDefault();
                  const file = e.dataTransfer.files?.[0] ?? null;
                  if (file) handleFileChange(file);
                }}
              >
                <Upload className="h-8 w-8 mx-auto mb-2 text-[#0052A5]/50" />
                {csvFile ? (
                  <p className="text-sm font-medium text-[#00285A]">{csvFile.name}</p>
                ) : (
                  <>
                    <p className="text-sm text-muted-foreground">Drag & drop or click to select a .csv file</p>
                  </>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv"
                  className="hidden"
                  onChange={e => handleFileChange(e.target.files?.[0] ?? null)}
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={handleClose}>Cancel</Button>
                <Button
                  onClick={parseCSV}
                  disabled={!csvFile}
                  className="bg-[#0052A5] hover:bg-[#00285A] text-white"
                >
                  Next — Edit &amp; Review
                </Button>
              </div>
            </div>
          )}

          {/* ================================================================
              STEP 2 — Inline-editable table
          ================================================================ */}
          {step === 2 && (
            <div className="space-y-4 py-2">

              {/* Count badges */}
              <div className="flex items-center gap-3 flex-wrap">
                <span className="inline-flex items-center gap-1.5 text-xs font-medium text-green-700 bg-green-50 border border-green-200 px-2.5 py-1 rounded-full">
                  <CheckCircle className="h-3.5 w-3.5" />
                  {totalValid} valid
                </span>
                {totalInvalid > 0 && (
                  <span className="inline-flex items-center gap-1.5 text-xs font-medium text-red-700 bg-red-50 border border-red-200 px-2.5 py-1 rounded-full">
                    <AlertCircle className="h-3.5 w-3.5" />
                    {totalInvalid} invalid
                  </span>
                )}
                <span className="text-xs text-muted-foreground ml-auto">
                  {rows.length} total rows &middot; {checkedRows.length} selected
                </span>
              </div>

              {/* Table */}
              <div className="overflow-auto max-h-[42vh] rounded-lg border border-[#C5D8EC]">
                <table className="w-full text-xs min-w-[700px]">
                  <thead className="bg-[#EBF3FB] sticky top-0 z-10">
                    <tr>
                      {/* Select-all checkbox */}
                      <th className="px-3 py-2.5 w-8">
                        <input
                          type="checkbox"
                          checked={allChecked}
                          ref={el => {
                            if (el) el.indeterminate = !allChecked && someChecked;
                          }}
                          onChange={toggleAll}
                          className="accent-[#0052A5] cursor-pointer"
                          aria-label="Select all rows"
                        />
                      </th>
                      <th className="px-2 py-2.5 text-left font-semibold text-[#00285A] w-8">#</th>
                      <th className="px-3 py-2.5 text-left font-semibold text-[#00285A]">
                        Full Name <span className="text-red-500">*</span>
                      </th>
                      <th className="px-3 py-2.5 text-left font-semibold text-[#00285A]">
                        Email <span className="text-red-500">*</span>
                      </th>
                      <th className="px-3 py-2.5 text-left font-semibold text-[#00285A]">
                        Role <span className="text-red-500">*</span>
                      </th>
                      <th className="px-3 py-2.5 text-left font-semibold text-[#00285A] w-40">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, idx) => {
                      const valid = isRowValid(row.errors);
                      const rowErrors = Object.values(row.errors).filter(Boolean);
                      return (
                        <tr
                          key={row.id}
                          className={`border-t border-[#C5D8EC]/50 transition-colors ${
                            !valid ? 'bg-red-50/60' : 'hover:bg-[#EBF3FB]/30'
                          }`}
                        >
                          {/* Checkbox */}
                          <td className="px-3 py-1.5 text-center">
                            <input
                              type="checkbox"
                              checked={row.checked}
                              onChange={() => toggleRowCheck(row.id)}
                              className="accent-[#0052A5] cursor-pointer"
                              aria-label={`Select row ${idx + 1}`}
                            />
                          </td>

                          {/* Row number */}
                          <td className="px-2 py-1.5 text-muted-foreground/70 select-none">
                            {idx + 1}
                          </td>

                          {/* Full Name */}
                          <td className="px-3 py-1.5">
                            <input
                              type="text"
                              value={row.full_name}
                              onChange={e => updateCell(row.id, 'full_name', e.target.value)}
                              placeholder="Full Name"
                              className={`w-full min-w-[140px] bg-transparent border rounded px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-[#0052A5] transition-shadow ${
                                row.errors.full_name
                                  ? 'border-red-400 bg-red-50'
                                  : 'border-[#C5D8EC] focus:border-[#0052A5]'
                              }`}
                            />
                          </td>

                          {/* Email */}
                          <td className="px-3 py-1.5">
                            <input
                              type="email"
                              value={row.email}
                              onChange={e => updateCell(row.id, 'email', e.target.value)}
                              placeholder="email@example.com"
                              className={`w-full min-w-[180px] bg-transparent border rounded px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-[#0052A5] transition-shadow ${
                                row.errors.email
                                  ? 'border-red-400 bg-red-50'
                                  : 'border-[#C5D8EC] focus:border-[#0052A5]'
                              }`}
                            />
                          </td>

                          {/* Role */}
                          <td className="px-3 py-1.5">
                            {isRoleLocked ? (
                              <span className="text-xs text-muted-foreground px-2 py-1 bg-[#EBF3FB] rounded">
                                PARTICIPANT
                              </span>
                            ) : (
                              <select
                                value={row.role}
                                onChange={e => updateCell(row.id, 'role', e.target.value)}
                                className={`w-full min-w-[120px] bg-white border rounded px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-[#0052A5] transition-shadow cursor-pointer ${
                                  row.errors.role
                                    ? 'border-red-400 bg-red-50'
                                    : 'border-[#C5D8EC] focus:border-[#0052A5]'
                                }`}
                              >
                                {allowedRoles.map(r => (
                                  <option key={r} value={r}>{roleLabel(r)}</option>
                                ))}
                              </select>
                            )}
                          </td>

                          {/* Status */}
                          <td className="px-3 py-1.5">
                            {valid ? (
                              <span className="inline-flex items-center gap-1 text-green-600">
                                <CheckCircle className="h-3.5 w-3.5 shrink-0" />
                                <span>Valid</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-start gap-1 text-red-600">
                                <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-px" />
                                <span className="leading-tight">{rowErrors.join('; ')}</span>
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Add row button */}
              <div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={addRow}
                  className="text-[#0052A5] hover:bg-[#EBF3FB]"
                >
                  <Plus className="h-3.5 w-3.5 mr-1" />
                  Add Row
                </Button>
              </div>

              <div className="flex justify-between gap-2 pt-1">
                <Button variant="outline" onClick={() => setStep(1)}>Back</Button>
                <Button
                  onClick={proceedToGroupSelection}
                  disabled={validCheckedCount === 0}
                  className="bg-[#0052A5] hover:bg-[#00285A] text-white"
                >
                  Next — Assign Group ({validCheckedCount} valid)
                </Button>
              </div>
            </div>
          )}

          {/* ================================================================
              STEP 3 — Group selection
          ================================================================ */}
          {step === 3 && (
            <div className="space-y-6 py-4">
              <div>
                <h3 className="text-sm font-semibold text-[#00285A] mb-1">
                  Which batch should participants be enrolled in?
                </h3>
                <p className="text-xs text-muted-foreground">
                  Applies only to users with the PARTICIPANT role. You can skip this step.
                </p>
              </div>

              {groupsLoading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading batches…
                </div>
              ) : (
                <div className="space-y-2">
                  <Select value={selectedGroupId} onValueChange={setSelectedGroupId}>
                    <SelectTrigger className="w-full border-[#C5D8EC] focus:ring-[#0052A5]/30 focus:border-[#0052A5]">
                      <SelectValue placeholder="None / Skip — register without batch" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">None / Skip — register without batch</SelectItem>
                      {groups.map(g => (
                        <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {groups.length === 0 && (
                    <p className="text-xs text-muted-foreground">No batches available.</p>
                  )}
                </div>
              )}

              {/* Summary */}
              <div className="rounded-lg bg-[#EBF3FB] border border-[#C5D8EC] px-4 py-3 text-xs text-[#00285A] space-y-1">
                <p className="font-semibold">Registration summary</p>
                <p>{validCheckedCount} user{validCheckedCount !== 1 ? 's' : ''} will be registered</p>
                {invalidCheckedCount > 0 && (
                  <p className="text-red-600">{invalidCheckedCount} selected row{invalidCheckedCount !== 1 ? 's' : ''} with errors will be skipped</p>
                )}
                {selectedGroupId && selectedGroupId !== '__none__' && (
                  <p>Batch: <span className="font-medium">{groups.find(g => g.id === selectedGroupId)?.name ?? selectedGroupId}</span></p>
                )}
              </div>

              <div className="flex justify-between gap-2">
                <Button variant="outline" onClick={() => setStep(2)}>Back</Button>
                <Button
                  onClick={handleRegister}
                  disabled={isRegistering || groupsLoading}
                  className="bg-[#0052A5] hover:bg-[#00285A] text-white min-w-[140px]"
                >
                  {isRegistering ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-1" />
                      Registering…
                    </>
                  ) : (
                    `Register ${validCheckedCount} User${validCheckedCount !== 1 ? 's' : ''}`
                  )}
                </Button>
              </div>
            </div>
          )}

          {/* ================================================================
              STEP 4 — Results
          ================================================================ */}
          {step === 4 && importResult && (
            <div className="space-y-6 py-4">
              <div className="text-center">
                <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-3" />
                <p className="text-lg font-semibold text-[#00285A]">Registration Complete</p>
              </div>

              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="rounded-xl bg-green-50 border border-green-100 p-4">
                  <p className="text-2xl font-bold text-green-700">{importResult.created}</p>
                  <p className="text-xs text-green-600 mt-1">✅ Registered</p>
                </div>
                <div className="rounded-xl bg-amber-50 border border-amber-100 p-4">
                  <p className="text-2xl font-bold text-amber-700">{importResult.skipped}</p>
                  <p className="text-xs text-amber-600 mt-1">⏭ Skipped (already exists)</p>
                </div>
                <div className="rounded-xl bg-red-50 border border-red-100 p-4">
                  <p className="text-2xl font-bold text-red-700">{importResult.failed}</p>
                  <p className="text-xs text-red-600 mt-1">❌ Failed</p>
                </div>
              </div>

              {/* Progress bar showing registered ratio */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Success rate</span>
                  <span>
                    {importResult.created + importResult.skipped + importResult.failed > 0
                      ? Math.round(
                          ((importResult.created + importResult.skipped) /
                            (importResult.created + importResult.skipped + importResult.failed)) *
                            100,
                        )
                      : 0}
                    %
                  </span>
                </div>
                <Progress
                  value={
                    importResult.created + importResult.skipped + importResult.failed > 0
                      ? Math.round(
                          ((importResult.created + importResult.skipped) /
                            (importResult.created + importResult.skipped + importResult.failed)) *
                            100,
                        )
                      : 0
                  }
                  className="h-2"
                />
              </div>

              <div className="flex justify-center">
                <Button
                  onClick={handleClose}
                  className="bg-[#0052A5] hover:bg-[#00285A] text-white px-8"
                >
                  Done
                </Button>
              </div>
            </div>
          )}

        </div>
      </DialogContent>
    </Dialog>
  );
}
