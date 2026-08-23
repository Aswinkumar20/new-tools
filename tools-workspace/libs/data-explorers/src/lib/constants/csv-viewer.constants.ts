import type { CvRelatedToolLink } from '../types/csv-viewer.types';

export const CV_SUPPORTED_EXTENSIONS: ReadonlyArray<string> = ['.csv', '.txt', '.json', '.md'];

export const CV_ACCEPT_ATTR = '.csv,.txt,.json,.md,text/csv,text/plain,application/json,text/markdown';

export const CV_FORMATS_LABEL = '.csv, .txt, .json, .md';

export const CV_FORMATS_HINT = 'CSV columns, dialect, filters, and preview rows. Education/research only.';

export const CV_MAX_FILE_BYTES = 32 * 1024 * 1024;

export const CV_RELATED_TOOLS: ReadonlyArray<CvRelatedToolLink> = [
  { label: 'TSV Viewer', description: 'Tab-separated tables', path: '/data-explorers/tsv-viewer' },
  { label: 'JSON Viewer', description: 'Structured JSON', path: '/data-explorers/json-viewer' },
  { label: 'SQLite Viewer', description: 'Embedded SQL tables', path: '/data-explorers/sqlite-viewer' },
  { label: 'Parquet Viewer', description: 'Columnar schema and rows', path: '/data-explorers/parquet-viewer' }
];
