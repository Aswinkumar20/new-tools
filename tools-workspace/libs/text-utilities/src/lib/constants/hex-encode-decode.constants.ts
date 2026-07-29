import type { TuRelatedToolLink } from '../shared/tu-tool-suggestion.model';
import type {
  HexConversionMode,
  HexSeparatorChoice,
  HexSeparatorOption
} from '../types/hex-encode-decode.types';

export const HEX_DEFAULT_MODE: HexConversionMode = 'encode';
export const HEX_DEFAULT_SEPARATOR: HexSeparatorOption = 'space';

export const HEX_SEPARATOR_OPTIONS: ReadonlyArray<HexSeparatorChoice> = [
  { value: 'none', label: 'None' },
  { value: 'space', label: 'Space' },
  { value: 'colon', label: 'Colon' }
];

export const HEX_SEPARATOR_CHARS: Readonly<Record<HexSeparatorOption, string>> = {
  none: '',
  space: ' ',
  colon: ':'
};

export const HEX_RELATED_TOOLS: ReadonlyArray<TuRelatedToolLink> = [
  {
    label: 'Binary Text Converter',
    path: '/text-utilities/binary-text-converter',
    description: 'Convert the same text to 8-bit or 16-bit binary strings'
  },
  {
    label: 'Base64 Encoder & Decoder',
    path: '/text-utilities/base64-encode-and-decode',
    description: 'Encode UTF-8 payloads for JSON, HTML, or text-only channels'
  },
  {
    label: 'Text to ASCII',
    path: '/text-utilities/text-to-ascii',
    description: 'Inspect character codes alongside hex byte values'
  },
  {
    label: 'URL Encode & Decode',
    path: '/text-utilities/url-encode-and-decode',
    description: 'Percent-encode strings when hex is not the right transport format'
  }
];
