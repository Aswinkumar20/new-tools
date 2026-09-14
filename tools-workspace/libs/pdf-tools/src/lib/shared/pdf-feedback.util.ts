import type { ToastService } from '@tools-workspace/features-home';
import { toUserFacingError } from '@tools-workspace/features-home';

/** Consistent toast notifications for PDF tools. */
export function pdfNotifyError(toast: ToastService, message: string): void {
  if (message) toast.error(message);
}

/**
 * Show a function-focused error toast. Technical API / network wording is replaced
 * with {@code actionFallback}; useful server validation details are kept.
 */
export function pdfNotifyFailure(toast: ToastService, error: unknown, actionFallback: string): void {
  pdfNotifyError(toast, toUserFacingError(error, actionFallback));
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
