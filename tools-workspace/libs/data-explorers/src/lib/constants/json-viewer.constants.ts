import type { JnRelatedToolLink } from '../types/json-viewer.types';

export const JN_SUPPORTED_EXTENSIONS: ReadonlyArray<string> = ['.json', '.jsonl', '.ndjson', '.txt', '.csv', '.md'];

export const JN_ACCEPT_ATTR =
  '.json,.jsonl,.ndjson,.txt,.csv,.md,application/json,application/x-ndjson,text/plain,text/csv,text/markdown';

export const JN_FORMATS_LABEL = '.json, .jsonl, .csv, .md, .txt';

export const JN_FORMATS_HINT = 'JSON tree, search, schema, and table preview. Education/research only.';

export const JN_MAX_FILE_BYTES = 32 * 1024 * 1024;

export const JN_RELATED_TOOLS: ReadonlyArray<JnRelatedToolLink> = [
  { label: 'XML Viewer', description: 'XML nodes and attributes', path: '/data-explorers/xml-viewer' },
  { label: 'YAML Viewer', description: 'YAML structure', path: '/data-explorers/yaml-viewer' },
  { label: 'CSV Viewer', description: 'Delimited tables', path: '/data-explorers/csv-viewer' },
  { label: 'SQLite Viewer', description: 'Embedded SQL tables', path: '/data-explorers/sqlite-viewer' }
];
