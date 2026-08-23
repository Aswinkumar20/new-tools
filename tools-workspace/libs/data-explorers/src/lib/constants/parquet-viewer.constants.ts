import type { PqRelatedToolLink } from '../types/parquet-viewer.types';

export const PQ_SUPPORTED_EXTENSIONS: ReadonlyArray<string> = ['.parquet', '.parq', '.json', '.csv', '.md', '.txt'];

export const PQ_ACCEPT_ATTR =
  '.parquet,.parq,.json,.csv,.md,.txt,application/vnd.apache.parquet,application/octet-stream,application/json,text/csv,text/plain,text/markdown';

export const PQ_FORMATS_LABEL = '.parquet, .parq, .json, .csv, .md, .txt';

export const PQ_FORMATS_HINT = 'Parquet schema, sample rows, and column profiling. Education/research only.';

export const PQ_MAX_FILE_BYTES = 32 * 1024 * 1024;

export const PQ_RELATED_TOOLS: ReadonlyArray<PqRelatedToolLink> = [
  { label: 'Avro Viewer', description: 'Avro schema and records', path: '/data-explorers/avro-viewer' },
  { label: 'ORC Viewer', description: 'ORC columnar files', path: '/data-explorers/orc-viewer' },
  { label: 'CSV Viewer', description: 'Delimited tables', path: '/data-explorers/csv-viewer' },
  { label: 'JSON Viewer', description: 'Structured JSON', path: '/data-explorers/json-viewer' }
];
