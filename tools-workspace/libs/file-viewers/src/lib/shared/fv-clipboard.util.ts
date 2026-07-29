import type { ToastService } from '@tools-workspace/features-home';

/**
 * Copy text to the clipboard with toast feedback.
 * Falls back to execCommand when Clipboard API is unavailable (matches legacy viewers).
 */
export async function fvCopyText(toast: ToastService, text: string, label: string): Promise<boolean> {
  if (!text) {
    return false;
  }

  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      toast.info(`${label} copied to clipboard`);
      return true;
    } catch {
      // Fall through to legacy path
    }
  }

  if (typeof document === 'undefined') {
    toast.error('Clipboard is not available in this environment');
    return false;
  }

  try {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);
    toast.info(`${label} copied to clipboard`);
    return true;
  } catch {
    toast.error('Failed to copy to clipboard');
    return false;
  }
}
