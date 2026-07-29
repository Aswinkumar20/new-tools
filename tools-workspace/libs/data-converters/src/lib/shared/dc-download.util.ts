function scheduleRevokeObjectUrl(url: string): void {
  globalThis.setTimeout(() => URL.revokeObjectURL(url), 500);
}

/** Download a Blob via a temporary anchor. Throws if the blob is empty. */
export function dcDownloadBlob(blob: Blob, filename: string): void {
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

/** Legacy converter download timestamp (preserves existing filename format). */
export function dcDownloadTimestamp(date = new Date()): string {
  return date.toISOString().split(':').join('-').split('.').join('-');
}
