import type { TuToolSuggestion } from '../shared/tu-tool-suggestion.model';
import { wordUnwrap, wordWrap } from '../shared/text-transform.utils';
import {
  WORD_WRAP_DEFAULT_WIDTH,
  WORD_WRAP_MAX_WIDTH,
  WORD_WRAP_MIN_WIDTH,
} from '../constants/word-wrap-unwrap.constants';
import type {
  WordWrapConversionOptions,
  WordWrapConversionResult,
  WordWrapSuggestionContext,
} from '../types/word-wrap-unwrap.types';

/** Clamp wrap width the same way the original component did. */
export function clampWrapWidth(value: number): number {
  return Math.max(
    WORD_WRAP_MIN_WIDTH,
    Math.min(WORD_WRAP_MAX_WIDTH, Math.round(value || WORD_WRAP_DEFAULT_WIDTH))
  );
}

export function convertWordWrapText(
  options: WordWrapConversionOptions
): WordWrapConversionResult {
  const { mode, inputText, wrapWidth } = options;
  if (!inputText) {
    return { output: '' };
  }

  if (mode === 'wrap') {
    return { output: wordWrap(inputText, wrapWidth) };
  }
  return { output: wordUnwrap(inputText) };
}

export function inputHasLongLines(text: string, wrapWidth: number): boolean {
  if (!text) return false;
  const width = clampWrapWidth(wrapWidth);
  return text.split(/\r?\n|\r/).some((line) => line.length > width);
}

/** Soft breaks: single newlines that are not paragraph (blank-line) breaks. */
export function inputHasSoftLineBreaks(text: string): boolean {
  return /(?<!\n)\n(?!\n)/.test(text);
}

export function resolveWordWrapSuggestion(
  context: WordWrapSuggestionContext
): TuToolSuggestion | null {
  const {
    mode,
    hasInput,
    hasOutput,
    wrapWidth,
    outputUnchanged,
    hasLongLines,
    hasSoftLineBreaks,
  } = context;

  if (!hasInput) {
    return {
      id: 'wwu-get-started',
      title: 'Wrap long lines or unwrap soft breaks?',
      reason:
        'Paste prose to wrap at a column width (default 80), or paste wrapped text and switch to Unwrap to join soft line breaks.',
      actionLabel: 'Open Trim / Normalize Whitespace',
      path: '/text-utilities/trim-normalize-whitespace',
    };
  }

  if (mode === 'wrap' && !hasLongLines) {
    return {
      id: 'wwu-already-short',
      title: 'No lines exceed the wrap width',
      reason: `Every line is ≤ ${wrapWidth} characters. Lower the width in Options, or switch to Unwrap if this text already has soft breaks.`,
      actionLabel: 'Open Split & Join Text',
      path: '/text-utilities/split-join-text',
    };
  }

  if (mode === 'unwrap' && !hasSoftLineBreaks) {
    return {
      id: 'wwu-no-soft-breaks',
      title: 'No soft line breaks to unwrap',
      reason:
        'Unwrap joins single newlines into spaces while keeping blank paragraph breaks. Switch to Wrap to break long lines instead.',
      actionLabel: 'Open Line Number Tool',
      path: '/text-utilities/line-number-tool',
    };
  }

  if (hasOutput && outputUnchanged) {
    return {
      id: 'wwu-unchanged',
      title: 'Output matches input',
      reason:
        'With the current mode and width, nothing changed. Adjust wrap width or try the other mode.',
      actionLabel: 'Open Trim / Normalize Whitespace',
      path: '/text-utilities/trim-normalize-whitespace',
    };
  }

  if (hasOutput && mode === 'wrap') {
    return {
      id: 'wwu-wrapped',
      title: `Wrapped to ${wrapWidth} columns`,
      reason:
        'Copy or download the result, use → In to keep editing, or number the wrapped lines next.',
      actionLabel: 'Open Line Number Tool',
      path: '/text-utilities/line-number-tool',
    };
  }

  if (hasOutput && mode === 'unwrap') {
    return {
      id: 'wwu-unwrapped',
      title: 'Soft breaks joined',
      reason:
        'Paragraph blank lines were preserved. Trim whitespace next, or wrap again at a different width.',
      actionLabel: 'Open Trim / Normalize Whitespace',
      path: '/text-utilities/trim-normalize-whitespace',
    };
  }

  return {
    id: 'wwu-ready',
    title: 'Ready to convert',
    reason:
      'Open Options in Wrap mode to set column width (1–500). Blank lines stay intact when unwrapping.',
    actionLabel: 'Open Sort Lines',
    path: '/text-utilities/sort-lines',
  };
}
