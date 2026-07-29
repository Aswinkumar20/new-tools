import type { TuToolSuggestion } from '../shared/tu-tool-suggestion.model';
import { caesarCipher, rot13 } from '../shared/text-transform.utils';
import {
  ROT13_MAX_CAESAR_SHIFT,
  ROT13_MIN_CAESAR_SHIFT,
} from '../constants/rot13-cipher.constants';
import type {
  Rot13ConversionOptions,
  Rot13ConversionResult,
  Rot13SuggestionContext,
} from '../types/rot13-cipher.types';

export function clampCaesarShift(value: number): number {
  // Preserve NaN/Infinity: original component only clamped finite comparisons.
  if (!Number.isFinite(value)) {
    return value;
  }
  if (value < ROT13_MIN_CAESAR_SHIFT) {
    return ROT13_MIN_CAESAR_SHIFT;
  }
  if (value > ROT13_MAX_CAESAR_SHIFT) {
    return ROT13_MAX_CAESAR_SHIFT;
  }
  return value;
}

/** Inverse Caesar shift that recovers the original alphabet position. */
export function caesarDecodeShift(shift: number): number {
  return ((26 - (shift % 26)) + 26) % 26 || 26;
}

export function inputHasAlphabeticCharacters(text: string): boolean {
  return /[A-Za-z]/.test(text);
}

export function convertRot13CipherText(
  options: Rot13ConversionOptions
): Rot13ConversionResult {
  const { mode, inputText, caesarShift } = options;
  if (!inputText) {
    return { output: '' };
  }

  if (mode === 'rot13') {
    return { output: rot13(inputText) };
  }
  return { output: caesarCipher(inputText, caesarShift) };
}

export function resolveRot13Suggestion(
  context: Rot13SuggestionContext
): TuToolSuggestion | null {
  const {
    mode,
    hasInput,
    hasOutput,
    caesarShift,
    decodeShift,
    inputHasLetters,
  } = context;

  if (!hasInput) {
    return {
      id: 'rot13-get-started',
      title: 'ROT13 or Caesar cipher?',
      reason:
        'Paste text to rotate A–Z / a–z. ROT13 is its own inverse (run twice to decode). Caesar uses a custom shift 1–25.',
      actionLabel: 'Open Morse Code Converter',
      path: '/text-utilities/morse-code-converter',
    };
  }

  if (!inputHasLetters) {
    return {
      id: 'rot13-no-letters',
      title: 'No letters to rotate',
      reason:
        'Only alphabetic characters change. Digits, spaces, and symbols stay the same — add letters or try Base64 / Hex for full-text encoding.',
      actionLabel: 'Open Base64 Encode & Decode',
      path: '/text-utilities/base64-encode-and-decode',
    };
  }

  if (mode === 'caesar' && caesarShift === 13) {
    return {
      id: 'rot13-caesar-13',
      title: 'Shift 13 is the same as ROT13',
      reason:
        'Caesar with shift 13 matches ROT13. Switch to ROT13 mode for a clearer self-inverse workflow (apply twice to decode).',
      actionLabel: 'Open Hex Encoder & Decoder',
      path: '/text-utilities/hex-encode-decode',
    };
  }

  if (hasOutput && mode === 'rot13') {
    return {
      id: 'rot13-encoded',
      title: 'ROT13 applied',
      reason:
        'Letters are shifted by 13. Use → In and run again to restore the original, or try Morse / Binary for other encodings.',
      actionLabel: 'Open Binary Text Converter',
      path: '/text-utilities/binary-text-converter',
    };
  }

  if (hasOutput && mode === 'caesar') {
    return {
      id: 'rot13-caesar-encoded',
      title: `Caesar +${caesarShift} applied`,
      reason: `To decode, apply Caesar again with shift ${decodeShift} (or use → In then set shift ${decodeShift}). Digits and symbols were left unchanged.`,
      actionLabel: 'Open Morse Code Converter',
      path: '/text-utilities/morse-code-converter',
    };
  }

  return {
    id: 'rot13-ready',
    title: 'Ready to cipher',
    reason:
      'Transformation updates live as you type. Only A–Z and a–z rotate; case is preserved.',
    actionLabel: 'Open Hex Encoder & Decoder',
    path: '/text-utilities/hex-encode-decode',
  };
}
