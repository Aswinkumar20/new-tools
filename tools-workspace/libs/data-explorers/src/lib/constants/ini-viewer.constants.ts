import type { InRelatedToolLink } from '../types/ini-viewer.types';

export const IN_SUPPORTED_EXTENSIONS: ReadonlyArray<string> = ['.ini', '.cfg', '.conf', '.txt', '.json', '.csv', '.md'];

export const IN_ACCEPT_ATTR =
  '.ini,.cfg,.conf,.txt,.json,.csv,.md,text/plain,application/json,text/csv,text/markdown';

export const IN_FORMATS_LABEL = '.ini, .cfg, .conf, .json, .csv, .md, .txt';

export const IN_FORMATS_HINT = 'INI sections, keys, and preview rows. Education/research only.';

export const IN_MAX_FILE_BYTES = 32 * 1024 * 1024;

export const IN_RELATED_TOOLS: ReadonlyArray<InRelatedToolLink> = [
  { label: 'TOML Viewer', description: 'TOML tables and keys', path: '/data-explorers/toml-viewer' },
  { label: 'YAML Viewer', description: 'YAML tree and validate', path: '/data-explorers/yaml-viewer' },
  { label: 'JSON Viewer', description: 'Structured JSON tree', path: '/data-explorers/json-viewer' },
  { label: 'CSV Viewer', description: 'Delimited tables', path: '/data-explorers/csv-viewer' }
];
