import type { TuToolSuggestion } from '../shared/tu-tool-suggestion.model';
import { textToMorse, morseToText } from '../shared/text-transform.utils';
import type {
  MorseConversionOptions,
  MorseConversionResult,
  MorseSuggestionContext
} from '../types/morse-code-converter.types';

const MORSE_CHAR_PATTERN = /^[.\-\s/]+$/;

export function convertMorseText(options: MorseConversionOptions): MorseConversionResult {
  const { mode, inputText } = options;
  if (!inputText) {
    return { output: '' };
  }

  if (mode === 'encode') {
    return { output: textToMorse(inputText) };
  }
  return { output: morseToText(inputText) };
}

/** Heuristic: mostly dots, dashes, spaces, and word separators. */
export function inputLooksLikeMorse(value: string): boolean {
  const trimmed = value.trim();
  if (trimmed.length < 2) {
    return false;
  }
  if (!MORSE_CHAR_PATTERN.test(trimmed)) {
    return false;
  }
  const signalChars = (trimmed.match(/[.\-]/g) ?? []).length;
  return signalChars >= 2 && signalChars / trimmed.replace(/\s+/g, '').length >= 0.5;
}

export function resolveMorseSuggestion(context: MorseSuggestionContext): TuToolSuggestion | null {
  const { mode, hasInput, hasOutput, inputLooksLikeMorse: looksMorse } = context;

  if (!hasInput) {
    return {
      id: 'morse-get-started',
      title: 'Encode or decode Morse code?',
      reason:
        'Paste plain text to encode (letters → ·− patterns; words use /), or paste Morse tokens separated by spaces to decode.',
      actionLabel: 'Open Binary Text Converter',
      path: '/text-utilities/binary-text-converter'
    };
  }

  if (mode === 'encode' && looksMorse) {
    return {
      id: 'morse-looks-morse',
      title: 'Input looks like Morse already',
      reason:
        'You are in Encode mode, but this text is mostly dots and dashes. Switch to Decode to restore letters.',
      actionLabel: 'Open Text Case Convertor',
      path: '/text-utilities/text-case-convertor'
    };
  }

  if (mode === 'decode' && !looksMorse) {
    return {
      id: 'morse-not-morse',
      title: 'Input does not look like Morse',
      reason:
        'Decode expects dots, dashes, spaces, and / for word breaks. Switch to Encode if this is plain text.',
      actionLabel: 'Open ROT13 Cipher',
      path: '/text-utilities/rot13-cipher'
    };
  }

  if (hasOutput && mode === 'decode') {
    return {
      id: 'morse-decoded',
      title: 'Decoded successfully',
      reason:
        'Plain text is ready. Try Binary or Hex for other encodings, or Case Convertor for NATO phonetic.',
      actionLabel: 'Open Binary Text Converter',
      path: '/text-utilities/binary-text-converter'
    };
  }

  if (hasOutput && mode === 'encode') {
    return {
      id: 'morse-encoded',
      title: 'Encoded successfully',
      reason:
        'Letters are space-separated; words use /. Use → In to round-trip, or try Binary for a digital view.',
      actionLabel: 'Open Hex Encoder & Decoder',
      path: '/text-utilities/hex-encode-decode'
    };
  }

  return {
    id: 'morse-ready',
    title: 'Ready to convert',
    reason:
      'Keep typing — conversion updates live. Unknown characters are skipped when encoding.',
    actionLabel: 'Open Text Case Convertor',
    path: '/text-utilities/text-case-convertor'
  };
}
