import type { BuRelatedToolLink } from '../shared/bu-tool-suggestion.model';
import type { StorageType } from '../types/storage-viewer.types';

export const STORAGE_DEFAULT_TYPE: StorageType = 'local';

export const STORAGE_BYTE_UNITS = ['B', 'KB', 'MB', 'GB', 'TB'] as const;

export const STORAGE_RELATED_TOOLS: ReadonlyArray<BuRelatedToolLink> = [
  {
    label: 'Cookie Editor',
    path: '/browser-utils/cookie-editor',
    description: 'Inspect and edit document cookies'
  },
  {
    label: 'JWT Decoder',
    path: '/testing-tools/jwt-decoder',
    description: 'Decode token-like storage values'
  },
  {
    label: 'Base64 Encode / Decode',
    path: '/text-utilities/base64-encode-and-decode',
    description: 'Decode encoded storage payloads'
  },
  {
    label: 'JSON Formatter',
    path: '/data-converters/json-formatter-beautifier-validator',
    description: 'Pretty-print JSON stored in Web Storage'
  }
];
