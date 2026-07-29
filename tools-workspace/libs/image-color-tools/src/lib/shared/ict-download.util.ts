import type { ToastService } from '@tools-workspace/features-home';

/** Trigger a browser download for a Blob and show toast feedback. */
export function ictDownloadBlob(
  toast: ToastService,
  blob: Blob,
  filename: string,
  label = 'File',
  options?: { silent?: boolean }
): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
  if (!options?.silent) {
    toast.info(`${label} downloaded`);
  }
}
