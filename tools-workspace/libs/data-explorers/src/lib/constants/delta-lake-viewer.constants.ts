import type { DlRelatedToolLink } from '../types/delta-lake-viewer.types';

export const DL_SUPPORTED_EXTENSIONS: ReadonlyArray<string> = ['.delta', '.json', '.ndjson', '.csv', '.md', '.txt'];

export const DL_ACCEPT_ATTR =
  '.delta,.json,.ndjson,.csv,.md,.txt,application/octet-stream,application/json,application/x-ndjson,text/csv,text/plain,text/markdown';

export const DL_FORMATS_LABEL = '.delta, .json, .ndjson, .csv, .md, .txt';

export const DL_FORMATS_HINT = 'Delta Lake log versions, schema, and sample rows. Education/research only.';

export const DL_MAX_FILE_BYTES = 32 * 1024 * 1024;

export const DL_RELATED_TOOLS: ReadonlyArray<DlRelatedToolLink> = [
  { label: 'Parquet Viewer', description: 'Columnar schema and rows', path: '/data-explorers/parquet-viewer' },
  { label: 'Arrow Viewer', description: 'Arrow IPC tables', path: '/data-explorers/arrow-viewer' },
  { label: 'ORC Viewer', description: 'ORC columnar files', path: '/data-explorers/orc-viewer' },
  { label: 'SQLite Viewer', description: 'Embedded SQL tables', path: '/data-explorers/sqlite-viewer' }
];
