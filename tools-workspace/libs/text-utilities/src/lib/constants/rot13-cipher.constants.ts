import type { TuRelatedToolLink } from '../shared/tu-tool-suggestion.model';
import type { Rot13CipherMode } from '../types/rot13-cipher.types';

export const ROT13_DEFAULT_MODE: Rot13CipherMode = 'rot13';
export const ROT13_DEFAULT_CAESAR_SHIFT = 3;
export const ROT13_MIN_CAESAR_SHIFT = 1;
export const ROT13_MAX_CAESAR_SHIFT = 25;

export const ROT13_RELATED_TOOLS: ReadonlyArray<TuRelatedToolLink> = [
  {
    label: 'Morse Code Converter',
    path: '/text-utilities/morse-code-converter',
    description: 'Encode the same message as dots and dashes',
  },
  {
    label: 'Binary Text Converter',
    path: '/text-utilities/binary-text-converter',
    description: 'Convert letters to binary bit strings',
  },
  {
    label: 'Hex Encoder & Decoder',
    path: '/text-utilities/hex-encode-decode',
    description: 'Encode UTF-8 bytes as hexadecimal',
  },
  {
    label: 'Base64 Encode & Decode',
    path: '/text-utilities/base64-encode-and-decode',
    description: 'Stronger, reversible text encoding for transport',
  },
];
