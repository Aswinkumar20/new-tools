import type { YlRelatedToolLink } from '../types/yaml-viewer.types';

export const YL_SUPPORTED_EXTENSIONS: ReadonlyArray<string> = ['.yaml', '.yml', '.txt', '.json', '.csv', '.md'];

export const YL_ACCEPT_ATTR =
  '.yaml,.yml,.txt,.json,.csv,.md,text/yaml,application/yaml,text/plain,application/json,text/csv,text/markdown';

export const YL_FORMATS_LABEL = '.yaml, .yml, .json, .csv, .md, .txt';

export const YL_FORMATS_HINT = 'YAML tree, validation, and table preview. Education/research only.';

export const YL_MAX_FILE_BYTES = 32 * 1024 * 1024;

export const YL_RELATED_TOOLS: ReadonlyArray<YlRelatedToolLink> = [
  { label: 'JSON Viewer', description: 'Structured JSON tree', path: '/data-explorers/json-viewer' },
  { label: 'TOML Viewer', description: 'TOML tables and keys', path: '/data-explorers/toml-viewer' },
  { label: 'XML Viewer', description: 'XML nodes and attributes', path: '/data-explorers/xml-viewer' },
  { label: 'CSV Viewer', description: 'Delimited tables', path: '/data-explorers/csv-viewer' }
];
