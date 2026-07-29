import type { TuToolSuggestion } from '../shared/tu-tool-suggestion.model';
import {
  pakoCompress,
  pakoDecompress,
  type PakoBinaryEncoding,
  type PakoFormat
} from '../shared/pako-compression.utils';
import {
  PAKO_DEFAULT_LEVEL,
  PAKO_MAX_LEVEL,
  PAKO_MIN_LEVEL
} from '../constants/pako-encode-and-decode.constants';
import type {
  PakoConversionOptions,
  PakoConversionResult,
  PakoSuggestionContext
} from '../types/pako-encode-and-decode.types';

const emptyStatsResult = (errorMessage = ''): PakoConversionResult => ({
  output: '',
  errorMessage,
  inputBytes: 0,
  outputBytes: 0,
  compressionRatio: 0
});

export function clampPakoCompressionLevel(level: number): number {
  return Math.min(PAKO_MAX_LEVEL, Math.max(PAKO_MIN_LEVEL, Math.round(level)));
}

export function pakoFormatLabel(format: PakoFormat): string {
  switch (format) {
    case 'deflate':
      return 'Deflate';
    case 'deflateRaw':
      return 'Raw';
    case 'gzip':
      return 'Gzip';
    default:
      return format;
  }
}

export function convertPakoText(options: PakoConversionOptions): PakoConversionResult {
  const { mode, inputText, compressionFormat, binaryEncoding, compressionLevel } = options;
  if (!inputText) {
    return emptyStatsResult();
  }

  try {
    if (mode === 'encode') {
      const result = pakoCompress(
        inputText,
        compressionFormat,
        binaryEncoding,
        clampPakoCompressionLevel(compressionLevel ?? PAKO_DEFAULT_LEVEL)
      );
      return {
        output: result.output,
        errorMessage: '',
        inputBytes: result.inputBytes,
        outputBytes: result.outputBytes,
        compressionRatio: result.ratio
      };
    }

    return {
      output: pakoDecompress(inputText, compressionFormat, binaryEncoding),
      errorMessage: '',
      inputBytes: 0,
      outputBytes: 0,
      compressionRatio: 0
    };
  } catch (error) {
    return emptyStatsResult((error as Error).message || 'Compression failed.');
  }
}

/** Heuristic: Base64 or hex payload suitable for decompress mode. */
export function inputLooksLikePakoEncoded(
  value: string,
  encoding: PakoBinaryEncoding
): boolean {
  const trimmed = value.trim();
  if (trimmed.length < 8) {
    return false;
  }

  if (encoding === 'hex') {
    const cleaned = trimmed.replace(/[^0-9a-fA-F]/g, '');
    if (cleaned.length < 8 || cleaned.length % 2 !== 0) {
      return false;
    }
    const nonHexRatio = (trimmed.length - cleaned.length) / trimmed.length;
    return nonHexRatio <= 0.4 && /^[0-9a-fA-F\s:.\-_|,]+$/.test(trimmed);
  }

  const compact = trimmed.replace(/\s/g, '');
  if (!/^[A-Za-z0-9+/]+=*$/.test(compact) || compact.length % 4 !== 0) {
    return false;
  }
  // Require padding or alphabet markers so plain words are not treated as Base64.
  return /[+/]/.test(compact) || /=+$/.test(compact);
}

export function resolvePakoSuggestion(context: PakoSuggestionContext): TuToolSuggestion | null {
  const {
    mode,
    hasInput,
    hasOutput,
    errorMessage,
    binaryEncoding,
    compressionRatio,
    inputLooksEncoded
  } = context;

  if (!hasInput) {
    return {
      id: 'pako-get-started',
      title: 'Compress or decompress with Pako?',
      reason:
        'Paste text to compress (deflate / raw / gzip), or paste Base64/hex compressed data to decompress. Match format and encoding on both sides.',
      actionLabel: 'Open Base64 Encoder & Decoder',
      path: '/text-utilities/base64-encode-and-decode'
    };
  }

  if (errorMessage) {
    return {
      id: 'pako-error',
      title: 'Could not decompress',
      reason:
        errorMessage.includes('hex')
          ? 'Hex length must be even after stripping separators. Confirm Hex mode and the original format.'
          : 'Check that Deflate/Raw/Gzip and Base64/Hex match how the data was compressed.',
      actionLabel: binaryEncoding === 'hex' ? 'Open Hex Encoder & Decoder' : 'Open Base64 Encoder & Decoder',
      path:
        binaryEncoding === 'hex'
          ? '/text-utilities/hex-encode-decode'
          : '/text-utilities/base64-encode-and-decode'
    };
  }

  if (mode === 'encode' && inputLooksEncoded) {
    return {
      id: 'pako-looks-encoded',
      title: 'Input looks already encoded',
      reason:
        `You are in Compress mode, but this looks like ${binaryEncoding.toUpperCase()} binary data. Switch to Decompress if you want the original text.`,
      actionLabel: 'Open Base64 Encoder & Decoder',
      path: '/text-utilities/base64-encode-and-decode'
    };
  }

  if (hasOutput && mode === 'encode') {
    return {
      id: 'pako-compressed',
      title:
        compressionRatio > 0
          ? `Compressed — ${compressionRatio}% smaller`
          : 'Compressed output ready',
      reason:
        'Copy the Base64/hex payload, or switch to Decompress to verify a round-trip. Level 9 shrinks more; level 0 is fastest.',
      actionLabel: 'Open Hex Encoder & Decoder',
      path: '/text-utilities/hex-encode-decode'
    };
  }

  if (hasOutput && mode === 'decode') {
    return {
      id: 'pako-decompressed',
      title: 'Decompressed successfully',
      reason:
        'Plain text is ready. Escape it for JSON, or Base64-encode without compression if needed.',
      actionLabel: 'Open JSON String Escape & Unescape',
      path: '/text-utilities/json-string-escape-unescape'
    };
  }

  return {
    id: 'pako-ready',
    title: 'Ready to process',
    reason:
      'Keep typing — conversion updates live. Use the same format and Base64/Hex settings when decompressing.',
    actionLabel: 'Open URL Encode & Decode',
    path: '/text-utilities/url-encode-and-decode'
  };
}
