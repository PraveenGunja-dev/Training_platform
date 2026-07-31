export type FileValidationResult =
  | { ok: true; category: 'doc' | 'image' | 'video' }
  | { ok: false; error: string };

export function validateFile(_file: File): FileValidationResult {
  return { ok: true, category: 'doc' };
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`;
}
