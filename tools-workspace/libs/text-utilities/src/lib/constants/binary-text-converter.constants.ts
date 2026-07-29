import type { TuRelatedToolLink } from '../shared/tu-tool-suggestion.model';
import type {
  BinaryBitWidth,
  BinaryConversionMode,
  BinarySeparatorChoice,
  BinarySeparatorOption
} from '../types/binary-text-converter.types';

export const BINARY_DEFAULT_MODE: BinaryConversionMode = 'encode';
export const BINARY_DEFAULT_SEPARATOR: BinarySeparatorOption = 'space';
export const BINARY_DEFAULT_BITS: BinaryBitWidth = 8;

export const BINARY_SEPARATOR_OPTIONS: ReadonlyArray<BinarySeparatorChoice> = [
  { value: 'none', label: 'None' },
  { value: 'space', label: 'Space' },
  { value: 'colon', label: 'Colon' }
];

export const BINARY_SEPARATOR_CHARS: Readonly<Record<BinarySeparatorOption, string>> = {
  none: '',
  space: ' ',
  colon: ':'
};

export const BINARY_RELATED_TOOLS: ReadonlyArray<TuRelatedToolLink> = [
  {
    label: 'Hex Encode / Decode',
    path: '/text-utilities/hex-encode-decode',
    description: 'Convert the same text to hex bytes with optional separators'
  },
  {
    label: 'Base64 Encoder & Decoder',
    path: '/text-utilities/base64-encode-and-decode',
    description: 'Encode UTF-8 payloads for JSON, HTML, or text-only channels'
  },
  {
    label: 'Text to ASCII',
    path: '/text-utilities/text-to-ascii',
    description: 'Inspect character codes alongside binary representations'
  },
  {
    label: 'URL Encode & Decode',
    path: '/text-utilities/url-encode-and-decode',
    description: 'Percent-encode strings for query params after decoding binary'
  }
];
