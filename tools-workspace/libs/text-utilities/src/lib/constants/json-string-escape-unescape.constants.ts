import type { TuRelatedToolLink } from '../shared/tu-tool-suggestion.model';
import type { JsonStringConversionMode } from '../types/json-string-escape-unescape.types';

export const JSON_STRING_DEFAULT_MODE: JsonStringConversionMode = 'encode';

export const JSON_STRING_RELATED_TOOLS: ReadonlyArray<TuRelatedToolLink> = [
  {
    label: 'JSON Formatter / Validator',
    path: '/data-converters/json-formatter-beautifier-validator',
    description: 'Format or validate full JSON documents after escaping strings'
  },
  {
    label: 'Unicode Escape / Unescape',
    path: '/text-utilities/unicode-escape-unescape',
    description: 'Work with \\u escapes outside of JSON string context'
  },
  {
    label: 'Base64 Encoder & Decoder',
    path: '/text-utilities/base64-encode-and-decode',
    description: 'Encode payloads when JSON string escaping is not enough'
  },
  {
    label: 'URL Encode & Decode',
    path: '/text-utilities/url-encode-and-decode',
    description: 'Percent-encode strings for URLs instead of JSON literals'
  }
];
