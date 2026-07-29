import type { TuToolSuggestion } from '../shared/tu-tool-suggestion.model';
import { textToBinary, binaryToText } from '../shared/text-transform.utils';
import { BINARY_SEPARATOR_CHARS } from '../constants/binary-text-converter.constants';
import type {
  BinaryBitWidth,
  BinaryConversionOptions,
  BinaryConversionResult,
  BinarySeparatorOption,
  BinarySuggestionContext
} from '../types/binary-text-converter.types';

export function separatorCharForOption(separator: BinarySeparatorOption): string {
  return BINARY_SEPARATOR_CHARS[separator];
}

export function convertBinaryText(options: BinaryConversionOptions): BinaryConversionResult {
  const { mode, inputText, separator, bits } = options;
  if (!inputText) {
    return { output: '', errorMessage: '' };
  }

  try {
    if (mode === 'encode') {
      return {
        output: textToBinary(inputText, separatorCharForOption(separator), bits),
        errorMessage: ''
      };
    }
    return {
      output: binaryToText(inputText, bits),
      errorMessage: ''
    };
  } catch (error) {
    return {
      output: '',
      errorMessage: (error as Error).message || 'Processing failed.'
    };
  }
}

/** Heuristic: mostly 0/1 with optional common separators. */
export function inputLooksLikeBinary(value: string, bits: BinaryBitWidth): boolean {
  const trimmed = value.trim();
  if (trimmed.length < bits) {
    return false;
  }
  const cleaned = trimmed.replace(/[^01]/g, '');
  if (cleaned.length < bits || cleaned.length % bits !== 0) {
    return false;
  }
  const nonBinaryRatio = (trimmed.length - cleaned.length) / trimmed.length;
  return nonBinaryRatio <= 0.35 && /^[01\s:.\-_|,]+$/.test(trimmed);
}

export function resolveBinaryTextSuggestion(
  context: BinarySuggestionContext
): TuToolSuggestion | null {
  const { mode, hasInput, hasOutput, errorMessage, bits, inputLooksLikeBinary: looksBinary } =
    context;

  if (!hasInput) {
    return {
      id: 'btc-get-started',
      title: 'Convert text to binary?',
      reason:
        'Paste text to encode, or a 0/1 string to decode. Choose 8-bit (char codes) or 16-bit (code points).',
      actionLabel: 'Open Hex Encode / Decode',
      path: '/text-utilities/hex-encode-decode'
    };
  }

  if (errorMessage.includes('multiple of')) {
    return {
      id: 'btc-length',
      title: 'Binary length does not match bit width',
      reason: `After stripping separators, length must be a multiple of ${bits}. Try the other bit width or check for missing/extra bits.`,
      actionLabel: 'Open Hex Encode / Decode',
      path: '/text-utilities/hex-encode-decode'
    };
  }

  if (errorMessage) {
    return {
      id: 'btc-error',
      title: 'Could not convert binary',
      reason: errorMessage,
      actionLabel: 'Open Text to ASCII',
      path: '/text-utilities/text-to-ascii'
    };
  }

  if (mode === 'encode' && looksBinary) {
    return {
      id: 'btc-looks-binary',
      title: 'Input looks like binary already',
      reason:
        'You are in Encode mode, but this string is mostly 0/1 groups. Switch to Decode to restore text.',
      actionLabel: 'Open Hex Encode / Decode',
      path: '/text-utilities/hex-encode-decode'
    };
  }

  if (hasOutput && mode === 'decode') {
    return {
      id: 'btc-decoded',
      title: 'Decoded successfully',
      reason:
        'Inspect character codes with Text to ASCII, or convert the same payload to hex/Base64 next.',
      actionLabel: 'Open Text to ASCII',
      path: '/text-utilities/text-to-ascii'
    };
  }

  if (hasOutput && mode === 'encode') {
    return {
      id: 'btc-encoded',
      title: 'Encoded successfully',
      reason:
        'Separators are for readability only — decode strips them. Compare with hex if you need compact bytes.',
      actionLabel: 'Open Hex Encode / Decode',
      path: '/text-utilities/hex-encode-decode'
    };
  }

  return {
    id: 'btc-ready',
    title: 'Ready to convert',
    reason: 'Keep typing — conversion updates live. Upload a text file when the payload is large.',
    actionLabel: 'Open Base64 Encoder & Decoder',
    path: '/text-utilities/base64-encode-and-decode'
  };
}
