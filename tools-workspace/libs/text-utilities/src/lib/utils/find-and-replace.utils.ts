import type { TuToolSuggestion } from '../shared/tu-tool-suggestion.model';
import { findReplace } from '../shared/text-transform.utils';
import type {
  FindAndReplaceOptionsState,
  FindAndReplaceResult,
  FindAndReplaceSuggestionContext
} from '../types/find-and-replace.types';

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function countFindMatches(
  text: string,
  find: string,
  options: FindAndReplaceOptionsState
): number {
  if (!find || !text) {
    return 0;
  }

  const flags = `${options.replaceAll ? 'g' : ''}${options.caseSensitive ? '' : 'i'}`;

  if (options.useRegex) {
    try {
      const countFlags = flags.includes('g') ? flags : `${flags}g`;
      const regex = new RegExp(find, countFlags);
      const matches = text.match(regex);
      if (!matches) {
        return 0;
      }
      return options.replaceAll ? matches.length : Math.min(1, matches.length);
    } catch {
      return 0;
    }
  }

  if (options.replaceAll) {
    if (options.caseSensitive) {
      if (!find) return 0;
      return text.split(find).length - 1;
    }
    const regex = new RegExp(escapeRegex(find), 'gi');
    return text.match(regex)?.length ?? 0;
  }

  const index = options.caseSensitive
    ? text.indexOf(find)
    : text.toLowerCase().indexOf(find.toLowerCase());
  return index === -1 ? 0 : 1;
}

export function applyFindAndReplace(
  text: string,
  find: string,
  replace: string,
  options: FindAndReplaceOptionsState
): FindAndReplaceResult {
  try {
    const output = findReplace(text, find, replace, options);
    return {
      output,
      errorMessage: '',
      matchCount: countFindMatches(text, find, options)
    };
  } catch (error) {
    return {
      output: '',
      errorMessage: (error as Error).message || 'Processing failed.',
      matchCount: 0
    };
  }
}

export function resolveFindAndReplaceSuggestion(
  context: FindAndReplaceSuggestionContext
): TuToolSuggestion | null {
  const {
    hasInput,
    hasFindText,
    hasOutput,
    errorMessage,
    matchCount,
    useRegex,
    outputUnchanged
  } = context;

  if (!hasInput) {
    return {
      id: 'far-get-started',
      title: 'Find and replace in text?',
      reason:
        'Paste source text, open Options, and enter a find term. Output updates live as you type.',
      actionLabel: 'Open Regex Tester',
      path: '/text-utilities/regex-tester'
    };
  }

  if (errorMessage) {
    return {
      id: 'far-regex-error',
      title: 'Invalid regular expression',
      reason:
        'Fix the pattern syntax, or turn off Regex for plain-text matching. Regex Tester helps validate patterns.',
      actionLabel: 'Open Regex Tester',
      path: '/text-utilities/regex-tester'
    };
  }

  if (!hasFindText) {
    return {
      id: 'far-no-find',
      title: 'No find term yet',
      reason:
        'With an empty Find field, input passes through unchanged. Enter text or a regex pattern to start replacing.',
      actionLabel: 'Open Trim / Normalize Whitespace',
      path: '/text-utilities/trim-normalize-whitespace'
    };
  }

  if (matchCount === 0) {
    return {
      id: 'far-no-match',
      title: 'No matches found',
      reason: useRegex
        ? 'The pattern did not match. Check flags, escaping, or try Regex Tester for a live match list.'
        : 'Nothing matched the find text. Try disabling case sensitivity or enabling Regex for patterns.',
      actionLabel: 'Open Regex Tester',
      path: '/text-utilities/regex-tester'
    };
  }

  if (hasOutput && outputUnchanged && matchCount > 0) {
    return {
      id: 'far-same',
      title: 'Matches found, output unchanged',
      reason:
        'Replacement equals the matched text (or only formatting differs). Diff against the original if you expected edits.',
      actionLabel: 'Open Text Difference',
      path: '/text-utilities/text-difference'
    };
  }

  return {
    id: 'far-done',
    title: `${matchCount} replacement${matchCount === 1 ? '' : 's'} applied`,
    reason:
      'Copy or download the result, use → In to continue editing, or Diff to review what changed.',
    actionLabel: 'Open Text Difference',
    path: '/text-utilities/text-difference'
  };
}
