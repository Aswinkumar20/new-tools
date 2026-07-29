import type { TuRelatedToolLink } from '../shared/tu-tool-suggestion.model';

export const KEYWORD_DENSITY_DEFAULT_TOP_N = 20;
export const KEYWORD_DENSITY_MIN_TOP_N = 1;
export const KEYWORD_DENSITY_MAX_TOP_N = 100;
export const KEYWORD_DENSITY_DEFAULT_EXCLUDE_STOP_WORDS = true;

/** Density % threshold used for “dominant keyword” suggestions. */
export const KEYWORD_DENSITY_HIGH_THRESHOLD = 5;

export const KEYWORD_DENSITY_RELATED_TOOLS: ReadonlyArray<TuRelatedToolLink> = [
  {
    label: 'Word & Character Counter',
    path: '/text-utilities/character-counter',
    description: 'Count words, characters, and reading time for the same draft'
  },
  {
    label: 'Readability Analyzer',
    path: '/text-utilities/readability-analyzer',
    description: 'Check reading ease and grade level after reviewing keywords'
  },
  {
    label: 'HTML Tag Stripper',
    path: '/text-utilities/html-tag-stripper',
    description: 'Remove markup before analyzing keyword frequency'
  },
  {
    label: 'Slug Generator',
    path: '/text-utilities/slug-generator',
    description: 'Turn top keywords into SEO-friendly URL slugs'
  }
];
