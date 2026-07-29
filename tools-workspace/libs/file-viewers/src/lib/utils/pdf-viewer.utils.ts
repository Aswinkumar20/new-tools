import type { FvToolSuggestion } from '../shared/fv-tool-suggestion.model';
import {
  PDF_JS_CDN,
  PDF_JS_WORKER_CDN,
  PDF_LARGE_FILE_SUGGEST_BYTES,
  PDF_MANY_PAGES_SUGGEST_THRESHOLD,
  PDF_MAX_FILE_SIZE_BYTES,
  PDF_MAX_FILE_SIZE_LABEL,
  PDF_MAX_ZOOM,
  PDF_MIN_ZOOM,
  PDF_ZOOM_STEP
} from '../constants/pdf-viewer.constants';
import type {
  PdfFile,
  PdfJsLibrary,
  PdfValidationResult,
  PDFDocumentProxy
} from '../types/pdf-viewer.types';

declare global {
  interface Window {
    pdfjsLib?: PdfJsLibrary;
  }
}

export function isPdfFile(file: Pick<File, 'name' | 'type'>): boolean {
  return (
    file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
  );
}

export function formatPdfFileSize(bytes: number): string {
  if (bytes === 0) {
    return '0 Bytes';
  }
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

export function clampPdfZoom(level: number): number {
  return Math.max(PDF_MIN_ZOOM, Math.min(PDF_MAX_ZOOM, level));
}

export function stepPdfZoom(current: number, direction: 1 | -1): number {
  return clampPdfZoom(current + direction * PDF_ZOOM_STEP);
}

export function validatePdfFiles(
  files: ReadonlyArray<File>,
  options: {
    maxFileSize?: number;
    maxFileSizeLabel?: string;
  } = {}
): PdfValidationResult {
  const maxFileSize = options.maxFileSize ?? PDF_MAX_FILE_SIZE_BYTES;
  const maxLabel = options.maxFileSizeLabel ?? PDF_MAX_FILE_SIZE_LABEL;
  const validFiles: File[] = [];
  const errors: string[] = [];

  for (const file of files) {
    if (!isPdfFile(file)) {
      errors.push(`${file.name}: Not a PDF file`);
      continue;
    }

    if (file.size > maxFileSize) {
      errors.push(`${file.name}: File too large (max ${maxLabel})`);
      continue;
    }

    validFiles.push(file);
  }

  return { validFiles, errors };
}

export function createPdfFileRecord(file: File, url: string): PdfFile {
  return {
    name: file.name,
    file,
    url,
    size: file.size,
    pdfDoc: null,
    totalPages: 0,
    needsPassword: false,
    passwordError: false
  };
}

export function isFullscreenActive(doc: Document = document): boolean {
  const extended = doc as Document & {
    webkitFullscreenElement?: Element | null;
    mozFullScreenElement?: Element | null;
    msFullscreenElement?: Element | null;
  };
  return !!(
    doc.fullscreenElement ||
    extended.webkitFullscreenElement ||
    extended.mozFullScreenElement ||
    extended.msFullscreenElement
  );
}

export function safeRevokeObjectUrl(url: string | undefined): void {
  if (!url) {
    return;
  }
  try {
    URL.revokeObjectURL(url);
  } catch {
    // Ignore invalid object URLs during teardown
  }
}

export function safeDestroyPdfDoc(pdfDoc: PDFDocumentProxy | null | undefined): void {
  if (!pdfDoc) {
    return;
  }
  try {
    pdfDoc.destroy();
  } catch {
    // Ignore destroy errors during teardown
  }
}

export function isPdfPasswordError(
  error: unknown,
  pdfjs: Pick<PdfJsLibrary, 'PasswordResponses'>
): boolean {
  const errorMessage = error instanceof Error ? error.message : String(error ?? '');
  const code = (error as { code?: number } | null)?.code;
  const name = (error as { name?: string } | null)?.name;

  return (
    errorMessage.toLowerCase().includes('password') ||
    code === pdfjs.PasswordResponses?.INCORRECT_PASSWORD ||
    name === 'PasswordException'
  );
}

export function computeFitToWidthZoom(
  viewportWidth: number,
  containerWidth: number
): number {
  if (viewportWidth <= 0 || containerWidth <= 0) {
    return PDF_MIN_ZOOM;
  }
  const scale = containerWidth / viewportWidth;
  return clampPdfZoom(Math.round(scale * 100));
}

export async function loadPdfJsLibrary(
  scriptUrl: string = PDF_JS_CDN,
  workerUrl: string = PDF_JS_WORKER_CDN
): Promise<PdfJsLibrary> {
  if (globalThis.window === undefined) {
    throw new TypeError('PDF.js can only be loaded in browser environment');
  }

  if (globalThis.window.pdfjsLib) {
    return globalThis.window.pdfjsLib;
  }

  const script = document.createElement('script');
  script.src = scriptUrl;
  document.head.appendChild(script);

  return new Promise((resolve, reject) => {
    script.onload = () => {
      const pdfjs = globalThis.window.pdfjsLib;
      if (!pdfjs) {
        reject(new Error('Failed to load PDF.js library'));
        return;
      }
      pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
      resolve(pdfjs);
    };
    script.onerror = () => reject(new Error('Failed to load PDF.js library'));
  });
}

export function resolvePdfSuggestion(options: {
  hasFiles: boolean;
  hasError: boolean;
  pdfCount: number;
  currentSize: number;
  totalPages: number;
  needsPassword: boolean;
}): FvToolSuggestion | null {
  const { hasFiles, hasError, pdfCount, currentSize, totalPages, needsPassword } =
    options;

  if (hasError) {
    return {
      id: 'pv-meta',
      title: 'Check the file type?',
      reason:
        'Upload failed or the file was rejected. Confirm it is a valid PDF before retrying.',
      actionLabel: 'Open File Metadata Viewer',
      path: '/code-file-tools/file-metadata-viewer'
    };
  }

  if (!hasFiles) {
    return {
      id: 'pv-compress',
      title: 'Working with oversized PDFs?',
      reason:
        'Large scans and exports load slower. Compress first when you are preparing files to share.',
      actionLabel: 'Open Compress PDF',
      path: '/pdf-tools/compress-pdf'
    };
  }

  if (needsPassword) {
    return {
      id: 'pv-meta-locked',
      title: 'Need to inspect PDF properties?',
      reason:
        'After unlocking, PDF Metadata Editor can show title, author, and encryption details.',
      actionLabel: 'Open PDF Metadata Editor',
      path: '/pdf-tools/pdf-metadata-editor'
    };
  }

  if (pdfCount > 1) {
    return {
      id: 'pv-merge',
      title: 'Combine these PDFs?',
      reason:
        'You have multiple documents open. Merge them into one file when you are ready to share.',
      actionLabel: 'Open Merge PDFs',
      path: '/pdf-tools/merge-pdfs'
    };
  }

  if (currentSize > PDF_LARGE_FILE_SUGGEST_BYTES) {
    return {
      id: 'pv-compress-large',
      title: 'This PDF is fairly large',
      reason:
        'Files over 10MB benefit from compression before email or CMS upload.',
      actionLabel: 'Open Compress PDF',
      path: '/pdf-tools/compress-pdf'
    };
  }

  if (totalPages > PDF_MANY_PAGES_SUGGEST_THRESHOLD) {
    return {
      id: 'pv-split',
      title: 'Split this long document?',
      reason:
        'Long PDFs are easier to share as smaller ranges. Split or extract the pages you need.',
      actionLabel: 'Open Split PDFs',
      path: '/pdf-tools/split-pdfs'
    };
  }

  return {
    id: 'pv-extract',
    title: 'Need only a few pages?',
    reason:
      'After reviewing, extract specific pages instead of sending the whole file.',
    actionLabel: 'Open Extract Pages',
    path: '/pdf-tools/extract-pages'
  };
}
