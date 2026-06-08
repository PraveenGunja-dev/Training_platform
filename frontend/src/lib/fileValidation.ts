import { useSettingsStore } from '@/store/settings';

export const ALLOWED_EXTS = {
  doc:   ['pdf', 'doc', 'docx'],
  image: ['jpg', 'jpeg', 'png'],
  video: ['mp4', 'mov', 'avi', 'mkv'],
};

export type FileCategory = 'doc' | 'image' | 'video';

export type FileValidationResult =
  | { ok: true; category: FileCategory }
  | { ok: false; error: string };

export function validateFile(file: File): FileValidationResult {
  const { settings } = useSettingsStore.getState();
  const maxBytes: Record<FileCategory, number> = {
    doc:   settings.doc_max_mb * 1024 * 1024,
    image: settings.image_max_mb * 1024 * 1024,
    video: settings.video_max_mb * 1024 * 1024,
  };

  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
  for (const [cat, exts] of Object.entries(ALLOWED_EXTS) as [FileCategory, string[]][]) {
    if (exts.includes(ext)) {
      if (file.size > maxBytes[cat]) {
        return { ok: false, error: `File too large. Max ${(maxBytes[cat] / 1024 / 1024).toFixed(0)} MB.` };
      }
      return { ok: true, category: cat };
    }
  }
  return { ok: false, error: 'File type not allowed. Use PDF/DOC/DOCX/JPG/PNG/MP4/MOV/AVI/MKV.' };
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`;
}
