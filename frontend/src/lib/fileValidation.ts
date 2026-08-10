export class FileValidationError extends Error {}

export function validateFile(file: File): { ok: true; category: 'doc' | 'image' | 'video' } {
  if (file.name.length > 255) {
    throw new FileValidationError('File name must be 255 characters or fewer. Please rename the file.');
  }
  if (file.size === 0) {
    throw new FileValidationError('File appears to be empty.');
  }
  const category = file.type.startsWith('video/') ? 'video' : 'doc';
  return { ok: true, category };
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`;
}
