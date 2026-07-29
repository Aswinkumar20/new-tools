import type { TuRelatedToolLink } from '../shared/tu-tool-suggestion.model';
import type {
  TextToAsciiFormat,
  TextToAsciiFormatOption,
} from '../types/text-to-ascii.types';

export const TEXT_TO_ASCII_DEFAULT_LEFT: TextToAsciiFormat = 'text';
export const TEXT_TO_ASCII_DEFAULT_RIGHT: TextToAsciiFormat = 'ascii';
export const TEXT_TO_ASCII_DEBOUNCE_MS = 300;
export const TEXT_TO_ASCII_MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

export const TEXT_TO_ASCII_FORMAT_OPTIONS: ReadonlyArray<TextToAsciiFormatOption> = [
  { value: 'text', label: 'Text', description: 'Plain readable text.' },
  { value: 'ascii', label: 'ASCII', description: 'ASCII codes representing each character.' },
  { value: 'binary', label: 'Binary', description: 'Binary representation (0s and 1s) of text.' },
  { value: 'hex', label: 'Hex', description: 'Hexadecimal representation of text.' },
];

export const TEXT_TO_ASCII_RELATED_TOOLS: ReadonlyArray<TuRelatedToolLink> = [
  {
    label: 'Binary Text Converter',
    path: '/text-utilities/binary-text-converter',
    description: 'Dedicated binary encode/decode with more options',
  },
  {
    label: 'Hex Encoder & Decoder',
    path: '/text-utilities/hex-encode-decode',
    description: 'UTF-8 hex encoding for transport and debugging',
  },
  {
    label: 'Base64 Encode & Decode',
    path: '/text-utilities/base64-encode-and-decode',
    description: 'Reversible encoding for APIs and payloads',
  },
  {
    label: 'Morse Code Converter',
    path: '/text-utilities/morse-code-converter',
    description: 'Encode the same message as dots and dashes',
  },
];
