import type { TuToolSuggestion } from '../shared/tu-tool-suggestion.model';
import { testRegex } from '../shared/text-transform.utils';
import type {
  RegexFlagState,
  RegexSuggestionContext,
  RegexTesterResult,
  RegexTestOptions
} from '../types/regex-tester.types';

export function buildRegexFlagsString(flags: RegexFlagState): string {
  let result = '';
  if (flags.global) result += 'g';
  if (flags.ignoreCase) result += 'i';
  if (flags.multiline) result += 'm';
  if (flags.dotAll) result += 's';
  if (flags.unicode) result += 'u';
  return result;
}

export function formatRegexMatchResults(matches: RegExpMatchArray[]): string {
  return matches
    .map((match, i) => {
      const start = match.index ?? 0;
      const end = start + match[0].length;
      const groups =
        match.length > 1
          ? ` groups: [${match.slice(1).map((g) => JSON.stringify(g ?? '')).join(', ')}]`
          : '';
      return `#${i + 1} [${start}–${end}] "${match[0]}"${groups}`;
    })
    .join('\n');
}

export function runRegexTester(options: RegexTestOptions): RegexTesterResult {
  const { inputText, pattern, flags } = options;
  if (!pattern) {
    return { matchCount: 0, output: '', errorMessage: '' };
  }

  const result = testRegex(inputText, pattern, buildRegexFlagsString(flags));
  if (result.error) {
    return { matchCount: 0, output: '', errorMessage: result.error };
  }

  return {
    matchCount: result.matches.length,
    output: formatRegexMatchResults(result.matches),
    errorMessage: ''
  };
}

export function resolveRegexTesterSuggestion(
  context: RegexSuggestionContext
): TuToolSuggestion | null {
  const { hasInput, hasPattern, hasOutput, errorMessage, matchCount, flagGlobal } = context;

  if (!hasPattern) {
    return {
      id: 'rx-get-started',
      title: 'Test a regular expression?',
      reason:
        'Enter a pattern between the slashes, toggle flags, then paste a test string. Matches list index ranges and capture groups.',
      actionLabel: 'Open Find and Replace',
      path: '/text-utilities/find-and-replace'
    };
  }

  if (errorMessage) {
    return {
      id: 'rx-error',
      title: 'Invalid regular expression',
      reason:
        'The pattern could not be compiled. Check escaping, unclosed groups/brackets, or unsupported flag combinations.',
      actionLabel: 'Open Find and Replace',
      path: '/text-utilities/find-and-replace'
    };
  }

  if (!hasInput) {
    return {
      id: 'rx-need-input',
      title: 'Add a test string',
      reason:
        'The pattern is ready. Paste sample text below to see matches, or strip HTML first if the source is markup.',
      actionLabel: 'Open HTML Tag Stripper',
      path: '/text-utilities/html-tag-stripper'
    };
  }

  if (matchCount === 0) {
    return {
      id: 'rx-none',
      title: 'No matches found',
      reason: flagGlobal
        ? 'Try adjusting the pattern, enabling i for case-insensitivity, or checking for invisible characters in the input.'
        : 'No match for the first occurrence. Enable g to search the whole string, or refine the pattern.',
      actionLabel: flagGlobal
        ? 'Open Invisible Character Detector'
        : 'Open Find and Replace',
      path: flagGlobal
        ? '/text-utilities/invisible-character-detector'
        : '/text-utilities/find-and-replace'
    };
  }

  if (hasOutput) {
    return {
      id: 'rx-found',
      title: `${matchCount} match${matchCount === 1 ? '' : 'es'} found`,
      reason:
        'Copy the match list, or move to Find and Replace to rewrite matched text with the same pattern.',
      actionLabel: 'Open Find and Replace',
      path: '/text-utilities/find-and-replace'
    };
  }

  return {
    id: 'rx-ready',
    title: 'Ready to test',
    reason: 'Keep editing the pattern or test string — results update live as you type.',
    actionLabel: 'Open Extract Emails & URLs',
    path: '/text-utilities/extract-emails-urls'
  };
}
