import type { SqRelatedToolLink } from '../types/sqlite-viewer.types';

export const SQ_SUPPORTED_EXTENSIONS: ReadonlyArray<string> = ['.sqlite', '.db', '.sqlite3', '.db3', '.sql', '.json', '.csv', '.md', '.txt'];

export const SQ_ACCEPT_ATTR =
  '.sqlite,.db,.sqlite3,.db3,.sql,.json,.csv,.md,.txt,application/octet-stream,application/vnd.sqlite3,application/x-sqlite3,application/json,text/sql,text/csv,text/plain,text/markdown';

export const SQ_FORMATS_LABEL = '.sqlite, .db, .sql, .json, .csv, .md, .txt';

export const SQ_FORMATS_HINT = 'SQLite tables, schema SQL, and preview rows. Education/research only.';

export const SQ_MAX_FILE_BYTES = 32 * 1024 * 1024;

export const SQ_RELATED_TOOLS: ReadonlyArray<SqRelatedToolLink> = [
  { label: 'DuckDB Viewer', description: 'Analytical database tables', path: '/data-explorers/duckdb-viewer' },
  { label: 'CSV Viewer', description: 'Delimited tables', path: '/data-explorers/csv-viewer' },
  { label: 'JSON Viewer', description: 'Structured JSON', path: '/data-explorers/json-viewer' },
  { label: 'Parquet Viewer', description: 'Columnar schema and rows', path: '/data-explorers/parquet-viewer' }
];
