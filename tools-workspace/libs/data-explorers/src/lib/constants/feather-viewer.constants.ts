import type { FtRelatedToolLink } from '../types/feather-viewer.types';

export const FT_SUPPORTED_EXTENSIONS: ReadonlyArray<string> = ['.feather', '.arrow', '.ipc', '.json', '.csv', '.md', '.txt'];

export const FT_ACCEPT_ATTR =
  '.feather,.arrow,.ipc,.json,.csv,.md,.txt,application/octet-stream,application/vnd.apache.arrow.file,application/json,text/csv,text/plain,text/markdown';

export const FT_FORMATS_LABEL = '.feather, .arrow, .json, .csv, .md, .txt';

export const FT_FORMATS_HINT = 'Feather / Arrow table schema and preview. Education/research only.';

export const FT_MAX_FILE_BYTES = 32 * 1024 * 1024;

export const FT_RELATED_TOOLS: ReadonlyArray<FtRelatedToolLink> = [
  { label: 'Arrow Viewer', description: 'Arrow IPC tables', path: '/data-explorers/arrow-viewer' },
  { label: 'Parquet Viewer', description: 'Columnar schema and rows', path: '/data-explorers/parquet-viewer' },
  { label: 'ORC Viewer', description: 'ORC columnar files', path: '/data-explorers/orc-viewer' },
  { label: 'CSV Viewer', description: 'Delimited tables', path: '/data-explorers/csv-viewer' }
];
