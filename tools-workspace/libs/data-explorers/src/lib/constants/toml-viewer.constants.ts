import type { TmRelatedToolLink } from '../types/toml-viewer.types';

export const TM_SUPPORTED_EXTENSIONS: ReadonlyArray<string> = ['.toml', '.txt', '.json', '.csv', '.md'];

export const TM_ACCEPT_ATTR =
  '.toml,.txt,.json,.csv,.md,application/toml,text/plain,application/json,text/csv,text/markdown';

export const TM_FORMATS_LABEL = '.toml, .json, .csv, .md, .txt';

export const TM_FORMATS_HINT = 'TOML tables, keys, and preview rows. Education/research only.';

export const TM_MAX_FILE_BYTES = 32 * 1024 * 1024;

export const TM_RELATED_TOOLS: ReadonlyArray<TmRelatedToolLink> = [
  { label: 'YAML Viewer', description: 'YAML tree and validate', path: '/data-explorers/yaml-viewer' },
  { label: 'JSON Viewer', description: 'Structured JSON tree', path: '/data-explorers/json-viewer' },
  { label: 'INI Viewer', description: 'INI sections and keys', path: '/data-explorers/ini-viewer' },
  { label: 'CSV Viewer', description: 'Delimited tables', path: '/data-explorers/csv-viewer' }
];
