import type { TuRelatedToolLink } from '../shared/tu-tool-suggestion.model';
import type { SlugSeparator, SlugSeparatorOption } from '../types/slug-generator.types';

export const SLUG_DEFAULT_SEPARATOR: SlugSeparator = '-';
export const SLUG_DEFAULT_REMOVE_NUMBERS = false;
export const SLUG_MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
export const SLUG_HISTORY_LIMIT = 30;
export const SLUG_LONG_LENGTH_THRESHOLD = 80;

export const SLUG_SEPARATOR_OPTIONS: ReadonlyArray<SlugSeparatorOption> = [
  { value: '-', label: 'Hyphen' },
  { value: '_', label: 'Underscore' },
  { value: '+', label: 'Plus' },
];

export const SLUG_RELATED_TOOLS: ReadonlyArray<TuRelatedToolLink> = [
  {
    label: 'Text Case Convertor',
    path: '/text-utilities/text-case-convertor',
    description: 'Normalize title case before generating a slug',
  },
  {
    label: 'Trim / Normalize Whitespace',
    path: '/text-utilities/trim-normalize-whitespace',
    description: 'Clean spacing and line breaks in long headlines',
  },
  {
    label: 'Keyword Density',
    path: '/text-utilities/keyword-density',
    description: 'Pick strong terms from an article for SEO slugs',
  },
  {
    label: 'Find and Replace',
    path: '/text-utilities/find-and-replace',
    description: 'Rewrite words before or after slugifying',
  },
];
