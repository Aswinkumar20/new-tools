import type { TuRelatedToolLink } from '../shared/tu-tool-suggestion.model';

export const BASE64_MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

export const BASE64_ENCODE_ERROR = 'Invalid input for encoding.';
export const BASE64_DECODE_ERROR = 'Invalid Base64 string. Check padding and characters.';

export const BASE64_UPLOAD_ACCEPT =
  '.txt,.text,.b64,.md,.json,.xml,.csv,.log,text/*,application/json,application/xml';

export const BASE64_BLOCKED_MIME_PREFIXES: ReadonlyArray<string> = [
  'image/',
  'video/',
  'audio/',
  'application/pdf',
  'application/zip',
  'application/x-zip-compressed'
];

export const BASE64_ALLOWED_MIME_TYPES: ReadonlySet<string> = new Set([
  'application/json',
  'application/xml',
  'application/javascript',
  'application/x-yaml',
  'application/yaml',
  'application/csv',
  'application/rtf',
  'application/octet-stream'
]);

export const BASE64_TEXT_EXTENSIONS: ReadonlySet<string> = new Set([
  'txt',
  'text',
  'b64',
  'base64',
  'md',
  'markdown',
  'csv',
  'json',
  'xml',
  'html',
  'htm',
  'log',
  'yaml',
  'yml',
  'rtf',
  'tsv',
  'ini',
  'cfg',
  'conf'
]);

export const BASE64_RELATED_TOOLS: ReadonlyArray<TuRelatedToolLink> = [
  {
    label: 'URL Encode & Decode',
    path: '/text-utilities/url-encode-and-decode',
    description: 'Percent-encode strings for query params and URLs'
  },
  {
    label: 'Hex Encode / Decode',
    path: '/text-utilities/hex-encode-decode',
    description: 'Convert between text and hexadecimal bytes'
  },
  {
    label: 'JWT Decoder',
    path: '/testing-tools/jwt-decoder',
    description: 'Inspect Base64URL segments inside JSON Web Tokens'
  },
  {
    label: 'JSON Formatter',
    path: '/data-converters/json-formatter-beautifier-validator',
    description: 'Pretty-print JSON after decoding a Base64 payload'
  }
];
