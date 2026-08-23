import type { DkRelatedToolLink } from '../types/duckdb-viewer.types';

export const DK_SUPPORTED_EXTENSIONS: ReadonlyArray<string> = ['.duckdb', '.ddb', '.sql', '.json', '.csv', '.md', '.txt'];

export const DK_ACCEPT_ATTR =
  '.duckdb,.ddb,.sql,.json,.csv,.md,.txt,application/octet-stream,application/vnd.duckdb,application/json,text/sql,text/csv,text/plain,text/markdown';

export const DK_FORMATS_LABEL = '.duckdb, .ddb, .sql, .json, .csv, .md, .txt';

export const DK_FORMATS_HINT = 'DuckDB tables, schema, and preview rows. Education/research only.';

export const DK_MAX_FILE_BYTES = 32 * 1024 * 1024;

export const DK_RELATED_TOOLS: ReadonlyArray<DkRelatedToolLink> = [
  { label: 'SQLite Viewer', description: 'Embedded SQL tables', path: '/data-explorers/sqlite-viewer' },
  { label: 'Parquet Viewer', description: 'Columnar schema and rows', path: '/data-explorers/parquet-viewer' },
  { label: 'Arrow Viewer', description: 'Arrow IPC tables', path: '/data-explorers/arrow-viewer' },
  { label: 'CSV Viewer', description: 'Delimited tables', path: '/data-explorers/csv-viewer' }
];
