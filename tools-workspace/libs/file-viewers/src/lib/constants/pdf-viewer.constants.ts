import type { FvRelatedToolLink } from '../shared/fv-tool-suggestion.model';

export const PDF_ACCEPT_ATTR = '.pdf,application/pdf';

export const PDF_MAX_FILE_SIZE_BYTES = 100 * 1024 * 1024;
export const PDF_MAX_FILE_SIZE_LABEL = '100MB';

export const PDF_DEFAULT_ZOOM = 100;
export const PDF_MIN_ZOOM = 50;
export const PDF_MAX_ZOOM = 300;
export const PDF_ZOOM_STEP = 25;

export const PDF_NORMAL_FIT_PADDING_PX = 128;
export const PDF_FULLSCREEN_FIT_PADDING_PX = 80;

/** Copied from node_modules/pdfjs-dist at build time — not a CDN URL. */
export const PDFJS_WORKER_SRC = 'assets/pdfjs/pdf.worker.min.js';

export const PDF_FULLSCREEN_EVENTS: ReadonlyArray<string> = [
  'fullscreenchange',
  'webkitfullscreenchange',
  'mozfullscreenchange',
  'MSFullscreenChange'
];

export const PDF_FULLSCREEN_ENTER_DELAY_MS = 50;
export const PDF_FULLSCREEN_FIT_MS = 150;
export const PDF_EXIT_RERENDER_MS = 100;

/** Suggest compress when a loaded PDF exceeds this size. */
export const PDF_LARGE_FILE_SUGGEST_BYTES = 10 * 1024 * 1024;

/** Suggest split when a loaded PDF has more pages than this. */
export const PDF_MANY_PAGES_SUGGEST_THRESHOLD = 20;

export const PDF_RELATED_TOOLS: ReadonlyArray<FvRelatedToolLink> = [
  {
    label: 'Merge PDFs',
    path: '/pdf-tools/merge-pdfs',
    description: 'Combine multiple PDFs into one document'
  },
  {
    label: 'Split PDFs',
    path: '/pdf-tools/split-pdfs',
    description: 'Break large PDFs into smaller files by page range'
  },
  {
    label: 'Compress PDF',
    path: '/pdf-tools/compress-pdf',
    description: 'Shrink oversized PDFs before sharing or uploading'
  },
  {
    label: 'Extract Pages',
    path: '/pdf-tools/extract-pages',
    description: 'Pull out only the pages you need'
  },
  {
    label: 'PDF Metadata Editor',
    path: '/pdf-tools/pdf-metadata-editor',
    description: 'Inspect or edit title, author, and other PDF metadata'
  }
];
