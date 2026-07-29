import type { TuToolSuggestion } from '../shared/tu-tool-suggestion.model';
import { hexEncode, hexDecode } from '../shared/text-transform.utils';
import { HEX_SEPARATOR_CHARS } from '../constants/hex-encode-decode.constants';
import type {
  HexConversionOptions,
  HexConversionResult,
  HexSeparatorOption,
  HexSuggestionContext
} from '../types/hex-encode-decode.types';

export function separatorCharForHexOption(separator: HexSeparatorOption): string {
  return HEX_SEPARATOR_CHARS[separator];
}

export function convertHexText(options: HexConversionOptions): HexConversionResult {
  const { mode, inputText, separator } = options;
  if (!inputText) {
    return { output: '', errorMessage: '' };
  }

  try {
    if (mode === 'encode') {
      return {
        output: hexEncode(inputText, separatorCharForHexOption(separator)),
        errorMessage: ''
      };
    }
    return {
      output: hexDecode(inputText),
      errorMessage: ''
    };
  } catch (error) {
    return {
      output: '',
      errorMessage: (error as Error).message || 'Processing failed.'
    };
  }
}

/** Heuristic: mostly hex digits with optional common separators. */
export function inputLooksLikeHex(value: string): boolean {
  const trimmed = value.trim();
  if (trimmed.length < 2) {
    return false;
  }
  const cleaned = trimmed.replace(/[^0-9a-fA-F]/g, '');
  if (cleaned.length < 2 || cleaned.length % 2 !== 0) {
    return false;
  }
  const nonHexRatio = (trimmed.length - cleaned.length) / trimmed.length;
  return nonHexRatio <= 0.4 && /^[0-9a-fA-F\s:.\-_|,]+$/.test(trimmed);
}

export function resolveHexSuggestion(context: HexSuggestionContext): TuToolSuggestion | null {
  const { mode, hasInput, hasOutput, errorMessage, inputLooksLikeHex: looksHex } = context;

  if (!hasInput) {
    return {
      id: 'hex-get-started',
      title: 'Encode or decode hex?',
      reason:
        'Paste text to encode into UTF-8 hex bytes, or hex pairs to decode. Separators are for readability only.',
      actionLabel: 'Open Binary Text Converter',
      path: '/text-utilities/binary-text-converter'
    };
  }

  if (errorMessage) {
    return {
      id: 'hex-error',
      title: 'Could not decode hex',
      reason:
        errorMessage.includes('length')
          ? 'After stripping separators, hex length must be even. Check for a missing digit or extra character.'
          : errorMessage,
      actionLabel: 'Open Binary Text Converter',
      path: '/text-utilities/binary-text-converter'
    };
  }

  if (mode === 'encode' && looksHex) {
    return {
      id: 'hex-looks-hex',
      title: 'Input looks like hex already',
      reason:
        'You are in Encode mode, but this string is mostly hex pairs. Switch to Decode to restore UTF-8 text.',
      actionLabel: 'Open Base64 Encoder & Decoder',
      path: '/text-utilities/base64-encode-and-decode'
    };
  }

  if (hasOutput && mode === 'decode') {
    return {
      id: 'hex-decoded',
      title: 'Decoded successfully',
      reason:
        'Inspect character codes with Text to ASCII, or convert the same payload to binary/Base64 next.',
      actionLabel: 'Open Text to ASCII',
      path: '/text-utilities/text-to-ascii'
    };
  }

  if (hasOutput && mode === 'encode') {
    return {
      id: 'hex-encoded',
      title: 'Encoded successfully',
      reason:
        'Bytes are lowercase hex pairs. Compare with binary for bit-level views, or Base64 for compact transport.',
      actionLabel: 'Open Binary Text Converter',
      path: '/text-utilities/binary-text-converter'
    };
  }

  return {
    id: 'hex-ready',
    title: 'Ready to convert',
    reason: 'Keep typing — conversion updates live. Upload a text file when the payload is large.',
    actionLabel: 'Open Base64 Encoder & Decoder',
    path: '/text-utilities/base64-encode-and-decode'
  };
}
