import type { AvRelatedToolLink } from '../types/avro-viewer.types';

export const AV_SUPPORTED_EXTENSIONS: ReadonlyArray<string> = ['.avro', '.avsc', '.json', '.md', '.txt'];

export const AV_ACCEPT_ATTR =
  '.avro,.avsc,.json,.md,.txt,application/avro,application/octet-stream,application/json,text/plain,text/markdown';

export const AV_FORMATS_LABEL = '.avro, .avsc, .json, .md, .txt';

export const AV_FORMATS_HINT = 'Avro schema and sample records. Education/research only.';

export const AV_MAX_FILE_BYTES = 32 * 1024 * 1024;

export const AV_RELATED_TOOLS: ReadonlyArray<AvRelatedToolLink> = [
  { label: 'Parquet Viewer', description: 'Columnar schema and rows', path: '/data-explorers/parquet-viewer' },
  { label: 'JSON Viewer', description: 'Structured JSON', path: '/data-explorers/json-viewer' },
  { label: 'Feather Viewer', description: 'Arrow Feather tables', path: '/data-explorers/feather-viewer' },
  { label: 'XML Viewer', description: 'XML trees', path: '/data-explorers/xml-viewer' }
];
