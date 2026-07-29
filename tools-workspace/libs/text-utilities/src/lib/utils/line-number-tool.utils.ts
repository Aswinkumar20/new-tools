import type { TuToolSuggestion } from '../shared/tu-tool-suggestion.model';
import { addLineNumbers, removeLineNumbers } from '../shared/text-transform.utils';
import { LINE_NUMBER_DEFAULT_START } from '../constants/line-number-tool.constants';
import type {
  LineNumberConversionOptions,
  LineNumberConversionResult,
  LineNumberSuggestionContext
} from '../types/line-number-tool.types';

const NUMBERED_LINE_PATTERN = /^\s*\d+[\s.:)\-–—|]+\s*/;

export function clampLineStartNumber(value: number | null | undefined): number {
  return Math.max(0, Math.round(value ?? LINE_NUMBER_DEFAULT_START));
}

export function countTextLines(text: string): number {
  if (!text) {
    return 0;
  }
  return text.split('\n').length;
}

export function convertLineNumberText(
  options: LineNumberConversionOptions
): LineNumberConversionResult {
  const { mode, inputText, startNumber, separator } = options;
  if (!inputText) {
    return { output: '' };
  }

  if (mode === 'add') {
    return { output: addLineNumbers(inputText, startNumber, separator) };
  }
  return { output: removeLineNumbers(inputText) };
}

/** Heuristic: a majority of non-empty lines already look numbered. */
export function inputLooksLikeNumberedLines(value: string): boolean {
  const lines = value.split('\n').filter((line) => line.trim().length > 0);
  if (lines.length === 0) {
    return false;
  }
  const numbered = lines.filter((line) => NUMBERED_LINE_PATTERN.test(line)).length;
  return numbered / lines.length >= 0.6;
}

export function resolveLineNumberSuggestion(
  context: LineNumberSuggestionContext
): TuToolSuggestion | null {
  const { mode, hasInput, hasOutput, lineCount, inputLooksNumbered } = context;

  if (!hasInput) {
    return {
      id: 'lnt-get-started',
      title: 'Add or remove line numbers?',
      reason:
        'Paste a list or code snippet. Add prefixes each line (default 1. ), or Remove strips leading numbers like 1. / 2) / 3 |.',
      actionLabel: 'Open Sort Lines',
      path: '/text-utilities/sort-lines'
    };
  }

  if (mode === 'add' && inputLooksNumbered) {
    return {
      id: 'lnt-already-numbered',
      title: 'Input already looks numbered',
      reason:
        'Most lines start with a number prefix. Switch to Remove to strip them, or you will nest a second set of numbers.',
      actionLabel: 'Open Remove Duplicate Lines',
      path: '/text-utilities/remove-duplicate-lines'
    };
  }

  if (mode === 'remove' && !inputLooksNumbered) {
    return {
      id: 'lnt-not-numbered',
      title: 'No line-number prefixes detected',
      reason:
        'Remove mode only strips leading patterns like 1. or 2). Switch to Add if you want to number this text.',
      actionLabel: 'Open Trim / Normalize Whitespace',
      path: '/text-utilities/trim-normalize-whitespace'
    };
  }

  if (hasOutput && mode === 'add') {
    return {
      id: 'lnt-added',
      title: `${lineCount} line${lineCount === 1 ? '' : 's'} numbered`,
      reason:
        'Copy the result, or sort / dedupe the list next. Use → In if you want to edit the numbered text further.',
      actionLabel: 'Open Sort Lines',
      path: '/text-utilities/sort-lines'
    };
  }

  if (hasOutput && mode === 'remove') {
    return {
      id: 'lnt-removed',
      title: 'Line numbers removed',
      reason:
        'Plain lines are ready. Normalize whitespace or wrap long lines before sharing.',
      actionLabel: 'Open Trim / Normalize Whitespace',
      path: '/text-utilities/trim-normalize-whitespace'
    };
  }

  return {
    id: 'lnt-ready',
    title: 'Ready to process',
    reason:
      'Open Options in Add mode to change the start number or separator. Conversion updates live as you type.',
    actionLabel: 'Open Word Wrap / Unwrap',
    path: '/text-utilities/word-wrap-unwrap'
  };
}
