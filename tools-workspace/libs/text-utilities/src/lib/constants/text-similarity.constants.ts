import type { TuRelatedToolLink } from '../shared/tu-tool-suggestion.model';

/** Scores at or above this are treated as near-duplicates in suggestions. */
export const TEXT_SIMILARITY_NEAR_MATCH_PERCENT = 90;

/** Scores at or below this (with both sides filled) are treated as low overlap. */
export const TEXT_SIMILARITY_LOW_MATCH_PERCENT = 15;

export const TEXT_SIMILARITY_RELATED_TOOLS: ReadonlyArray<TuRelatedToolLink> = [
  {
    label: 'Text Difference',
    path: '/text-utilities/text-difference',
    description: 'See line-by-line diffs when strings are close but not identical',
  },
  {
    label: 'Find & Replace',
    path: '/text-utilities/find-and-replace',
    description: 'Normalize wording before comparing again',
  },
  {
    label: 'Text Case Convertor',
    path: '/text-utilities/text-case-convertor',
    description: 'Align casing so edits are not counted as differences',
  },
  {
    label: 'Text Reverser & Palindrome',
    path: '/text-utilities/text-reversal-and-palindrome-checker',
    description: 'Check mirrors and reversals related to your strings',
  },
];
