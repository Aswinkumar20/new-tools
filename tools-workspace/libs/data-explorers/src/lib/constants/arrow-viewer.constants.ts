import type { ArRelatedToolLink } from '../types/arrow-viewer.types';

export const AR_SUPPORTED_EXTENSIONS: ReadonlyArray<string> = ['.arrow', '.ipc', '.arrows', '.json', '.csv', '.md', '.txt'];

export const AR_ACCEPT_ATTR =
  '.arrow,.ipc,.arrows,.json,.csv,.md,.txt,application/octet-stream,application/vnd.apache.arrow.file,application/vnd.apache.arrow.stream,application/json,text/csv,text/plain,text/markdown';

export const AR_FORMATS_LABEL = '.arrow, .ipc, .json, .csv, .md, .txt';

export const AR_FORMATS_HINT = 'Arrow IPC schema, batches, and preview rows. Education/research only.';

export const AR_MAX_FILE_BYTES = 32 * 1024 * 1024;

export const AR_RELATED_TOOLS: ReadonlyArray<ArRelatedToolLink> = [
  { label: 'Feather Viewer', description: 'Arrow Feather tables', path: '/data-explorers/feather-viewer' },
  { label: 'Parquet Viewer', description: 'Columnar schema and rows', path: '/data-explorers/parquet-viewer' },
  { label: 'ORC Viewer', description: 'ORC columnar files', path: '/data-explorers/orc-viewer' },
  { label: 'Delta Lake Viewer', description: 'Lakehouse versions and schema', path: '/data-explorers/delta-lake-viewer' }
];
