import type { ToastService } from '@tools-workspace/features-home';

/**
 * Copy text to the clipboard with toast feedback.
 * Safe for SSR and environments without Clipboard API support.
 */
export function buCopyText(toast: ToastService, text: string, label: string): void {
  if (!text) {
    return;
  }

  if (typeof navigator === 'undefined' || !navigator.clipboard?.writeText) {
    toast.error('Clipboard is not available in this environment');
    return;
  }

  navigator.clipboard.writeText(text).then(
    () => toast.info(`${label} copied to clipboard`),
    () => toast.error('Failed to copy to clipboard')
  );
}
