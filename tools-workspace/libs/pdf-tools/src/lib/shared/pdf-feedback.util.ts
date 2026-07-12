import type { ToastService } from '@tools-workspace/features-home';

/** Consistent toast notifications for PDF tools. */
export function pdfNotifyError(toast: ToastService, message: string): void {
  if (message) toast.error(message);
}

export function pdfNotifySuccess(toast: ToastService, message: string): void {
  if (message) toast.success(message);
}

export function pdfNotifyWarning(toast: ToastService, message: string): void {
  if (message) toast.warning(message);
}

export function pdfNotifyInfo(toast: ToastService, message: string): void {
  if (message) toast.info(message);
}
