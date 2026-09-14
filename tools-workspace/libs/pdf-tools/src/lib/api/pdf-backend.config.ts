import { InjectionToken } from '@angular/core';

export type PdfBackendToolId =
  | 'password-protect-pdf'
  | 'compress-pdf'
  | 'delete-pages'
  | 'extract-pages'
  | 'rotate-pages'
  | 'reorder-pages'
  | 'add-watermark'
  | 'add-page-numbers'
  | 'pdf-metadata-editor'
  | 'create-pdf-from-html'
  | 'text-to-pdf'
  | 'image-to-pdf'
  | 'html-to-pdf'
  | 'merge-pdfs'
  | 'split-pdfs'
  | 'fill-pdf-forms'
  | 'flatten-pdf-forms'
  | 'annotate-pdf'
  | 'highlight-text'
  | 'add-signature'
  | 'pdf-to-text'
  | 'pdf-to-images';

export interface PdfBackendConfig {
  /** Master switch for Java tool-api (PDF domain) integration */
  enabled: boolean;
  /** Dev uses Angular proxy → /api/v1/pdf ; prod can be absolute API host */
  baseUrl: string;
  maxUploadMb: number;
  /** Slice 7 — prefer async merge/split when total upload exceeds this (MB). */
  largeFileThresholdMb: number;
  /** Prefer async merge when this many files are queued. */
  largeMergeMinFiles: number;
  tools: Partial<Record<PdfBackendToolId, boolean>>;
  /** Catch-all for PdfAdvancedWorkbench → /api/v1/pdf advanced endpoints */
  advancedEnabled: boolean;
}

export const DEFAULT_PDF_BACKEND_CONFIG: PdfBackendConfig = {
  enabled: true,
  baseUrl: '/api/v1/pdf',
  maxUploadMb: 50,
  largeFileThresholdMb: 8,
  largeMergeMinFiles: 5,
  advancedEnabled: true,
  tools: {
    'password-protect-pdf': true,
    'compress-pdf': true,
    'delete-pages': true,
    'extract-pages': true,
    'rotate-pages': true,
    'reorder-pages': true,
    'add-watermark': true,
    'add-page-numbers': true,
    'pdf-metadata-editor': true,
    'create-pdf-from-html': true,
    'text-to-pdf': true,
    'image-to-pdf': true,
    'html-to-pdf': true,
    'merge-pdfs': true,
    'split-pdfs': true,
    'fill-pdf-forms': true,
    'flatten-pdf-forms': true,
    'annotate-pdf': true,
    'highlight-text': true,
    'add-signature': true,
    'pdf-to-text': true,
    'pdf-to-images': true,
  },
};

export const PDF_BACKEND_CONFIG = new InjectionToken<PdfBackendConfig>('PDF_BACKEND_CONFIG', {
  providedIn: 'root',
  factory: () => DEFAULT_PDF_BACKEND_CONFIG,
});

export function isPdfBackendEnabled(config: PdfBackendConfig, toolId: PdfBackendToolId): boolean {
  return !!config.enabled && !!config.tools[toolId];
}

export function isPdfAdvancedBackendEnabled(config: PdfBackendConfig): boolean {
  return !!config.enabled && !!config.advancedEnabled;
}
