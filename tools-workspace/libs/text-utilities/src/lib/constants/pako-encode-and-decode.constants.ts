import type { TuRelatedToolLink } from '../shared/tu-tool-suggestion.model';
import type {
  PakoBinaryEncoding,
  PakoConversionMode,
  PakoFormat
} from '../types/pako-encode-and-decode.types';

export const PAKO_DEFAULT_MODE: PakoConversionMode = 'encode';
export const PAKO_DEFAULT_FORMAT: PakoFormat = 'deflate';
export const PAKO_DEFAULT_ENCODING: PakoBinaryEncoding = 'base64';
export const PAKO_DEFAULT_LEVEL = 6;
export const PAKO_MIN_LEVEL = 0;
export const PAKO_MAX_LEVEL = 9;

export const PAKO_RELATED_TOOLS: ReadonlyArray<TuRelatedToolLink> = [
  {
    label: 'Base64 Encoder & Decoder',
    path: '/text-utilities/base64-encode-and-decode',
    description: 'Encode or decode Base64 without compression'
  },
  {
    label: 'Hex Encoder & Decoder',
    path: '/text-utilities/hex-encode-decode',
    description: 'Inspect or convert hex payloads used with Hex output mode'
  },
  {
    label: 'JSON String Escape & Unescape',
    path: '/text-utilities/json-string-escape-unescape',
    description: 'Escape decompressed text for JSON string literals'
  },
  {
    label: 'URL Encode & Decode',
    path: '/text-utilities/url-encode-and-decode',
    description: 'Percent-encode payloads for query strings or URLs'
  }
];
