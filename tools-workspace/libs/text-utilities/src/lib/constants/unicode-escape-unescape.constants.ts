import type { TuRelatedToolLink } from '../shared/tu-tool-suggestion.model';
import type { UnicodeEscapeConversionMode } from '../types/unicode-escape-unescape.types';

export const UNICODE_ESCAPE_DEFAULT_MODE: UnicodeEscapeConversionMode = 'encode';

export const UNICODE_ESCAPE_RELATED_TOOLS: ReadonlyArray<TuRelatedToolLink> = [
  {
    label: 'JSON String Escape / Unescape',
    path: '/text-utilities/json-string-escape-unescape',
    description: 'Escape quotes, newlines, and control chars for JSON string bodies',
  },
  {
    label: 'Invisible Character Detector',
    path: '/text-utilities/invisible-character-detector',
    description: 'Find zero-width and other hidden Unicode characters',
  },
  {
    label: 'Hex Encoder & Decoder',
    path: '/text-utilities/hex-encode-decode',
    description: 'Encode UTF-8 bytes as hexadecimal instead of \\u escapes',
  },
  {
    label: 'Text to ASCII Converter',
    path: '/text-utilities/text-to-ascii',
    description: 'Convert text to ASCII codes, binary, or hex tokens',
  },
];
