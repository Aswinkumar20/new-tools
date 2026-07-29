import type { TuRelatedToolLink } from '../shared/tu-tool-suggestion.model';
import type { MorseConversionMode } from '../types/morse-code-converter.types';

export const MORSE_DEFAULT_MODE: MorseConversionMode = 'encode';

export const MORSE_RELATED_TOOLS: ReadonlyArray<TuRelatedToolLink> = [
  {
    label: 'Binary Text Converter',
    path: '/text-utilities/binary-text-converter',
    description: 'Convert the same message to binary bit strings'
  },
  {
    label: 'Hex Encoder & Decoder',
    path: '/text-utilities/hex-encode-decode',
    description: 'Encode UTF-8 bytes as hexadecimal instead of Morse'
  },
  {
    label: 'ROT13 Cipher',
    path: '/text-utilities/rot13-cipher',
    description: 'A simple letter cipher for fun obfuscation'
  },
  {
    label: 'Text Case Convertor',
    path: '/text-utilities/text-case-convertor',
    description: 'Also includes Morse and NATO phonetic transforms'
  }
];
