import type { TuToolSuggestion } from '../shared/tu-tool-suggestion.model';
import { TEXT_TO_ASCII_FORMAT_OPTIONS } from '../constants/text-to-ascii.constants';
import type {
  TextToAsciiConversionOptions,
  TextToAsciiConversionResult,
  TextToAsciiFormat,
  TextToAsciiSuggestionContext,
} from '../types/text-to-ascii.types';

export function isTextToAsciiFormat(type: string): type is TextToAsciiFormat {
  return TEXT_TO_ASCII_FORMAT_OPTIONS.some((opt) => opt.value === type);
}

export function textToAsciiCodes(text: string): string {
  if (!text) return '';
  return text
    .split('')
    .map((c) => c.charCodeAt(0))
    .join(' ');
}

export function asciiCodesToText(ascii: string): string {
  if (!ascii || !ascii.trim()) {
    throw new Error('ASCII input cannot be empty.');
  }
  const trimmed = ascii.trim();
  const parts = trimmed.split(/\s+/).filter((p) => p.length > 0);

  if (parts.length === 0) {
    throw new Error('ASCII input must contain at least one number.');
  }

  if (!parts.every((p) => /^\d+$/.test(p))) {
    throw new Error(
      'ASCII must contain only numbers separated by spaces (e.g., "72 101 108 108 111").'
    );
  }

  const invalidCodes = parts.filter((p) => {
    const num = Number(p);
    return isNaN(num) || num < 0 || num > 65535;
  });

  if (invalidCodes.length > 0) {
    throw new Error(
      `Invalid ASCII code(s): ${invalidCodes.join(', ')}. Codes must be between 0 and 65535.`
    );
  }

  return parts.map((p) => String.fromCharCode(Number(p))).join('');
}

export function textToBinaryCodes(text: string): string {
  return text
    .split('')
    .map((c) => c.charCodeAt(0).toString(2).padStart(8, '0'))
    .join(' ');
}

export function binaryCodesToText(binary: string): string {
  if (!binary || !binary.trim()) {
    throw new Error('Binary input cannot be empty.');
  }
  const trimmed = binary.trim();
  const parts = trimmed.split(/\s+/).filter((p) => p.length > 0);

  if (parts.length === 0) {
    throw new Error('Binary input must contain at least one binary number.');
  }

  if (!parts.every((b) => /^[01]+$/.test(b))) {
    throw new Error(
      'Binary must contain only 0s and 1s, separated by spaces (e.g., "01001000 01100101").'
    );
  }

  try {
    return parts
      .map((b) => {
        const charCode = parseInt(b, 2);
        if (isNaN(charCode) || charCode < 0 || charCode > 65535) {
          throw new Error(`Invalid binary value: ${b}`);
        }
        return String.fromCharCode(charCode);
      })
      .join('');
  } catch (e: unknown) {
    const message =
      e instanceof Error
        ? e.message
        : 'Invalid binary format. Each binary number should represent a valid character code.';
    throw new Error(message);
  }
}

export function textToHexCodes(text: string): string {
  return text
    .split('')
    .map((c) => c.charCodeAt(0).toString(16).padStart(2, '0'))
    .join(' ');
}

export function hexCodesToText(hex: string): string {
  if (!hex || !hex.trim()) {
    throw new Error('Hexadecimal input cannot be empty.');
  }
  const trimmed = hex.trim();
  const parts = trimmed.split(/\s+/).filter((p) => p.length > 0);

  if (parts.length === 0) {
    throw new Error('Hexadecimal input must contain at least one hex value.');
  }

  if (!parts.every((h) => /^[0-9a-fA-F]+$/.test(h))) {
    throw new Error(
      'Hexadecimal must contain only 0-9 and A-F (case-insensitive), separated by spaces (e.g., "48 65 6C 6C 6F").'
    );
  }

  try {
    return parts
      .map((h) => {
        const charCode = parseInt(h, 16);
        if (isNaN(charCode) || charCode < 0 || charCode > 65535) {
          throw new Error(`Invalid hex value: ${h}`);
        }
        return String.fromCharCode(charCode);
      })
      .join('');
  } catch (e: unknown) {
    const message =
      e instanceof Error
        ? e.message
        : 'Invalid hexadecimal format. Each hex value should represent a valid character code.';
    throw new Error(message);
  }
}

function decodeToText(input: string, leftType: TextToAsciiFormat): string {
  switch (leftType) {
    case 'text':
      return input;
    case 'ascii':
      return asciiCodesToText(input);
    case 'binary':
      return binaryCodesToText(input);
    case 'hex':
      return hexCodesToText(input);
  }
}

function encodeFromText(text: string, rightType: TextToAsciiFormat): string {
  switch (rightType) {
    case 'text':
      return text;
    case 'ascii':
      return textToAsciiCodes(text);
    case 'binary':
      return textToBinaryCodes(text);
    case 'hex':
      return textToHexCodes(text);
  }
}

/**
 * Convert between text / ASCII codes / binary / hex.
 * Input is trimmed (same as the original component).
 */
export function convertTextToAsciiFormats(
  options: TextToAsciiConversionOptions
): TextToAsciiConversionResult {
  const raw = options.input ?? '';
  const trimmed = raw.trim();

  if (!trimmed) {
    return { output: '' };
  }

  if (options.leftType === options.rightType) {
    return { output: trimmed };
  }

  if (!isTextToAsciiFormat(options.leftType) || !isTextToAsciiFormat(options.rightType)) {
    throw new Error('Invalid conversion type selected.');
  }

  const text = decodeToText(trimmed, options.leftType);
  if (text === null || text === undefined) {
    throw new Error('Failed to convert input to text. Please check your input format.');
  }

  return { output: encodeFromText(text, options.rightType) };
}

export function inputLooksLikeAsciiCodes(value: string): boolean {
  const parts = value.trim().split(/\s+/).filter((p) => p.length > 0);
  return parts.length > 0 && parts.every((p) => /^\d+$/.test(p));
}

export function inputLooksLikeBinaryCodes(value: string): boolean {
  const parts = value.trim().split(/\s+/).filter((p) => p.length > 0);
  return parts.length > 0 && parts.every((p) => /^[01]+$/.test(p));
}

export function inputLooksLikeHexCodes(value: string): boolean {
  const parts = value.trim().split(/\s+/).filter((p) => p.length > 0);
  return parts.length > 0 && parts.every((p) => /^[0-9a-fA-F]+$/.test(p));
}

export function resolveTextToAsciiSuggestion(
  context: TextToAsciiSuggestionContext
): TuToolSuggestion | null {
  const {
    hasInput,
    hasOutput,
    hasError,
    leftType,
    rightType,
    inputLooksLikeAscii,
    inputLooksLikeBinary,
    inputLooksLikeHex,
  } = context;

  if (!hasInput) {
    return {
      id: 'tta-get-started',
      title: 'Convert text, ASCII, binary, or hex?',
      reason:
        'Pick From/To in the sidebar. Paste text for codes, or paste space-separated codes (e.g. 72 101) to decode.',
      actionLabel: 'Open Binary Text Converter',
      path: '/text-utilities/binary-text-converter',
    };
  }

  if (hasError) {
    return {
      id: 'tta-format-error',
      title: 'Input does not match the From format',
      reason:
        'ASCII needs space-separated numbers, binary needs 0/1 groups, hex needs 0–9/A–F. Adjust From, or use Swap after fixing the value.',
      actionLabel: 'Open Hex Encoder & Decoder',
      path: '/text-utilities/hex-encode-decode',
    };
  }

  if (leftType === rightType) {
    return {
      id: 'tta-same-format',
      title: 'From and To are the same',
      reason:
        'Output mirrors the trimmed input. Change To (ASCII, Binary, or Hex) to encode, or Swap after converting.',
      actionLabel: 'Open Base64 Encode & Decode',
      path: '/text-utilities/base64-encode-and-decode',
    };
  }

  // Prefer binary (0/1) over digit ASCII — binary tokens also match /^\d+$/.
  if (leftType === 'text' && inputLooksLikeBinary && rightType !== 'binary') {
    return {
      id: 'tta-maybe-binary-input',
      title: 'Input looks like binary',
      reason:
        'Groups of 0s and 1s detected. Set From to Binary to decode, or open the dedicated Binary Text Converter.',
      actionLabel: 'Open Binary Text Converter',
      path: '/text-utilities/binary-text-converter',
    };
  }

  if (
    leftType === 'text' &&
    inputLooksLikeAscii &&
    !inputLooksLikeBinary &&
    rightType === 'ascii'
  ) {
    return {
      id: 'tta-maybe-ascii-input',
      title: 'Input looks like ASCII codes',
      reason:
        'Space-separated numbers usually mean From should be ASCII. Switch From to ASCII to decode into text.',
      actionLabel: 'Open Hex Encoder & Decoder',
      path: '/text-utilities/hex-encode-decode',
    };
  }

  if (
    leftType === 'text' &&
    inputLooksLikeHex &&
    !inputLooksLikeAscii &&
    !inputLooksLikeBinary &&
    rightType !== 'hex'
  ) {
    return {
      id: 'tta-maybe-hex-input',
      title: 'Input looks like hex codes',
      reason:
        'Space-separated hex tokens detected. Set From to Hex to decode, or use Hex Encoder & Decoder for UTF-8 byte hex.',
      actionLabel: 'Open Hex Encoder & Decoder',
      path: '/text-utilities/hex-encode-decode',
    };
  }

  if (hasOutput && leftType === 'text') {
    return {
      id: 'tta-encoded',
      title: `Encoded to ${rightType.toUpperCase()}`,
      reason:
        'Copy or download the result, use → In to keep transforming, or Swap to decode back to text.',
      actionLabel: 'Open Base64 Encode & Decode',
      path: '/text-utilities/base64-encode-and-decode',
    };
  }

  if (hasOutput && rightType === 'text') {
    return {
      id: 'tta-decoded',
      title: 'Decoded to text',
      reason:
        'Readable text is ready. Swap to re-encode, or try Morse / Base64 for other representations.',
      actionLabel: 'Open Morse Code Converter',
      path: '/text-utilities/morse-code-converter',
    };
  }

  if (hasOutput) {
    return {
      id: 'tta-converted',
      title: 'Conversion ready',
      reason: `Converted ${leftType} → ${rightType}. Use → In or Swap to chain another format.`,
      actionLabel: 'Open Binary Text Converter',
      path: '/text-utilities/binary-text-converter',
    };
  }

  return {
    id: 'tta-ready',
    title: 'Ready to convert',
    reason:
      'Type or upload a value. Conversion runs after a short pause while you type.',
    actionLabel: 'Open Hex Encoder & Decoder',
    path: '/text-utilities/hex-encode-decode',
  };
}
