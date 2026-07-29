import type { TuToolSuggestion } from '../shared/tu-tool-suggestion.model';
import {
  BASE64_ALLOWED_MIME_TYPES,
  BASE64_BLOCKED_MIME_PREFIXES,
  BASE64_DECODE_ERROR,
  BASE64_ENCODE_ERROR,
  BASE64_TEXT_EXTENSIONS
} from '../constants/base64-encode-and-decode.constants';
import type {
  Base64ConversionMode,
  Base64ConversionResult,
  Base64SuggestionContext
} from '../types/base64-encode-and-decode.types';

export function utf8ToBase64(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  bytes.forEach((b) => {
    binary += String.fromCharCode(b);
  });
  return btoa(binary);
}

export function base64ToUtf8(base64: string): string {
  const binary = atob(base64);
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

export function convertBase64(
  mode: Base64ConversionMode,
  inputText: string
): Base64ConversionResult {
  if (!inputText) {
    return { output: '', errorMessage: '' };
  }

  try {
    if (mode === 'encode') {
      return { output: utf8ToBase64(inputText), errorMessage: '' };
    }
    return { output: base64ToUtf8(inputText.trim()), errorMessage: '' };
  } catch {
    return {
      output: '',
      errorMessage: mode === 'encode' ? BASE64_ENCODE_ERROR : BASE64_DECODE_ERROR
    };
  }
}

export function isLikelyBase64TextFile(file: File): boolean {
  if (
    file.type &&
    BASE64_BLOCKED_MIME_PREFIXES.some(
      (prefix) => file.type.startsWith(prefix) || file.type === prefix
    )
  ) {
    return false;
  }
  if (!file.type || file.type.startsWith('text/')) {
    return true;
  }
  if (BASE64_ALLOWED_MIME_TYPES.has(file.type)) {
    return true;
  }
  const ext = file.name.includes('.') ? file.name.split('.').pop()!.toLowerCase() : '';
  return BASE64_TEXT_EXTENSIONS.has(ext);
}

/** Heuristic: looks like a single Base64 token (standard alphabet + padding). */
export function inputLooksLikeBase64(value: string): boolean {
  const trimmed = value.trim();
  if (trimmed.length < 8 || trimmed.length % 4 !== 0) {
    return false;
  }
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(trimmed)) {
    return false;
  }
  // Prefer suggesting decode when the string is mostly non-space and long enough
  return !/\s/.test(trimmed);
}

export function resolveBase64Suggestion(
  context: Base64SuggestionContext
): TuToolSuggestion | null {
  const { mode, hasInput, hasOutput, errorMessage, inputLooksLikeBase64: looksLikeB64 } =
    context;

  if (!hasInput) {
    return {
      id: 'b64-get-started',
      title: 'Encode or decode Base64?',
      reason:
        'Paste text to encode, or a Base64 string to decode. UTF-8 is supported for both directions.',
      actionLabel: 'Open URL Encode & Decode',
      path: '/text-utilities/url-encode-and-decode'
    };
  }

  if (errorMessage === BASE64_DECODE_ERROR) {
    return {
      id: 'b64-invalid-decode',
      title: 'Could not decode as Base64',
      reason:
        'Check for missing padding (=), URL-safe characters (-/_), or extra whitespace. JWT segments use Base64URL — try the JWT Decoder.',
      actionLabel: 'Open JWT Decoder',
      path: '/testing-tools/jwt-decoder'
    };
  }

  if (errorMessage === BASE64_ENCODE_ERROR) {
    return {
      id: 'b64-invalid-encode',
      title: 'Could not encode input',
      reason: 'Encoding failed unexpectedly. Try a smaller sample or remove unsupported control data.',
      actionLabel: 'Open Hex Encode / Decode',
      path: '/text-utilities/hex-encode-decode'
    };
  }

  if (mode === 'encode' && looksLikeB64) {
    return {
      id: 'b64-looks-encoded',
      title: 'Input looks like Base64 already',
      reason:
        'You are in Encode mode, but this string matches Base64 shape. Switch to Decode to restore the original text.',
      actionLabel: 'Open Hex Encode / Decode',
      path: '/text-utilities/hex-encode-decode'
    };
  }

  if (hasOutput && mode === 'decode') {
    return {
      id: 'b64-decoded',
      title: 'Decoded successfully',
      reason:
        'If the result is JSON, format it next. For URL payloads, percent-decode may still be needed.',
      actionLabel: 'Open JSON Formatter',
      path: '/data-converters/json-formatter-beautifier-validator'
    };
  }

  if (hasOutput && mode === 'encode') {
    return {
      id: 'b64-encoded',
      title: 'Encoded successfully',
      reason:
        'Base64 expands size by ~33%. Use → In or ⇄ Swap to round-trip, or pair with URL encoding for transport.',
      actionLabel: 'Open URL Encode & Decode',
      path: '/text-utilities/url-encode-and-decode'
    };
  }

  return {
    id: 'b64-ready',
    title: 'Ready to convert',
    reason: 'Keep typing — conversion updates live. Upload or drop a text/.b64 file when needed.',
    actionLabel: 'Open Hex Encode / Decode',
    path: '/text-utilities/hex-encode-decode'
  };
}
