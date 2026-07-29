import type { ToastService } from '@tools-workspace/features-home';

/** Copy text to the clipboard with toast feedback. */
export function ddCopyText(toast: ToastService, text: string, label: string): Promise<boolean> {
  if (!text) {
    return Promise.resolve(false);
  }

  if (typeof navigator === 'undefined' || !navigator.clipboard?.writeText) {
    toast.error('Clipboard is not available in this environment');
    return Promise.resolve(false);
  }

  return navigator.clipboard.writeText(text).then(
    () => {
      toast.info(`${label} copied to clipboard`);
      return true;
    },
    () => {
      toast.error('Failed to copy to clipboard');
      return false;
    }
  );
}
