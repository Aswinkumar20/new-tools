import type { OrcRelatedToolLink } from '../types/orc-viewer.types';

export const ORC_SUPPORTED_EXTENSIONS: ReadonlyArray<string> = ['.orc', '.json', '.csv', '.md', '.txt'];

export const ORC_ACCEPT_ATTR =
  '.orc,.json,.csv,.md,.txt,application/octet-stream,application/json,text/csv,text/plain,text/markdown';

export const ORC_FORMATS_LABEL = '.orc, .json, .csv, .md, .txt';

export const ORC_FORMATS_HINT = 'ORC schema and preview rows. Education/research only.';

export const ORC_MAX_FILE_BYTES = 32 * 1024 * 1024;

export const ORC_RELATED_TOOLS: ReadonlyArray<OrcRelatedToolLink> = [
  { label: 'Parquet Viewer', description: 'Columnar schema and rows', path: '/data-explorers/parquet-viewer' },
  { label: 'Avro Viewer', description: 'Avro schema and records', path: '/data-explorers/avro-viewer' },
  { label: 'Feather Viewer', description: 'Arrow Feather tables', path: '/data-explorers/feather-viewer' },
  { label: 'Arrow Viewer', description: 'Arrow IPC tables', path: '/data-explorers/arrow-viewer' }
];
