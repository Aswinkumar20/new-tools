function scheduleRevokeObjectUrl(url: string): void {
  globalThis.setTimeout(() => URL.revokeObjectURL(url), 500);
}

/** Download a Blob via a temporary anchor. Throws if the blob is empty. */
export function cftDownloadBlob(blob: Blob, filename: string): void {
  if (!blob.size) {
    throw new Error('Cannot download empty file');
  }
  if (typeof document === 'undefined') {
    throw new Error('Download is not available in this environment');
  }

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.rel = 'noopener';
  document.body.appendChild(link);
  link.click();
  link.remove();
  scheduleRevokeObjectUrl(url);
}

/** Serialize data as pretty JSON and trigger a download. */
export function cftDownloadJson(data: unknown, filename: string): void {
  const payload = JSON.stringify(data, null, 2);
  if (!payload) {
    throw new Error('Cannot download empty file');
  }
  cftDownloadBlob(new Blob([payload], { type: 'application/json' }), filename);
}

/** Build a filesystem-safe timestamp for download filenames. */
export function cftDownloadTimestamp(date = new Date()): string {
  return date.toISOString().slice(0, 19).replace(/[:T]/g, '-');
}
