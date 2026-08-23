import type { XmRelatedToolLink } from '../types/xml-viewer.types';

export const XM_SUPPORTED_EXTENSIONS: ReadonlyArray<string> = ['.xml', '.txt', '.json', '.csv', '.md'];

export const XM_ACCEPT_ATTR =
  '.xml,.txt,.json,.csv,.md,application/xml,text/xml,text/plain,application/json,text/csv,text/markdown';

export const XM_FORMATS_LABEL = '.xml, .json, .csv, .md, .txt';

export const XM_FORMATS_HINT = 'XML nodes, attributes, and preview rows. Education/research only.';

export const XM_MAX_FILE_BYTES = 32 * 1024 * 1024;

export const XM_RELATED_TOOLS: ReadonlyArray<XmRelatedToolLink> = [
  { label: 'JSON Viewer', description: 'Structured JSON tree', path: '/data-explorers/json-viewer' },
  { label: 'YAML Viewer', description: 'YAML structure', path: '/data-explorers/yaml-viewer' },
  { label: 'CSV Viewer', description: 'Delimited tables', path: '/data-explorers/csv-viewer' },
  { label: 'SQLite Viewer', description: 'Embedded SQL tables', path: '/data-explorers/sqlite-viewer' }
];
