import type { TuToolSuggestion } from '../shared/tu-tool-suggestion.model';
import { sortLines } from '../shared/text-transform.utils';
import type {
  SortLinesConversionOptions,
  SortLinesConversionResult,
  SortLinesSuggestionContext,
} from '../types/sort-lines.types';

export function countSortLines(text: string): number {
  if (!text) {
    return 0;
  }
  return text.split('\n').length;
}

export function convertSortLinesText(
  options: SortLinesConversionOptions
): SortLinesConversionResult {
  const { inputText, sortMode, caseSensitive } = options;
  if (!inputText) {
    return { output: '' };
  }
  return {
    output: sortLines(inputText, sortMode, caseSensitive),
  };
}

/** Heuristic: most non-empty lines start with a parseable number. */
export function inputLooksMostlyNumeric(text: string): boolean {
  const lines = text.split('\n').filter((line) => line.trim().length > 0);
  if (lines.length < 2) {
    return false;
  }
  const numeric = lines.filter((line) => !Number.isNaN(parseFloat(line.trim()))).length;
  return numeric / lines.length >= 0.6;
}

export function inputHasDuplicateLines(text: string): boolean {
  const lines = text.split('\n');
  const seen = new Set<string>();
  for (const line of lines) {
    if (seen.has(line)) {
      return true;
    }
    seen.add(line);
  }
  return false;
}

export function resolveSortLinesSuggestion(
  context: SortLinesSuggestionContext
): TuToolSuggestion | null {
  const {
    hasInput,
    hasOutput,
    lineCount,
    sortMode,
    caseSensitive,
    outputUnchanged,
    looksMostlyNumeric,
    hasDuplicateLines,
  } = context;

  if (!hasInput) {
    return {
      id: 'sort-get-started',
      title: 'Sort a list of lines?',
      reason:
        'Paste one item per line. Choose A→Z, length, or Numeric — sorting updates live as you type.',
      actionLabel: 'Open Remove Duplicate Lines',
      path: '/text-utilities/remove-duplicate-lines',
    };
  }

  if (lineCount === 1) {
    return {
      id: 'sort-single-line',
      title: 'Only one line detected',
      reason:
        'Sorting needs multiple lines (newline-separated). Split items onto their own rows, or use Find and Replace to insert breaks.',
      actionLabel: 'Open Find and Replace',
      path: '/text-utilities/find-and-replace',
    };
  }

  if (looksMostlyNumeric && sortMode !== 'numeric') {
    return {
      id: 'sort-looks-numeric',
      title: 'Lines look numeric',
      reason:
        'Most lines start with a number. Switch to Numeric mode so 10 sorts after 2, instead of alphabetically.',
      actionLabel: 'Open Line Number Tool',
      path: '/text-utilities/line-number-tool',
    };
  }

  if (hasDuplicateLines) {
    return {
      id: 'sort-has-duplicates',
      title: 'Duplicate lines detected',
      reason:
        'Sorting keeps every row. Deduplicate first (or after sorting) if you want a unique ordered list.',
      actionLabel: 'Open Remove Duplicate Lines',
      path: '/text-utilities/remove-duplicate-lines',
    };
  }

  if (hasOutput && outputUnchanged) {
    return {
      id: 'sort-already-ordered',
      title: 'Order unchanged',
      reason: caseSensitive
        ? 'Lines already match this sort (case-sensitive). Try another mode or turn case sensitivity off.'
        : 'Lines already match this sort. Try Z→A, Length, or Numeric for a different order.',
      actionLabel: 'Open Trim / Normalize Whitespace',
      path: '/text-utilities/trim-normalize-whitespace',
    };
  }

  if (hasOutput) {
    return {
      id: 'sort-sorted',
      title: `${lineCount} line${lineCount === 1 ? '' : 's'} sorted (${sortMode})`,
      reason:
        'Copy the result, use → In to keep editing, or number / dedupe the list next.',
      actionLabel: 'Open Line Number Tool',
      path: '/text-utilities/line-number-tool',
    };
  }

  return {
    id: 'sort-ready',
    title: 'Ready to sort',
    reason:
      'Open Options for case-sensitive alphabetical sorting. Empty lines are kept and sorted with the rest.',
    actionLabel: 'Open Trim / Normalize Whitespace',
    path: '/text-utilities/trim-normalize-whitespace',
  };
}
