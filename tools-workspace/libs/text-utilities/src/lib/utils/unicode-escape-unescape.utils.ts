import type { TuToolSuggestion } from '../shared/tu-tool-suggestion.model';
import { unicodeEscape, unicodeUnescape } from '../shared/text-transform.utils';
import type {
  UnicodeEscapeConversionOptions,
  UnicodeEscapeConversionResult,
  UnicodeEscapeSuggestionContext,
} from '../types/unicode-escape-unescape.types';

const UNICODE_ESCAPE_SEQUENCE_PATTERN = /\\u\{[0-9a-fA-F]+\}|\\u[0-9a-fA-F]{4}/;

export function convertUnicodeEscapeText(
  options: UnicodeEscapeConversionOptions
): UnicodeEscapeConversionResult {
  const { mode, inputText } = options;
  if (!inputText) {
    return { output: '' };
  }

  return {
    output: mode === 'encode' ? unicodeEscape(inputText) : unicodeUnescape(inputText),
  };
}

/** Heuristic: text already contains \\uXXXX or \\u{…} sequences. */
export function inputLooksLikeUnicodeEscaped(value: string): boolean {
  return UNICODE_ESCAPE_SEQUENCE_PATTERN.test(value);
}

export function inputHasNonAsciiCharacters(value: string): boolean {
  return [...value].some((ch) => {
    const cp = ch.codePointAt(0)!;
    return cp > 0x7f;
  });
}

export function resolveUnicodeEscapeSuggestion(
  context: UnicodeEscapeSuggestionContext
): TuToolSuggestion | null {
  const {
    mode,
    hasInput,
    hasOutput,
    inputLooksLikeEscaped: looksEscaped,
    inputHasNonAscii: hasNonAscii,
    outputUnchanged,
  } = context;

  if (!hasInput) {
    return {
      id: 'ueu-get-started',
      title: 'Escape or unescape Unicode?',
      reason:
        'Paste text to convert non-ASCII (and backslashes) into \\uXXXX / \\u{…} sequences, or paste escapes to restore characters.',
      actionLabel: 'Open JSON String Escape / Unescape',
      path: '/text-utilities/json-string-escape-unescape',
    };
  }

  if (mode === 'encode' && looksEscaped) {
    return {
      id: 'ueu-looks-escaped',
      title: 'Input already looks Unicode-escaped',
      reason:
        'You are in Encode mode, but \\u sequences were detected. Switch to Decode to restore plain characters.',
      actionLabel: 'Open Invisible Character Detector',
      path: '/text-utilities/invisible-character-detector',
    };
  }

  if (mode === 'decode' && !looksEscaped && hasNonAscii) {
    return {
      id: 'ueu-looks-plain',
      title: 'Input looks like plain Unicode text',
      reason:
        'No \\uXXXX sequences found. Switch to Encode if you want escapes for logs or source strings.',
      actionLabel: 'Open Hex Encoder & Decoder',
      path: '/text-utilities/hex-encode-decode',
    };
  }

  if (hasOutput && mode === 'encode' && outputUnchanged) {
    return {
      id: 'ueu-ascii-only',
      title: 'Nothing needed escaping',
      reason:
        'ASCII letters/digits stay as-is; only non-ASCII and backslashes become \\u escapes. Add international characters or use JSON String Escape for quotes/newlines.',
      actionLabel: 'Open JSON String Escape / Unescape',
      path: '/text-utilities/json-string-escape-unescape',
    };
  }

  if (hasOutput && mode === 'decode' && outputUnchanged && !looksEscaped) {
    return {
      id: 'ueu-no-sequences',
      title: 'No Unicode escapes to decode',
      reason:
        'Paste sequences like \\u20AC or \\u{1F600}, or switch to Encode for plain text.',
      actionLabel: 'Open Text to ASCII Converter',
      path: '/text-utilities/text-to-ascii',
    };
  }

  if (hasOutput && mode === 'decode') {
    return {
      id: 'ueu-decoded',
      title: 'Unescaped successfully',
      reason:
        'Plain Unicode text is ready. Inspect invisible characters next, or re-encode with → In + Encode.',
      actionLabel: 'Open Invisible Character Detector',
      path: '/text-utilities/invisible-character-detector',
    };
  }

  if (hasOutput && mode === 'encode') {
    return {
      id: 'ueu-encoded',
      title: 'Escaped successfully',
      reason:
        'Non-ASCII characters use uppercase hex. Copy the result, or use JSON String Escape if you also need quotes and control escapes.',
      actionLabel: 'Open JSON String Escape / Unescape',
      path: '/text-utilities/json-string-escape-unescape',
    };
  }

  return {
    id: 'ueu-ready',
    title: 'Ready to convert',
    reason:
      'Conversion updates live. Astral-plane characters use \\u{…} braces; BMP uses \\uXXXX.',
    actionLabel: 'Open Hex Encoder & Decoder',
    path: '/text-utilities/hex-encode-decode',
  };
}
