import type { TvRelatedToolLink } from '../types/tsv-viewer.types';

export const TV_SUPPORTED_EXTENSIONS: ReadonlyArray<string> = ['.tsv', '.tab', '.txt', '.json', '.md'];

export const TV_ACCEPT_ATTR =
  '.tsv,.tab,.txt,.json,.md,text/tab-separated-values,text/plain,application/json,text/markdown';

export const TV_FORMATS_LABEL = '.tsv, .tab, .txt, .json, .md';

export const TV_FORMATS_HINT = 'TSV columns, dialect, and preview rows. Education/research only.';

export const TV_MAX_FILE_BYTES = 32 * 1024 * 1024;

export const TV_RELATED_TOOLS: ReadonlyArray<TvRelatedToolLink> = [
  { label: 'CSV Viewer', description: 'Comma-separated tables', path: '/data-explorers/csv-viewer' },
  { label: 'JSON Viewer', description: 'Structured JSON', path: '/data-explorers/json-viewer' },
  { label: 'DuckDB Viewer', description: 'Analytical database tables', path: '/data-explorers/duckdb-viewer' },
  { label: 'Parquet Viewer', description: 'Columnar schema and rows', path: '/data-explorers/parquet-viewer' }
];
