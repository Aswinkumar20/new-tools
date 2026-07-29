import type { TuRelatedToolLink } from '../shared/tu-tool-suggestion.model';

/** Flesch scores at or below this are treated as “difficult” for suggestions. */
export const READABILITY_DIFFICULT_THRESHOLD = 50;

/** Flesch scores at or above this are treated as “easy” for suggestions. */
export const READABILITY_EASY_THRESHOLD = 70;

export const READABILITY_RELATED_TOOLS: ReadonlyArray<TuRelatedToolLink> = [
  {
    label: 'Word & Character Counter',
    path: '/text-utilities/character-counter',
    description: 'Count words, characters, and reading time for the same draft'
  },
  {
    label: 'Keyword Density',
    path: '/text-utilities/keyword-density',
    description: 'See which words dominate after checking reading level'
  },
  {
    label: 'HTML Tag Stripper',
    path: '/text-utilities/html-tag-stripper',
    description: 'Remove markup before measuring prose readability'
  },
  {
    label: 'Trim / Normalize Whitespace',
    path: '/text-utilities/trim-normalize-whitespace',
    description: 'Clean spacing that can skew sentence and word counts'
  }
];
