/* eslint-disable react-refresh/only-export-components */
import { useState, useRef } from 'react';
import Papa from 'papaparse';
import { z } from 'zod';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Download, Upload, AlertCircle, CheckCircle } from 'lucide-react';
import { usersApi } from '@/api/users';
import { apiClient } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import type { ApiEnvelope, ClassGroup } from '@/lib/types';

interface BulkRow {
  rowIndex: number;
  email: string;
  role: string;
  full_name: string;
  group_ids_raw: string;
  errors: string[];
  valid: boolean;
}

interface ImportResult {
  created: number;
  skipped: number;
  failed: number;
}

interface BulkInviteDialogProps {
  open: boolean;
  onClose: () => void;
}

const MAX_ROWS = 200;
const emailSchema = z.string().email();
const VALID_ROLES = ['ADMIN', 'PARTICIPANT'];

export function BulkInviteDialog({ open, onClose }: BulkInviteDialogProps) {
  const qc = useQueryClient();
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [parsedRows, setParsedRows] = useState<BulkRow[]>([]);
  const [progress, setProgress] = useState(0);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: groupsData } = useQuery({
    queryKey: ['groups'],
    queryFn: () => apiClient.get<ApiEnvelope<ClassGroup[]>>('/groups').then(r => r.data),
    enabled: open,
  });
  const validGroupIds = new Set((groupsData?.data ?? []).map(g => g.id));

  const downloadTemplate = () => {
    const content =
      'email,role,full_name,group_ids\n' +
      'alice@example.com,ADMIN,Alice,\n' +
      'bob@example.com,ADMIN,Bob,\n' +
      'carol@example.com,PARTICIPANT,Carol,g-batch-a\n';
    const blob = new Blob([content], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'invite_template.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleFileChange = (file: File | null) => {
    setCsvFile(file);
  };

  const parseAndValidate = () => {
    if (!csvFile) return;

    Papa.parse<Record<string, string>>(csvFile, {
      header: true,
      skipEmptyLines: true,
      complete: (result) => {
        const rows = result.data.slice(0, MAX_ROWS).map((rawRow, idx) => {
          const normalized: Record<string, string> = {};
          for (const [k, v] of Object.entries(rawRow)) {
            normalized[k.toLowerCase().trim()] = (v ?? '').trim();
          }

          const email = normalized['email'] ?? '';
          const role = (normalized['role'] ?? '').toUpperCase();
          const full_name = normalized['full_name'] ?? '';
          const group_ids_raw = normalized['group_ids'] ?? '';

          const errors: string[] = [];

          if (!email) {
            errors.push('Email is required');
          } else if (!emailSchema.safeParse(email).success) {
            errors.push('Invalid email format');
          }

          if (!VALID_ROLES.includes(role)) {
            errors.push(
              `Invalid role "${role || '(empty)'}" — must be ADMIN or PARTICIPANT`,
            );
          }

          if (group_ids_raw) {
            const gids = group_ids_raw.split(',').map(s => s.trim()).filter(Boolean);
            const invalid = gids.filter(gid => !validGroupIds.has(gid));
            if (invalid.length) {
              errors.push(`Unknown group IDs: ${invalid.join(', ')}`);
            }
          }

          return { rowIndex: idx + 1, email, role, full_name, group_ids_raw, errors, valid: errors.length === 0 };
        });

        setParsedRows(rows);
        setStep(2);
      },
    });
  };

  const handleImport = async () => {
    const valid = parsedRows.filter(r => r.valid);
    if (valid.length === 0) return;

    setProgress(0);
    setStep(3);

    for (let i = 0; i < valid.length; i++) {
      await new Promise<void>(resolve => setTimeout(resolve, 100));
      setProgress(Math.round(((i + 1) / valid.length) * 100));
    }

    try {
      const res = await usersApi.bulkInvite(
        valid.map(r => ({
          email: r.email,
          role: r.role,
          ...(r.full_name ? { full_name: r.full_name } : {}),
          ...(r.group_ids_raw
            ? { group_ids: r.group_ids_raw.split(',').map(s => s.trim()).filter(Boolean) }
            : {}),
        })),
      ) as { data: { created: number; skipped: number; errors: unknown[] } };

      const d = res.data;
      setImportResult({
        created: d.created,
        skipped: d.skipped,
        failed: parsedRows.filter(r => !r.valid).length,
      });
      setStep(4);
      await qc.invalidateQueries({ queryKey: ['users'] });
    } catch {
      toast.error('Import failed. Please try again.');
      setStep(2);
      return;
    }
  };

  const handleClose = () => {
    setStep(1);
    setCsvFile(null);
    setParsedRows([]);
    setProgress(0);
    setImportResult(null);
    onClose();
  };

  const validCount = parsedRows.filter(r => r.valid).length;
  const invalidCount = parsedRows.filter(r => !r.valid).length;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Bulk Invite Users (CSV)</DialogTitle>
          <div className="flex gap-1 mt-3">
            {([1, 2, 3] as const).map(s => (
              <div
                key={s}
                className={`h-1.5 flex-1 rounded-full transition-colors ${
                  step >= s ? 'bg-primary' : 'bg-white/10'
                }`}
              />
            ))}
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto min-h-0">
          {/* Step 1: Upload CSV */}
          {step === 1 && (
            <div className="space-y-5 py-2">
              <div>
                <p className="text-sm text-muted-foreground">
                  Upload a CSV file to invite multiple users at once. Max {MAX_ROWS} rows.
                </p>
                <Button
                  type="button"
                  variant="link"
                  className="px-0 text-primary text-sm h-auto"
                  onClick={downloadTemplate}
                >
                  <Download className="h-3.5 w-3.5 mr-1" />
                  Download template
                </Button>
              </div>

              <div
                className="border-2 border-dashed border-white/15 rounded-lg p-8 text-center cursor-pointer hover:border-primary/50 transition-colors"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground/70" />
                {csvFile ? (
                  <p className="text-sm font-medium text-foreground/90">{csvFile.name}</p>
                ) : (
                  <p className="text-sm text-muted-foreground">Click to select a .csv file</p>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv"
                  className="hidden"
                  onChange={e => handleFileChange(e.target.files?.[0] ?? null)}
                />
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={handleClose}>Cancel</Button>
                <Button onClick={parseAndValidate} disabled={!csvFile}>
                  Next — Preview
                </Button>
              </div>
            </div>
          )}

          {/* Step 2: Preview & Validate */}
          {step === 2 && (
            <div className="space-y-4 py-2">
              <div className="flex items-center gap-4">
                <span className="inline-flex items-center gap-1.5 text-sm text-green-700 bg-green-50 px-2.5 py-1 rounded-full">
                  <CheckCircle className="h-3.5 w-3.5" />
                  {validCount} valid
                </span>
                {invalidCount > 0 && (
                  <span className="inline-flex items-center gap-1.5 text-sm text-red-700 bg-red-50 px-2.5 py-1 rounded-full">
                    <AlertCircle className="h-3.5 w-3.5" />
                    {invalidCount} invalid
                  </span>
                )}
                <span className="text-xs text-muted-foreground ml-auto">{parsedRows.length} total rows</span>
              </div>

              <div className="overflow-auto max-h-72 rounded border border-border">
                <table className="w-full text-xs">
                  <thead className="bg-white/5 sticky top-0">
                    <tr>
                      <th className="text-left px-3 py-2 font-medium text-muted-foreground">#</th>
                      <th className="text-left px-3 py-2 font-medium text-muted-foreground">Email</th>
                      <th className="text-left px-3 py-2 font-medium text-muted-foreground">Role</th>
                      <th className="text-left px-3 py-2 font-medium text-muted-foreground">Full Name</th>
                      <th className="text-left px-3 py-2 font-medium text-muted-foreground">Issues</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parsedRows.map(row => (
                      <tr
                        key={row.rowIndex}
                        className={row.valid ? 'bg-green-50/30' : 'bg-red-50/50'}
                      >
                        <td className="px-3 py-1.5 text-muted-foreground/70">{row.rowIndex}</td>
                        <td className="px-3 py-1.5 font-medium">{row.email || '—'}</td>
                        <td className="px-3 py-1.5">{row.role || '—'}</td>
                        <td className="px-3 py-1.5 text-muted-foreground">{row.full_name || '—'}</td>
                        <td className="px-3 py-1.5">
                          {row.errors.length > 0 ? (
                            <span className="text-red-600">{row.errors.join('; ')}</span>
                          ) : (
                            <CheckCircle className="h-3.5 w-3.5 text-green-500" />
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex justify-between gap-2">
                <Button variant="outline" onClick={() => setStep(1)}>Back</Button>
                <Button
                  onClick={handleImport}
                  disabled={validCount === 0}
                >
                  Import {validCount} user{validCount !== 1 ? 's' : ''}
                </Button>
              </div>
            </div>
          )}

          {/* Step 3: Progress */}
          {step === 3 && (
            <div className="space-y-6 py-8 text-center">
              <p className="text-sm text-muted-foreground">Importing users…</p>
              <Progress value={progress} className="h-3" />
              <p className="text-sm font-medium text-primary">{progress}%</p>
            </div>
          )}

          {/* Step 4: Result */}
          {step === 4 && importResult && (
            <div className="space-y-5 py-4">
              <div className="text-center">
                <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-3" />
                <p className="text-lg font-semibold text-foreground">Import Complete</p>
              </div>
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="rounded-lg bg-green-50 p-4">
                  <p className="text-2xl font-bold text-green-700">{importResult.created}</p>
                  <p className="text-xs text-green-600 mt-1">Created</p>
                </div>
                <div className="rounded-lg bg-amber-50 p-4">
                  <p className="text-2xl font-bold text-amber-700">{importResult.skipped}</p>
                  <p className="text-xs text-amber-600 mt-1">Skipped (exists)</p>
                </div>
                <div className="rounded-lg bg-red-50 p-4">
                  <p className="text-2xl font-bold text-red-700">{importResult.failed}</p>
                  <p className="text-xs text-red-600 mt-1">Invalid rows</p>
                </div>
              </div>
              <div className="flex justify-center">
                <Button onClick={handleClose}>Done</Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
