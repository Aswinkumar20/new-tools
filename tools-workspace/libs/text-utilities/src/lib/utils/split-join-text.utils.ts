import type { TuToolSuggestion } from '../shared/tu-tool-suggestion.model';
import { joinText, splitText } from '../shared/text-transform.utils';
import type {
  SplitJoinConversionOptions,
  SplitJoinConversionResult,
  SplitJoinSuggestionContext,
} from '../types/split-join-text.types';

export function convertSplitJoinText(
  options: SplitJoinConversionOptions
): SplitJoinConversionResult {
  const { mode, inputText, delimiter } = options;
  if (!inputText) {
    return { output: '' };
  }

  if (mode === 'split') {
    return { output: splitText(inputText, delimiter) };
  }
  return { output: joinText(inputText, delimiter) };
}

/** Count of parts after a split (or lines for join context). */
export function countSplitParts(text: string, delimiter: string): number {
  if (!text) {
    return 0;
  }
  if (!delimiter) {
    return 1;
  }
  return text.split(delimiter).length;
}

export function inputLooksLikeLineList(text: string): boolean {
  return text.split('\n').filter((line) => line.trim().length > 0).length >= 2;
}

/** Heuristic: delimiter appears and content is mostly a single line / row. */
export function inputLooksLikeDelimitedList(text: string, delimiter: string): boolean {
  if (!delimiter || !text.includes(delimiter)) {
    return false;
  }
  const nonEmptyLines = text.split('\n').filter((line) => line.trim().length > 0);
  if (nonEmptyLines.length === 0) {
    return false;
  }
  const parts = text.split(delimiter).length;
  return nonEmptyLines.length <= 1 || parts > nonEmptyLines.length;
}

export function resolveSplitJoinSuggestion(
  context: SplitJoinSuggestionContext
): TuToolSuggestion | null {
  const {
    mode,
    hasInput,
    hasOutput,
    delimiter,
    outputUnchanged,
    looksLikeLineList,
    looksLikeDelimitedList,
    partCount,
  } = context;

  if (!hasInput) {
    return {
      id: 'sj-get-started',
      title: 'Split or join text?',
      reason:
        'Paste CSV-style values to Split into lines, or paste one item per line to Join with a delimiter (default comma).',
      actionLabel: 'Open Sort Lines',
      path: '/text-utilities/sort-lines',
    };
  }

  if (mode === 'split' && !delimiter) {
    return {
      id: 'sj-empty-delimiter',
      title: 'Delimiter is empty',
      reason:
        'Split with an empty delimiter leaves text unchanged. Open Options and set a comma, pipe, tab, or other separator.',
      actionLabel: 'Open Find and Replace',
      path: '/text-utilities/find-and-replace',
    };
  }

  if (mode === 'split' && looksLikeLineList && !looksLikeDelimitedList) {
    return {
      id: 'sj-looks-lines',
      title: 'Input already looks like a line list',
      reason:
        'You are in Split mode, but this text is already multi-line. Switch to Join to combine lines with your delimiter.',
      actionLabel: 'Open Sort Lines',
      path: '/text-utilities/sort-lines',
    };
  }

  if (mode === 'join' && looksLikeDelimitedList && !looksLikeLineList) {
    return {
      id: 'sj-looks-delimited',
      title: 'Input looks delimiter-separated',
      reason:
        'You are in Join mode, but this looks like a single delimited row. Switch to Split to break it into lines.',
      actionLabel: 'Open Trim / Normalize Whitespace',
      path: '/text-utilities/trim-normalize-whitespace',
    };
  }

  if (hasOutput && outputUnchanged && mode === 'split') {
    return {
      id: 'sj-no-split',
      title: 'Delimiter not found in input',
      reason:
        'Nothing was split because the delimiter does not appear. Check Options, or use Find and Replace to normalize separators first.',
      actionLabel: 'Open Find and Replace',
      path: '/text-utilities/find-and-replace',
    };
  }

  if (hasOutput && mode === 'split') {
    return {
      id: 'sj-split-done',
      title: `Split into ${partCount} part${partCount === 1 ? '' : 's'}`,
      reason:
        'Lines are ready. Sort or trim them next, or use → In and switch to Join to round-trip with another delimiter.',
      actionLabel: 'Open Sort Lines',
      path: '/text-utilities/sort-lines',
    };
  }

  if (hasOutput && mode === 'join') {
    return {
      id: 'sj-join-done',
      title: 'Lines joined',
      reason:
        'Items are combined with your delimiter. Copy for CSV-style paste, or wrap long results with Word Wrap.',
      actionLabel: 'Open Word Wrap / Unwrap',
      path: '/text-utilities/word-wrap-unwrap',
    };
  }

  return {
    id: 'sj-ready',
    title: 'Ready to transform',
    reason:
      'Open Options to set the delimiter (comma, semicolon, pipe, tab, or a custom string). Conversion updates live.',
    actionLabel: 'Open Trim / Normalize Whitespace',
    path: '/text-utilities/trim-normalize-whitespace',
  };
}
